const axios = require('axios');
const { Databases, Query } = require('node-appwrite');
const { getAppwriteClient, APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID } = require('./appwrite');
const { sendReauthRequiredEmail } = require('./reauthEmail');
const { recomputeAccountAccessForUser, recomputeAccountAccessStateForUser } = require('./accountAccess');

const RECONNECT_PERMISSION_MARKER = 'dm_panda_reconnect_required';

// In-memory cache for recent token validity checks (TTL: 60 seconds)
const tokenValidationCache = new Map();
const VALIDATION_CACHE_TTL_MS = 60 * 1000;

/**
 * Appends the dm_panda_reconnect_required marker to a permissions string.
 */
const appendReconnectPermissionMarker = (permissions) => {
    const values = String(permissions || '')
        .split(',')
        .map((value) => String(value || '').trim())
        .filter(Boolean);
    if (!values.includes(RECONNECT_PERMISSION_MARKER)) {
        values.push(RECONNECT_PERMISSION_MARKER);
    }
    return values.join(',').slice(0, 1024);
};

/**
 * Removes the dm_panda_reconnect_required marker from a permissions string.
 */
const removeReconnectPermissionMarker = (permissions) => {
    return String(permissions || '')
        .split(',')
        .map((value) => String(value || '').trim())
        .filter((value) => value && value !== RECONNECT_PERMISSION_MARKER)
        .join(',')
        .slice(0, 1024);
};

/**
 * Checks if permissions contain the dm_panda_reconnect_required marker.
 */
const hasReconnectPermissionMarker = (permissions) => {
    return String(permissions || '')
        .split(',')
        .map((value) => String(value || '').trim())
        .includes(RECONNECT_PERMISSION_MARKER);
};

/**
 * Determines whether an error response from Meta Graph API or network
 * represents a genuine authentication / token invalidation error.
 * 
 * True for:
 *  - Code 190 (Invalid OAuth 2.0 Access Token, expired, revoked, invalidated session)
 *  - Code 102 with subcode 459 (user changed password or session deleted)
 *  - OAuthException messages regarding invalid, expired, revoked, or deauthorized tokens
 *  - Off-Meta Technologies activity disabled
 * 
 * False for:
 *  - Rate limits (code 4, 17, 32, 613, etc.)
 *  - Network timeouts / socket drops (ETIMEDOUT, ECONNRESET, etc.)
 *  - 5xx Meta server errors
 *  - Malformed user request payloads
 */
const isInstagramAuthError = (error) => {
    if (!error) return false;
    const responseData = error.response?.data;
    const errObj = responseData?.error || {};
    const code = Number(errObj.code);
    const subcode = Number(errObj.error_subcode);
    const message = String(errObj.message || error.message || '').toLowerCase();
    const type = String(errObj.type || '').toLowerCase();

    // Explicit Meta Auth Error Codes
    if (code === 190) return true;
    if (code === 102 && subcode === 459) return true;

    // Explicit OAuth Exception messages
    if (type.includes('oauthexception')) return true;
    if (
        message.includes('oauth') ||
        message.includes('access token') ||
        message.includes('session has expired') ||
        message.includes('revoked') ||
        message.includes('deauthorized') ||
        message.includes('cannot parse access token') ||
        message.includes('the user has not authorized the application') ||
        message.includes('user has logged out') ||
        message.includes('off meta technologies') ||
        message.includes('future activity history')
    ) {
        return true;
    }

    return false;
};

/**
 * Centralized Instagram Authorization Failure Handler.
 * When an account's token is determined to be invalid, this handler:
 * 1. Sets account status to 'inactive' in the database.
 * 2. Sets reauth_required = true and appends dm_panda_reconnect_required to permissions.
 * 3. Records the deactivation reason (without logging sensitive tokens).
 * 4. Ensures idempotent email notification (sends email only ONCE per invalidation event).
 * 5. Clears in-memory validation cache for this account.
 */
const handleInstagramAuthorizationFailure = async ({
    databases = null,
    account = null,
    accountId = null,
    error = null,
    reason = '',
    forceEmail = false,
    frontendOrigin = ''
} = {}) => {
    try {
        let db = databases;
        if (!db) {
            const serverClient = getAppwriteClient({ useApiKey: true });
            db = new Databases(serverClient);
        }

        const safeAccountId = String(account?.$id || accountId || '').trim();
        if (!safeAccountId) {
            console.warn('[InstagramAuth] Cannot handle auth failure: missing account ID');
            return { handled: false, reason: 'missing_account_id' };
        }

        // Fetch current document if not provided or to ensure fresh state
        let accountDoc = account;
        if (!accountDoc || !accountDoc.$id) {
            try {
                accountDoc = await db.getDocument(
                    APPWRITE_DATABASE_ID,
                    IG_ACCOUNTS_COLLECTION_ID,
                    safeAccountId
                );
            } catch (fetchErr) {
                console.error(`[InstagramAuth] Could not fetch account document ${safeAccountId}: ${fetchErr.message}`);
                return { handled: false, error: fetchErr.message };
            }
        }

        const userId = String(accountDoc.user_id || accountDoc.userId || '').trim();
        const username = String(accountDoc.username || 'your account').trim();
        const currentPermissions = String(accountDoc.permissions || '');
        const updatedPermissions = appendReconnectPermissionMarker(currentPermissions);

        // Determine human-readable deactivation reason
        const errorMsg = error?.response?.data?.error?.message || error?.message || '';
        const resolvedReason = reason || errorMsg || 'Meta access token is invalid, expired, or disconnected.';

        // Prepare database patch
        const patch = {
            status: 'inactive',
            permissions: updatedPermissions,
            reauth_required: true,
            deactivation_reason: resolvedReason.slice(0, 255)
        };

        // Notification deduplication: check if email was already sent for this invalidation event
        const alreadySentAt = accountDoc.reauth_email_sent_at;
        const shouldSendEmail = Boolean(userId && (!alreadySentAt || forceEmail));

        if (shouldSendEmail) {
            patch.reauth_email_sent_at = new Date().toISOString();
        }

        // Invalidate cache
        tokenValidationCache.delete(safeAccountId);

        // Update database document
        try {
            await db.updateDocument(
                APPWRITE_DATABASE_ID,
                IG_ACCOUNTS_COLLECTION_ID,
                safeAccountId,
                patch
            );
        } catch (dbErr) {
            // Fallback: If newer attributes (reauth_required, etc.) aren't available in some environments, update core fields
            console.warn(`[InstagramAuth] Retrying update without extended attributes: ${dbErr.message}`);
            await db.updateDocument(
                APPWRITE_DATABASE_ID,
                IG_ACCOUNTS_COLLECTION_ID,
                safeAccountId,
                {
                    status: 'inactive',
                    permissions: updatedPermissions
                }
            );
        }

        console.info(`[InstagramAuth] Account @${username} (${safeAccountId}) marked inactive (re-authorization required). Reason: ${resolvedReason}`);

        // Send re-authorization notification email once
        let emailSent = false;
        if (shouldSendEmail) {
            try {
                const emailResult = await sendReauthRequiredEmail({
                    userId,
                    username,
                    reason: resolvedReason,
                    force: forceEmail,
                    frontendOrigin
                });
                emailSent = emailResult?.success === true;
            } catch (emailErr) {
                console.error(`[InstagramAuth] Failed to send re-authorization email to user ${userId} for @${username}: ${emailErr.message}`);
            }
        } else {
            console.info(`[InstagramAuth] Skipped duplicate re-authorization email for @${username} (already notified at ${alreadySentAt})`);
        }

        return {
            handled: true,
            deactivated: true,
            emailSent,
            reason: resolvedReason
        };
    } catch (err) {
        console.error(`[InstagramAuth] Error in handleInstagramAuthorizationFailure: ${err.message}`);
        return { handled: false, error: err.message };
    }
};

/**
 * Validates a single Instagram account's access token against Meta Graph API.
 * 
 * Returns: { valid: boolean, status: 'active' | 'inactive', reconnect_required: boolean, reason?: string }
 */
const validateInstagramAccountToken = async (databases, account, options = {}) => {
    const { force = false, frontendOrigin = '' } = options;
    const accountId = String(account?.$id || account?.id || '').trim();
    if (!accountId) return { valid: false, reason: 'missing_account_id' };

    // 1. Check expiration date first (zero-network check)
    const tokenExpiresAt = account?.token_expires_at;
    if (tokenExpiresAt) {
        const isExpired = new Date(tokenExpiresAt).getTime() <= Date.now();
        if (isExpired) {
            await handleInstagramAuthorizationFailure({
                databases,
                account,
                accountId,
                reason: 'Access token expired.',
                frontendOrigin
            });
            return {
                valid: false,
                status: 'inactive',
                reconnect_required: true,
                reason: 'Access token expired.'
            };
        }
    }

    // 2. If account is already marked inactive with reconnect required, do not spam Meta API unless forced
    const isAlreadyFlagged = account?.reauth_required === true ||
        hasReconnectPermissionMarker(account?.permissions) ||
        account?.status === 'reconnect_required';

    if (isAlreadyFlagged && account?.status === 'inactive' && !force) {
        return {
            valid: false,
            status: 'inactive',
            reconnect_required: true,
            reason: account?.deactivation_reason || 'Re-authorization required.'
        };
    }

    const token = String(account?.access_token || '').trim();
    if (!token) {
        await handleInstagramAuthorizationFailure({
            databases,
            account,
            accountId,
            reason: 'No access token available.',
            frontendOrigin
        });
        return {
            valid: false,
            status: 'inactive',
            reconnect_required: true,
            reason: 'No access token available.'
        };
    }

    // 3. In-memory validation cache check
    const now = Date.now();
    const cached = tokenValidationCache.get(accountId);
    if (!force && cached && (now - cached.timestamp < VALIDATION_CACHE_TTL_MS)) {
        if (cached.valid) {
            return { valid: true, status: 'active', reconnect_required: false };
        }
    }

    // 4. Test access token with Meta Graph API
    try {
        const response = await axios.get('https://graph.instagram.com/me', {
            params: {
                fields: 'id,username',
                access_token: token
            },
            timeout: 7000
        });

        if (response.data && response.data.id) {
            // Token is valid!
            tokenValidationCache.set(accountId, { valid: true, timestamp: now });

            // If account was marked with reconnect marker previously but is actually valid, clear it
            if (isAlreadyFlagged) {
                const cleanedPermissions = removeReconnectPermissionMarker(account.permissions);
                await databases.updateDocument(
                    APPWRITE_DATABASE_ID,
                    IG_ACCOUNTS_COLLECTION_ID,
                    accountId,
                    {
                        status: 'active',
                        permissions: cleanedPermissions,
                        reauth_required: false,
                        reauth_email_sent_at: null,
                        deactivation_reason: null
                    }
                ).catch(() => null);
            }

            return {
                valid: true,
                status: 'active',
                reconnect_required: false
            };
        }

        return { valid: false, reason: 'unknown_meta_response' };
    } catch (apiErr) {
        if (isInstagramAuthError(apiErr)) {
            tokenValidationCache.set(accountId, { valid: false, timestamp: now });
            await handleInstagramAuthorizationFailure({
                databases,
                account,
                accountId,
                error: apiErr,
                frontendOrigin
            });
            return {
                valid: false,
                status: 'inactive',
                reconnect_required: true,
                reason: apiErr.response?.data?.error?.message || apiErr.message || 'Token invalid.'
            };
        }

        // Transient / network / server errors: preserve existing state (do NOT mark inactive)
        console.warn(`[InstagramAuth] Transient error validating account @${account?.username}: ${apiErr.message}`);
        return {
            valid: true,
            status: account?.status || 'active',
            reconnect_required: isAlreadyFlagged,
            transientError: true
        };
    }
};

/**
 * Validates all Instagram accounts owned by a user in parallel.
 * Updates the database for any accounts found to be invalid.
 */
const validateUserInstagramAccounts = async (databases, userId, accounts = null, options = {}) => {
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) return [];

    let docs = accounts;
    if (!Array.isArray(docs)) {
        const response = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            [Query.equal('user_id', safeUserId), Query.limit(100)]
        );
        docs = response.documents || [];
    }

    if (docs.length === 0) return [];

    // Validate accounts in parallel with Promise.allSettled
    await Promise.allSettled(docs.map((doc) => validateInstagramAccountToken(databases, doc, options)));

    // Re-fetch fresh account documents after validation
    const refreshed = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        IG_ACCOUNTS_COLLECTION_ID,
        [Query.equal('user_id', safeUserId), Query.limit(100)]
    );

    return refreshed.documents || [];
};

/**
 * Clears re-authorization state for an account upon successful re-authorization.
 */
const clearInstagramAccountReauth = (permissions) => {
    return {
        status: 'active',
        permissions: removeReconnectPermissionMarker(permissions),
        reauth_required: false,
        reauth_email_sent_at: null,
        deactivation_reason: null
    };
};

module.exports = {
    RECONNECT_PERMISSION_MARKER,
    appendReconnectPermissionMarker,
    removeReconnectPermissionMarker,
    hasReconnectPermissionMarker,
    isInstagramAuthError,
    handleInstagramAuthorizationFailure,
    validateInstagramAccountToken,
    validateUserInstagramAccounts,
    clearInstagramAccountReauth
};

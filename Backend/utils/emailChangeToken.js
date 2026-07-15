const crypto = require('crypto');
const { ID, Query, Messaging, Users } = require('node-appwrite');
const { getAppwriteClient, APPWRITE_DATABASE_ID, EMAIL_CHANGE_TOKENS_COLLECTION_ID } = require('./appwrite');
const { renderEmailLayout, buildPlainTextEmail } = require('./emailTemplate');

const TOKEN_EXPIRY_MINUTES = Number(process.env.EMAIL_CHANGE_TOKEN_EXPIRY_MINUTES) || 60;
const TOKEN_BYTE_LENGTH = 32;

/**
 * Generate a cryptographically secure, URL-safe token.
 */
const generateToken = () => crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('base64url');

/**
 * Expire all pending email-change tokens for a given user.
 * Prevents stale tokens from lingering after a new request is made.
 */
const expirePendingTokensForUser = async (databases, userId) => {
    try {
        const existing = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            EMAIL_CHANGE_TOKENS_COLLECTION_ID,
            [
                Query.equal('user_id', String(userId)),
                Query.equal('status', 'pending'),
                Query.limit(50)
            ]
        );
        await Promise.allSettled(
            (existing.documents || []).map((doc) =>
                databases.updateDocument(
                    APPWRITE_DATABASE_ID,
                    EMAIL_CHANGE_TOKENS_COLLECTION_ID,
                    doc.$id,
                    { status: 'expired' }
                ).catch(() => null)
            )
        );
    } catch (err) {
        console.warn(`Failed to expire old email-change tokens for user ${userId}: ${err.message}`);
    }
};

/**
 * Create a new pending email-change token document.
 * Returns the created document (including the token value).
 */
const createEmailChangeToken = async (databases, { userId, oldEmail, newEmail }) => {
    // Expire any previously pending tokens for this user
    await expirePendingTokensForUser(databases, userId);

    const token = generateToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    const doc = await databases.createDocument(
        APPWRITE_DATABASE_ID,
        EMAIL_CHANGE_TOKENS_COLLECTION_ID,
        ID.unique(),
        {
            user_id: String(userId),
            old_email: String(oldEmail).trim().toLowerCase(),
            new_email: String(newEmail).trim().toLowerCase(),
            token,
            status: 'pending',
            expires_at: expiresAt.toISOString(),
            created_at: now.toISOString()
        }
    );

    return doc;
};

/**
 * Look up a token document by its token string.
 * Returns null if not found.
 */
const findTokenByValue = async (databases, tokenValue) => {
    const safeToken = String(tokenValue || '').trim();
    if (!safeToken) return null;

    const result = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        EMAIL_CHANGE_TOKENS_COLLECTION_ID,
        [
            Query.equal('token', safeToken),
            Query.limit(1)
        ]
    );

    return result.documents?.[0] || null;
};

/**
 * Validate a token document against all edge cases.
 * Returns { valid: true, tokenDoc } or { valid: false, error, statusCode }.
 */
const validateToken = (tokenDoc) => {
    if (!tokenDoc) {
        return { valid: false, error: 'Invalid verification link.', statusCode: 404 };
    }

    if (tokenDoc.status === 'used') {
        return { valid: false, error: 'This verification link has already been used.', statusCode: 409 };
    }

    if (tokenDoc.status === 'expired') {
        return { valid: false, error: 'This verification link has expired.', statusCode: 410 };
    }

    if (tokenDoc.status !== 'pending') {
        return { valid: false, error: 'This verification link is no longer valid.', statusCode: 410 };
    }

    const expiresAt = new Date(tokenDoc.expires_at);
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        return { valid: false, error: 'This verification link has expired.', statusCode: 410 };
    }

    return { valid: true, tokenDoc };
};

/**
 * Mark a token as used so it cannot be consumed again.
 */
const markTokenUsed = async (databases, tokenDocId) => {
    return databases.updateDocument(
        APPWRITE_DATABASE_ID,
        EMAIL_CHANGE_TOKENS_COLLECTION_ID,
        tokenDocId,
        { status: 'used' }
    );
};

/**
 * Mark a token as expired.
 */
const markTokenExpired = async (databases, tokenDocId) => {
    return databases.updateDocument(
        APPWRITE_DATABASE_ID,
        EMAIL_CHANGE_TOKENS_COLLECTION_ID,
        tokenDocId,
        { status: 'expired' }
    );
};

/**
 * Send the verification email to the new email address.
 * Uses Appwrite Messaging to deliver a branded HTML email.
 */
const sendEmailChangeVerificationEmail = async ({ userId, newEmail, token, oldEmail }) => {
    const frontendOrigin = String(process.env.FRONTEND_ORIGIN || '').replace(/\/+$/, '');
    const verifyUrl = `${frontendOrigin}/auth/verify-email-change?token=${encodeURIComponent(token)}`;

    const html = renderEmailLayout({
        title: 'Confirm Your New Email Address',
        preheader: 'Please verify your new email address for DM Panda.',
        eyebrow: 'Email Change',
        greeting: 'Hello,',
        intro: 'We received a request to change your DM Panda account email address.',
        summaryRows: [
            ['Current Email', oldEmail],
            ['New Email', newEmail]
        ],
        paragraphs: [
            'To confirm this change, please click the button below. This link will expire in 1 hour.',
            'If you did not request this change, you can safely ignore this email. Your current email will remain unchanged.'
        ],
        callouts: [
            {
                tone: 'warning',
                title: 'Security Notice',
                lines: [
                    'After verifying, you will need to log in using your new email address.',
                    'If you previously signed in with Google, you will need to re-link your Google account.'
                ]
            }
        ],
        ctaLabel: 'Verify New Email',
        ctaUrl: verifyUrl,
        footerNote: `If the button doesn't work, paste this link into your browser: ${verifyUrl}`,
        frontendOrigin
    });

    const text = buildPlainTextEmail({
        title: 'Confirm Your New Email Address',
        greeting: 'Hello,',
        intro: 'We received a request to change your DM Panda account email address.',
        summaryRows: [
            ['Current Email', oldEmail],
            ['New Email', newEmail]
        ],
        paragraphs: [
            'To confirm this change, please click the link below. This link will expire in 1 hour.',
            'If you did not request this change, you can safely ignore this email.'
        ],
        ctaLabel: 'Verify New Email',
        ctaUrl: verifyUrl
    });

    try {
        const client = getAppwriteClient({ useApiKey: true });
        const users = new Users(client);
        const messaging = new Messaging(client);

        const targetId = ID.unique();
        await users.createTarget(
            userId,
            targetId,
            'email',
            newEmail
        );

        try {
            await messaging.createEmail({
                messageId: ID.unique(),
                subject: 'Confirm Your New Email Address — DM Panda',
                content: html,
                targets: [targetId],
                html: true
            });
            console.log(`Email change verification sent to user ${userId} at new email ${newEmail}`);
        } finally {
            await users.deleteTarget(userId, targetId).catch((e) => {
                console.warn(`Failed to delete temporary email target ${targetId}: ${e.message}`);
            });
        }
    } catch (err) {
        console.error(`Failed to send email change verification email: ${err.message}`);
        throw new Error('Failed to send verification email. Please try again.');
    }
};

module.exports = {
    generateToken,
    expirePendingTokensForUser,
    createEmailChangeToken,
    findTokenByValue,
    validateToken,
    markTokenUsed,
    markTokenExpired,
    sendEmailChangeVerificationEmail,
    TOKEN_EXPIRY_MINUTES
};

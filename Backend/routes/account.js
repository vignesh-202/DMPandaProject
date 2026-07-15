const express = require('express');
const router = express.Router();
const { loginRequired } = require('../middleware/auth');
const {
    getAppwriteClient,
    APPWRITE_DATABASE_ID,
    USERS_COLLECTION_ID
} = require('../utils/appwrite');
const { Account, Users, Databases, Query } = require('node-appwrite');
const { isValidEmail, normalizeEmail, isDisposableEmail } = require('../utils/helpers');
const { cleanupUserOwnedData } = require('../utils/userCleanup');
const {
    createEmailChangeToken,
    findTokenByValue,
    validateToken,
    markTokenUsed,
    markTokenExpired,
    expirePendingTokensForUser,
    sendEmailChangeVerificationEmail
} = require('../utils/emailChangeToken');
const {
    getAppContextFromRequest,
    setSessionCookie,
    clearSessionCookie
} = require('../utils/sessionContext');

const getSessionSecret = (session) => session?.secret || session?.['secret'] || '';
const isInvalidPasswordError = (error) => {
    const message = String(error?.message || '').toLowerCase();
    return error?.code === 401
        || message.includes('invalid credentials')
        || message.includes('invalid password')
        || (message.includes('password') && message.includes('invalid'));
};

const rotateSessionCookie = async (res, userId, req) => {
    const serverClient = getAppwriteClient({ useApiKey: true });
    const users = new Users(serverClient);
    const nextSession = await users.createSession(userId);
    const token = getSessionSecret(nextSession);
    setSessionCookie(res, token, getAppContextFromRequest(req));
    return token;
};

// Update Account (Name only — email changes go through /request-email-change)
router.post('/update', loginRequired, async (req, res) => {
    const user = req.user;
    const { name, email } = req.body;

    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const users = new Users(serverClient);
        const databases = new Databases(serverClient);

        // Fetch fresh user data to ensure we have identities/status
        const userDetails = await users.get(user.$id);

        // 1. Update Name
        if (name && name !== userDetails.name) {
            await users.updateName(user.$id, name);
        }

        // 2. Email change is no longer handled here — redirect to the secure flow
        if (email && normalizeEmail(email) !== normalizeEmail(userDetails.email)) {
            return res.status(400).json({
                error: 'Email changes require verification. Please use the "Change Email" option to initiate a verified email change.',
                useEmailChangeFlow: true
            });
        }

        // 3. Update User Document (name only)
        const updateData = {};
        if (name) updateData.name = name;

        if (Object.keys(updateData).length > 0) {
            try {
                await databases.updateDocument(
                    APPWRITE_DATABASE_ID,
                    USERS_COLLECTION_ID,
                    user.$id,
                    updateData
                );
            } catch (dbErr) {
                if (dbErr.code === 404) {
                    // Create if missing
                    await databases.createDocument(
                        APPWRITE_DATABASE_ID,
                        USERS_COLLECTION_ID,
                        user.$id,
                        updateData
                    );
                } else {
                    console.error(`Failed to update user doc: ${dbErr.message}`);
                }
            }
        }

        res.json({ message: 'Account updated successfully' });

    } catch (err) {
        console.error(`Update Account Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to update account.' });
    }
});

// ==============================================================================
// REQUEST EMAIL CHANGE
// Creates a pending email-change token and sends a verification email.
// The email is NOT changed until the user clicks the verification link.
// ==============================================================================
router.post('/request-email-change', loginRequired, async (req, res) => {
    const user = req.user;
    const { newEmail, password } = req.body;

    if (!newEmail) return res.status(400).json({ error: 'New email address is required.' });
    if (!isValidEmail(newEmail)) return res.status(400).json({ error: 'Invalid email format.' });
    if (isDisposableEmail(newEmail)) return res.status(400).json({ error: 'Disposable email addresses are not allowed.' });

    const normalizedNew = normalizeEmail(newEmail);
    const normalizedCurrent = normalizeEmail(user.email);

    if (normalizedNew === normalizedCurrent) {
        return res.status(400).json({ error: 'New email is the same as your current email.' });
    }

    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const users = new Users(serverClient);
        const databases = new Databases(serverClient);

        // Fetch fresh user data
        const userDetails = await users.get(user.$id);

        // Require password for verified accounts
        const hasPassword = !!(userDetails.password || userDetails.passwordUpdate);
        if (!hasPassword) {
            return res.status(400).json({ error: 'Please set a password first before changing your email.' });
        }
        if (!password) {
            return res.status(400).json({ error: 'Password is required to request an email change.' });
        }

        // Verify password by attempting a temporary session
        try {
            const tempClient = getAppwriteClient();
            const tempAccount = new Account(tempClient);
            const validationSession = await tempAccount.createEmailPasswordSession(normalizedCurrent, password);
            // Immediately clean up the temporary session
            try {
                await users.deleteSession(user.$id, validationSession.$id);
            } catch (cleanupErr) {
                console.warn(`Temporary email-change password validation session cleanup failed: ${cleanupErr.message}`);
            }
        } catch (pwErr) {
            return res.status(401).json({ error: 'Invalid password.' });
        }

        // Check if new email is already in use by another account
        const existingUsers = await users.list([
            Query.equal('email', normalizedNew),
            Query.limit(5)
        ]);
        const conflictingUser = (existingUsers.users || []).find(
            (u) => String(u.$id) !== String(user.$id)
        );
        if (conflictingUser) {
            return res.status(409).json({ error: 'This email address is already in use by another account.' });
        }

        // Create the pending token
        const tokenDoc = await createEmailChangeToken(databases, {
            userId: user.$id,
            oldEmail: normalizedCurrent,
            newEmail: normalizedNew
        });

        // Send verification email
        await sendEmailChangeVerificationEmail({
            userId: user.$id,
            newEmail: normalizedNew,
            oldEmail: normalizedCurrent,
            token: tokenDoc.token
        });

        res.json({
            message: 'A verification link has been sent to your current email address. Please check your inbox to confirm the email change.',
            pendingEmail: normalizedNew
        });

    } catch (err) {
        console.error(`Request Email Change Error: ${err.message}`);
        if (err.message === 'Failed to send verification email. Please try again.') {
            return res.status(500).json({ error: err.message });
        }
        res.status(500).json({ error: 'Failed to initiate email change. Please try again.' });
    }
});

// ==============================================================================
// VERIFY EMAIL CHANGE
// Public endpoint (no session required) — called when user clicks the
// verification link in their email. Finalizes the email change.
// ==============================================================================
router.post('/verify-email-change', async (req, res) => {
    const { token } = req.body;

    if (!token) return res.status(400).json({ error: 'Verification token is required.' });

    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const users = new Users(serverClient);
        const databases = new Databases(serverClient);

        // 1. Look up the token
        const tokenDoc = await findTokenByValue(databases, token);

        // 2. Validate token status and expiry
        const validation = validateToken(tokenDoc);
        if (!validation.valid) {
            return res.status(validation.statusCode).json({ error: validation.error });
        }

        const { user_id: userId, old_email: oldEmail, new_email: newEmail } = tokenDoc;

        // 3. Confirm the account still exists
        let currentUser;
        try {
            currentUser = await users.get(userId);
        } catch (getUserErr) {
            if (getUserErr.code === 404) {
                await markTokenExpired(databases, tokenDoc.$id);
                return res.status(404).json({ error: 'The account associated with this request no longer exists.' });
            }
            throw getUserErr;
        }

        // 4. Race condition guard: check if the email was already changed
        const currentEmail = normalizeEmail(currentUser.email);
        if (currentEmail === normalizeEmail(newEmail)) {
            // Already changed (idempotent success)
            await markTokenUsed(databases, tokenDoc.$id);
            return res.json({ message: 'Your email address has already been updated to this address.', email: newEmail });
        }
        if (currentEmail !== normalizeEmail(oldEmail)) {
            // The email was changed to something else entirely
            await markTokenExpired(databases, tokenDoc.$id);
            return res.status(409).json({ error: 'Your email has been changed since this request was made. Please initiate a new email change.' });
        }

        // 5. Re-check email collision at verification time (another user may have taken it)
        const existingUsers = await users.list([
            Query.equal('email', normalizeEmail(newEmail)),
            Query.limit(5)
        ]);
        const conflictingUser = (existingUsers.users || []).find(
            (u) => String(u.$id) !== String(userId)
        );
        if (conflictingUser) {
            await markTokenExpired(databases, tokenDoc.$id);
            return res.status(409).json({ error: 'This email address is no longer available. Another account has claimed it.' });
        }

        // 6. Finalize: Update the email in Appwrite Auth
        await users.updateEmail(userId, normalizeEmail(newEmail));

        // 7. Mark email as verified
        try {
            await users.updateEmailVerification(userId, true);
        } catch (verifyErr) {
            console.warn(`Failed to mark email as verified for user ${userId}: ${verifyErr.message}`);
        }

        // 8. Update the users collection document
        try {
            await databases.updateDocument(
                APPWRITE_DATABASE_ID,
                USERS_COLLECTION_ID,
                userId,
                { email: normalizeEmail(newEmail) }
            );
        } catch (dbErr) {
            console.error(`Failed to update user document email for ${userId}: ${dbErr.message}`);
        }

        // 9. Unlink OAuth identities (Google etc.) since the email is changing
        let identitiesList = [];
        try {
            const result = await users.listIdentities([
                Query.equal('userId', userId)
            ]);
            identitiesList = result.identities || [];
        } catch (identErr) {
            console.warn(`Failed to list identities for user ${userId}: ${identErr.message}`);
        }

        if (identitiesList.length > 0) {
            for (const identity of identitiesList) {
                if (identity.provider !== 'email') {
                    try {
                        console.log(`Unlinking identity ${identity.provider} (${identity.$id}) for user ${userId} due to verified email change.`);
                        await users.deleteIdentity(identity.$id);
                    } catch (identityErr) {
                        console.warn(`Failed to delete identity ${identity.$id}: ${identityErr.message}`);
                    }
                }
            }
        }

        // 10. Mark the token as used
        await markTokenUsed(databases, tokenDoc.$id);

        // 11. Expire any other pending tokens for this user
        await expirePendingTokensForUser(databases, userId);

        // 12. De-authorize all active sessions for this user on the server (security best practice)
        try {
            await users.deleteSessions(userId);
        } catch (sessionErr) {
            console.warn(`Failed to delete active sessions for user ${userId}: ${sessionErr.message}`);
        }

        // 13. Clear session cookies for the client that triggered verification
        clearSessionCookie(res, 'frontend');
        clearSessionCookie(res, 'admin');

        console.log(`Email change finalized for user ${userId}: ${oldEmail} → ${newEmail}`);

        res.json({
            message: 'Your email address has been successfully updated. You can now log in with your new email.',
            email: normalizeEmail(newEmail)
        });

    } catch (err) {
        console.error(`Verify Email Change Error: ${err.message}`);
        res.status(500).json({ error: `Failed to verify email change. Reason: ${err.message}` });
    }
});

// Change Password
router.post('/change-password', loginRequired, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters long.' });

    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const users = new Users(serverClient);

        await users.updatePassword(req.user.$id, newPassword);
        await rotateSessionCookie(res, req.user.$id, req);

        res.json({ message: 'Password updated successfully.' });
    } catch (err) {
        console.error(`Change Password Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to update password.' });
    }
});

// Delete Account
router.delete('/delete', loginRequired, async (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required to delete account.' });

    try {
        const userId = String(req.user.$id);
        const userEmail = normalizeEmail(req.user.email);
        const tempClient = getAppwriteClient();
        const tempAccount = new Account(tempClient);
        const validationSession = await tempAccount.createEmailPasswordSession(userEmail, password);

        const serverClient = getAppwriteClient({ useApiKey: true });
        const users = new Users(serverClient);
        const databases = new Databases(serverClient);

        try {
            await users.deleteSession(userId, validationSession.$id);
        } catch (cleanupErr) {
            console.warn(`Temporary delete-account session cleanup failed: ${cleanupErr.message}`);
        }

        await cleanupUserOwnedData(databases, userId, { retainFinancialRecords: false });
        try {
            if (typeof users.deleteSessions === 'function') {
                await users.deleteSessions(userId);
            }
        } catch (sessionCleanupErr) {
            console.warn(`Delete-account session invalidation failed for user ${userId}: ${sessionCleanupErr.message}`);
        }
        await users.delete(userId);
        clearSessionCookie(res, getAppContextFromRequest(req));

        res.json({ message: 'Account deleted successfully' });

    } catch (err) {
        console.error(`Delete Account Error: ${err.message}`);
        if (isInvalidPasswordError(err)) return res.status(401).json({ error: 'Invalid password.' });
        res.status(500).json({ error: 'Failed to delete account.' });
    }
});

// Change Unverified Email
router.post('/change-unverified-email', loginRequired, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'New email is required.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email format.' });
    if (isDisposableEmail(email)) return res.status(400).json({ error: 'Disposable email addresses are not allowed.' });

    try {
        const normalized = normalizeEmail(email);
        const serverClient = getAppwriteClient({ useApiKey: true });
        const users = new Users(serverClient);

        await users.updateEmail(req.user.$id, normalized);

        // Update database user document for consistency
        const databases = new Databases(serverClient);
        try {
            await databases.updateDocument(
                APPWRITE_DATABASE_ID,
                USERS_COLLECTION_ID,
                req.user.$id,
                { email: normalized }
            );
        } catch (dbErr) {
            console.error(`Failed to update user doc in change-unverified-email: ${dbErr.message}`);
        }

        // Send verification
        const tempSession = await users.createSession(req.user.$id);
        const userClient = getAppwriteClient({ sessionToken: tempSession.secret });
        const userAccount = new Account(userClient);

        await userAccount.createVerification(`${process.env.FRONTEND_ORIGIN}/auth/verify`);
        await users.deleteSession(req.user.$id, tempSession.$id);

        res.json({ message: `Email changed to ${normalized}. A new verification link has been sent.` });

    } catch (err) {
        console.error(`Change Unverified Email Error: ${err.message}`);
        if (err.code === 409) return res.status(409).json({ error: 'Email already in use.' });
        res.status(500).json({ error: 'Failed to change email.' });
    }
});

// Resend Verification
router.post('/resend-verification', loginRequired, async (req, res) => {
    try {
        const userAccount = new Account(req.appwriteClient);
        await userAccount.createVerification(`${process.env.FRONTEND_ORIGIN}/auth/verify`);
        res.json({ message: 'A new verification email has been sent.' });
    } catch (err) {
        console.error(`Resend Verification Error: ${err.message}`);
        if (err.code === 429) return res.status(429).json({ error: 'A verification email was sent recently. Please wait a few minutes.' });
        res.status(500).json({ error: 'Failed to resend verification email.' });
    }
});

// Set Password (for OAuth users or those without one)
router.post('/set-password', loginRequired, async (req, res) => {
    const { password } = req.body;
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters long.' });

    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const users = new Users(serverClient);
        await users.updatePassword(req.user.$id, password);
        await rotateSessionCookie(res, req.user.$id, req);
        res.json({ message: 'Password set successfully' });
    } catch (err) {
        console.error(`Set Password Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to set password.' });
    }
});

// Check if has password
router.get('/has-password', loginRequired, async (req, res) => {
    const user = req.user;
    let hasPassword = !!(user.passwordUpdate && user.passwordUpdate !== '');
    if (!hasPassword && user.identities) {
        hasPassword = user.identities.some(id => id.provider === 'email');
    }
    res.json({ hasPassword });
});

module.exports = router;

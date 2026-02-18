const express = require('express');
const router = express.Router();
const { loginRequired } = require('../middleware/auth');
const { getAppwriteClient, USERS_COLLECTION_ID } = require('../utils/appwrite');
const { Account, Users, Databases, ID, Query } = require('node-appwrite');
const { isValidEmail, normalizeEmail, isDisposableEmail } = require('../utils/helpers');

// Update Account (Name, Email, Password verification)
router.post('/update', loginRequired, async (req, res) => {
    const user = req.user;
    const { name, email, password } = req.body;

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

        // 2. Update Email (Complex logic)
        let emailChanged = false;
        if (email && email !== userDetails.email) {
            if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email format.' });
            if (isDisposableEmail(email)) return res.status(400).json({ error: 'Disposable email addresses are not allowed.' });

            const normalized = normalizeEmail(email);

            const hasPassword = !!userDetails.password;
            if (!hasPassword) return res.status(400).json({ error: 'Please set a password first.' });
            if (!password) return res.status(400).json({ error: 'Password is required to change email.' });

            try {
                // Use user's own client to update email (requires password)
                // This ensures the password check is done by Appwrite
                // Account service in node-appwrite supports updateEmail(email, password)
                const userAccount = new Account(req.appwriteClient); // Uses header
                await userAccount.updateEmail(normalized, password);

                // Send Verification Email to new address
                try {
                    await userAccount.createVerification(`${process.env.FRONTEND_ORIGIN}/auth/verify`);
                } catch (verErr) {
                    console.warn(`Could not send verification email: ${verErr.message}`);
                }
                emailChanged = true;

            } catch (appwriteErr) {
                if (appwriteErr.code === 409) return res.status(409).json({ error: 'Email already in use.' });
                if (String(appwriteErr.message).toLowerCase().includes('password')) return res.status(401).json({ error: 'Invalid password.' });
                throw appwriteErr;
            }
        }

        // 3. Update User Document
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = normalizeEmail(email);

        if (Object.keys(updateData).length > 0) {
            try {
                await databases.updateDocument(
                    process.env.APPWRITE_DATABASE_ID,
                    USERS_COLLECTION_ID,
                    user.$id,
                    updateData
                );
            } catch (dbErr) {
                if (dbErr.code === 404) {
                    // Create if missing
                    await databases.createDocument(
                        process.env.APPWRITE_DATABASE_ID,
                        USERS_COLLECTION_ID,
                        user.$id,
                        updateData
                    );
                } else {
                    console.error(`Failed to update user doc: ${dbErr.message}`);
                }
            }
        }

        if (emailChanged) {
            return res.json({
                message: 'Email updated. Please check your inbox to verify your new email address.',
                emailChanged: true
            });
        }

        res.json({ message: 'Account updated successfully' });

    } catch (err) {
        console.error(`Update Account Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to update account.' });
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
        // Verify password manually via temporary login check
        // Account service doesn't have createEmailPasswordSession. Use Guest Client Call.
        const tempClient = getAppwriteClient();
        const userEmail = req.user.email;

        const tempSession = await tempClient.call(
            'post',
            new URL('account/sessions/email', process.env.APPWRITE_ENDPOINT),
            { 'content-type': 'application/json' },
            { email: userEmail, password: password }
        );

        // If successful, delete the temp session
        await tempClient.call(
            'delete',
            new URL(`account/sessions/${tempSession.$id}`, process.env.APPWRITE_ENDPOINT),
            { 'x-appwrite-session': tempSession.secret }
        );

        // Now delete the user
        const serverClient = getAppwriteClient({ useApiKey: true });
        const users = new Users(serverClient);

        await users.delete(req.user.$id);

        res.json({ message: 'Account deleted successfully' });

    } catch (err) {
        console.error(`Delete Account Error: ${err.message}`);
        if (err.code === 401 || err.code === 400) return res.status(401).json({ error: 'Invalid password.' });
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

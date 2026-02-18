const express = require('express');
const router = express.Router();
const { getAppwriteClient, USERS_COLLECTION_ID } = require('../utils/appwrite');
const { Account, Users, ID, Query, Databases, Permission, Role } = require('node-appwrite');
const { loginRequired } = require('../middleware/auth');
const { isValidEmail, normalizeEmail, isDisposableEmail } = require('../utils/helpers');

const processedOAuthSecrets = new Map(); // Cache for duplicate prevention

// Helper function: Manage user document on login
const manageUserOnLogin = async (user) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const existingDocs = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            USERS_COLLECTION_ID,
            [Query.equal('$id', user.$id)]
        );

        if (existingDocs.total === 0) {
            console.log(`Creating new user document for userId: ${user.$id}`);
            await databases.createDocument(
                process.env.APPWRITE_DATABASE_ID,
                USERS_COLLECTION_ID,
                user.$id,
                {
                    name: user.name || 'N/A',
                    email: user.email || 'N/A',
                },
                [
                    Permission.read(Role.user(user.$id)),
                    Permission.update(Role.user(user.$id))
                ]
            );
        } else {
            const docId = existingDocs.documents[0].$id;
            await databases.updateDocument(
                process.env.APPWRITE_DATABASE_ID,
                USERS_COLLECTION_ID,
                docId,
                {
                    name: user.name || 'N/A',
                    email: user.email || 'N/A',
                }
            );
        }
    } catch (err) {
        console.error(`Failed to manage user document: ${err.message}`);
    }
};

// Register Route
router.post('/api/register', async (req, res) => {
    const { email, password, name } = req.body;

    if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email format.' });
    if (isDisposableEmail(email)) return res.status(400).json({ error: 'Disposable email addresses are not allowed.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters long.' });

    const normalizedEmail = normalizeEmail(email);

    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const users = new Users(serverClient);

        // Create user
        const newUser = await users.create(ID.unique(), normalizedEmail, null, password, name);
        await users.updateLabels(newUser.$id, ['user']);

        // Send Verification Email
        const tempSession = await users.createSession(newUser.$id);
        const userClient = getAppwriteClient({ sessionToken: tempSession.secret });
        const userAccount = new Account(userClient);

        await userAccount.createVerification(`${process.env.FRONTEND_ORIGIN}/auth/verify`);

        await users.deleteSession(newUser.$id, tempSession.$id);

        await manageUserOnLogin(newUser);

        res.status(201).json({ message: 'Registration successful. Please check your email to verify your account.' });

    } catch (err) {
        if (err.code === 409) return res.status(409).json({ error: 'User with this email already exists.' });
        console.error(`Error during registration: ${err.message}`);
        res.status(500).json({ error: 'Registration failed.' });
    }
});

// Login Route
router.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const normalizedEmail = normalizeEmail(email);

    try {
        // Step 1: Verify credentials by attempting to create a session manually
        const tempClient = getAppwriteClient();

        const validationSession = await tempClient.call(
            'post',
            new URL('account/sessions/email', process.env.APPWRITE_ENDPOINT),
            { 'content-type': 'application/json' },
            { email: normalizedEmail, password: password }
        );

        const userId = validationSession.userId;
        const sessionId = validationSession.$id;

        const serverClient = getAppwriteClient({ useApiKey: true });
        const users = new Users(serverClient);

        await users.deleteSession(userId, sessionId);

        // Check user status (disabled?)
        const user = await users.get(userId);
        if (!user.status) return res.status(403).json({ error: 'Account is disabled.' });

        // Step 2: Create a secure Admin-generated session
        const session = await users.createSession(userId);
        const token = session.secret;

        await manageUserOnLogin(user);

        res.cookie('session_token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'Lax',
            maxAge: 1000 * 60 * 60 * 24 * 30 // 30 days
        });

        res.json({ token });

    } catch (err) {
        console.error(`Login failed: ${err.message}`);
        if (err.code === 401 || err.code === 400) return res.status(401).json({ error: 'Invalid email or password.' });
        if (err.code === 429) return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
        res.status(500).json({ error: 'An unexpected error occurred during login.' });
    }
});

// Logout Route
router.get('/logout', async (req, res) => {
    let sessionToken = req.cookies.session_token || req.headers.authorization?.split(' ')[1];

    if (sessionToken) {
        try {
            const client = getAppwriteClient({ sessionToken });
            await client.call('delete', new URL('account/sessions/current', process.env.APPWRITE_ENDPOINT));
        } catch (e) {
            // Ignore errors
        }
    }

    res.clearCookie('session_token');
    res.json({ message: 'Logged out' });
});

// Get Current User (Me)
router.get('/api/me', loginRequired, async (req, res) => {
    try {
        const user = { ...req.user };
        const passwordUpdate = user.passwordUpdate;
        let hasPassword = !!(passwordUpdate && passwordUpdate !== '');

        if (!hasPassword && user.identities) {
            hasPassword = user.identities.some(id => id.provider === 'email');
        }

        user.hasPassword = hasPassword;

        const { IG_ACCOUNTS_COLLECTION_ID } = require('../utils/appwrite');
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const igAccounts = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            [Query.equal('user_id', user.$id)]
        );

        user.hasLinkedInstagram = igAccounts.total > 0;
        if (igAccounts.total > 0) {
            const primaryIg = igAccounts.documents[0];
            user.instagram_username = primaryIg.username;
            user.instagram_profile_pic_url = primaryIg.profile_picture_url;
            user.ig_accounts = igAccounts.documents;
        } else {
            user.instagram_username = null;
            user.instagram_profile_pic_url = null;
            user.ig_accounts = [];
        }

        res.json(user);

    } catch (err) {
        console.error(`Error in /me: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

// Google Auth URL
router.get('/auth/google', async (req, res) => {
    try {
        const endpoint = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
        const project = process.env.APPWRITE_PROJECT_ID;
        const success = `${process.env.FRONTEND_ORIGIN}/auth/callback`;
        const failure = `${process.env.FRONTEND_ORIGIN}/login?error=oauth_failed`;

        const url = `${endpoint}/account/sessions/oauth2/google?project=${project}&success=${encodeURIComponent(success)}&failure=${encodeURIComponent(failure)}`;

        res.json({ url });
    } catch (err) {
        console.error(`Google Auth Error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Google OAuth Callback
router.get('/api/auth/google-callback', async (req, res) => {
    const { userId, secret } = req.query;

    if (!userId || !secret) return res.status(400).json({ error: 'Missing userId or secret' });

    // Duplicate Check
    const cacheKey = `${userId}:${secret.substring(0, 16)}`;
    if (processedOAuthSecrets.has(cacheKey)) {
        const cached = processedOAuthSecrets.get(cacheKey);
        if (cached) {
            console.log(`Returning cached token for user ${userId}`);
            return res.json({ token: cached });
        } else {
            return res.status(400).json({ error: 'This OAuth session has already been processed.' });
        }
    }

    try {
        // Exchange secret for session
        const guestClient = getAppwriteClient();

        // POST /account/sessions (exchanges secret for session)
        const session = await guestClient.call(
            'post',
            new URL('account/sessions', process.env.APPWRITE_ENDPOINT),
            { 'content-type': 'application/json' },
            { userId, secret }
        );

        const sessionToken = session.secret;

        // Verify User details
        const userClient = getAppwriteClient({ sessionToken });
        const userAccount = new Account(userClient);
        const user = await userAccount.get();

        const serverClient = getAppwriteClient({ useApiKey: true });
        const users = new Users(serverClient);

        const email = user.email;
        if (email) {
            if (isDisposableEmail(email)) {
                console.warn(`Blocking disposable email: ${email}`);
                await users.delete(userId);
                processedOAuthSecrets.set(cacheKey, null);
                return res.status(400).json({ error: 'Disposable email addresses are not allowed.' });
            }

            const userList = await users.list([Query.equal('email', email)]);
            if (userList.total > 1) {
                const sorted = userList.users.sort((a, b) => new Date(a.registration) - new Date(b.registration));
                const original = sorted[0];

                if (original.$id !== userId) {
                    console.warn(`Duplicate account for ${email}. Deleting new user ${userId}`);
                    await users.delete(userId);
                    processedOAuthSecrets.set(cacheKey, null);
                    return res.status(409).json({ error: 'An account with this email already exists. Please log in with your password.' });
                }
            }
        }

        await manageUserOnLogin(user);

        processedOAuthSecrets.set(cacheKey, sessionToken);

        res.cookie('session_token', sessionToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'Lax',
            maxAge: 1000 * 60 * 60 * 24 * 30
        });

        res.json({ token: sessionToken });

    } catch (err) {
        processedOAuthSecrets.set(cacheKey, null);
        console.error(`Google Callback Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to create session from Google OAuth.' });
    }
});

// Verification Callback
router.post('/api/auth/verify-callback', async (req, res) => {
    const { userId, secret } = req.body;
    if (!userId || !secret) return res.status(400).json({ error: 'Missing userId or secret' });

    try {
        const guestClient = getAppwriteClient();
        await guestClient.call(
            'put',
            new URL('account/verification', process.env.APPWRITE_ENDPOINT),
            { 'content-type': 'application/json' },
            { userId, secret }
        );

        // Create Session
        const serverClient = getAppwriteClient({ useApiKey: true });
        const users = new Users(serverClient);
        const session = await users.createSession(userId);

        res.json({ token: session.secret });

    } catch (err) {
        console.error(`Verification Callback Error: ${err.message}`);
        res.status(401).json({ error: 'Invalid or expired verification link.' });
    }
});

// Forgot Password
router.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const normalizedEmail = normalizeEmail(email);

    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const users = new Users(serverClient);

        const userList = await users.list([Query.equal('email', normalizedEmail)]);
        if (userList.total === 0) {
            return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
        }

        const guestClient = getAppwriteClient();
        await guestClient.call(
            'post',
            new URL('account/recovery', process.env.APPWRITE_ENDPOINT),
            { 'content-type': 'application/json' },
            { email: normalizedEmail, url: `${process.env.FRONTEND_ORIGIN}/auth/recovery` }
        );

        res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });

    } catch (err) {
        console.error(`Forgot Password Error: ${err.message}`);
        res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }
});

// Password Recovery Callback
router.post('/api/auth/recovery', async (req, res) => {
    const { userId, secret, newPassword, confirmPassword } = req.body;

    if (!userId || !secret) return res.status(400).json({ error: 'Missing userId or secret' });
    if (!newPassword || !confirmPassword) return res.status(400).json({ error: 'Password is required' });
    if (newPassword !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });

    try {
        const guestClient = getAppwriteClient();
        await guestClient.call(
            'put',
            new URL('account/recovery', process.env.APPWRITE_ENDPOINT),
            { 'content-type': 'application/json' },
            { userId, secret, password: newPassword, passwordAgain: confirmPassword }
        );

        res.json({ message: 'Password reset successful. You can now log in with your new password.' });

    } catch (err) {
        console.error(`Recovery Error: ${err.message}`);
        res.status(401).json({ error: 'Invalid or expired recovery link.' });
    }
});

module.exports = router;

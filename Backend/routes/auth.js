const express = require('express');
const router = express.Router();
const { getAppwriteClient, USERS_COLLECTION_ID } = require('../utils/appwrite');
const { Account, Users, ID, Query, Databases, Permission, Role } = require('node-appwrite');
const { loginRequired } = require('../middleware/auth');
const { isValidEmail, normalizeEmail, isDisposableEmail } = require('../utils/helpers');
const {
    getAppContextFromRequest,
    normalizeAppContext,
    getSessionTokenFromRequest,
    setSessionCookie,
    clearSessionCookie
} = require('../utils/sessionContext');
const {
    createServerDatabases,
    loadUserAccessState,
    buildAccessDeniedPayload
} = require('../utils/accessControl');
const { ensureUserActivityDocument } = require('../utils/userActivity');
const { resolveUserPlanContext } = require('../utils/planConfig');
const { recomputeAccountAccessStateForUser } = require('../utils/accountAccess');

const processedOAuthSecrets = new Map(); // Cache for duplicate prevention
const OAUTH_CACHE_TTL_MS = 60_000; // 60 seconds

const setOAuthCache = (key, value) => {
    processedOAuthSecrets.set(key, value);
    setTimeout(() => processedOAuthSecrets.delete(key), OAUTH_CACHE_TTL_MS);
};

// Helper: get session secret (handles both object and dict-like responses)
const getSessionSecret = (session) => {
    return session.secret || session['secret'] || '';
};

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');

const buildRequestOrigin = (req) => {
    const protocolHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const hostHeader = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
    const protocol = protocolHeader || req.protocol || 'https';

    if (!hostHeader) return '';
    return `${protocol}://${hostHeader}`.replace(/\/+$/, '');
};

const getAllowedOAuthOrigins = () => (
    [
        process.env.FRONTEND_ORIGIN,
        process.env.ADMIN_PANEL_ORIGIN,
        ...(String(process.env.ADDITIONAL_OAUTH_ORIGINS || '')
            .split(',')
            .map(normalizeOrigin)
            .filter(Boolean))
    ]
        .map(normalizeOrigin)
        .filter(Boolean)
);

const resolveOAuthOrigin = (req) => {
    const requestedOrigin = normalizeOrigin(req.query.redirect_origin);
    const target = String(req.query.target || '').trim().toLowerCase();
    const allowedOrigins = getAllowedOAuthOrigins();

    if (requestedOrigin && allowedOrigins.includes(requestedOrigin)) {
        return requestedOrigin;
    }

    if (target === 'admin') {
        return normalizeOrigin(process.env.ADMIN_PANEL_ORIGIN) || normalizeOrigin(process.env.FRONTEND_ORIGIN);
    }

    return normalizeOrigin(process.env.FRONTEND_ORIGIN) || normalizeOrigin(process.env.ADMIN_PANEL_ORIGIN);
};

const resolveOAuthClientOrigin = (req) => {
    const requestedOrigin = normalizeOrigin(req.query.redirect_origin);
    const target = normalizeAppContext(req.query.target || getAppContextFromRequest(req));
    const configuredOrigin = target === 'admin'
        ? normalizeOrigin(process.env.ADMIN_PANEL_ORIGIN)
        : normalizeOrigin(process.env.FRONTEND_ORIGIN);

    if (configuredOrigin) {
        return configuredOrigin;
    }

    if (requestedOrigin) {
        const allowedOrigins = getAllowedOAuthOrigins();
        if (allowedOrigins.includes(requestedOrigin)) {
            return requestedOrigin;
        }
    }

    return resolveOAuthOrigin(req);
};

const buildOAuthReturnUrl = (origin, pathname, query = {}) => {
    const targetUrl = new URL(`${normalizeOrigin(origin)}${pathname}`);
    Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') {
            targetUrl.searchParams.set(key, String(value));
        }
    });
    return targetUrl.toString();
};

// Helper function: Manage user document on login
// Matches Python's manage_user_on_login() exactly
const manageUserOnLogin = async (user) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        console.log(`Refreshing login activity for userId: ${user.$id}`);
        await ensureUserActivityDocument(user, {
            databases,
            markLogin: true,
            clearCleanupState: true
        });
    } catch (err) {
        console.error(`Failed to manage user document: ${err.message}`);
    }
};

const hasFrontendUserDocument = async (databases, userId) => {
    const existingDocs = await databases.listDocuments(
        process.env.APPWRITE_DATABASE_ID,
        USERS_COLLECTION_ID,
        [Query.equal('$id', String(userId)), Query.limit(1)]
    );

    return existingDocs.total > 0;
};

const enforceLoginAccess = async (userId, options = {}) => {
    const databases = createServerDatabases();
    const { accessState } = await loadUserAccessState(databases, userId);
    const appContext = normalizeAppContext(options.appContext || 'frontend');
    const labels = Array.isArray(options.labels) ? options.labels : [];
    const adminOverrideAllowed = appContext === 'admin' && labels.includes('admin');

    if (accessState.is_hard_banned && !adminOverrideAllowed) {
        const error = new Error(accessState.ban_message || 'Your account has been blocked.');
        error.statusCode = 403;
        error.payload = buildAccessDeniedPayload(accessState, accessState.ban_message || 'Your account has been blocked.');
        throw error;
    }
    return accessState;
};

const enforceAppContextAccess = (appContext, labels = []) => {
    const normalizedContext = normalizeAppContext(appContext);
    if (normalizedContext === 'admin' && !labels.includes('admin')) {
        const error = new Error('Only users with the admin label can access this dashboard.');
        error.statusCode = 403;
        error.payload = { error: 'Only users with the admin label can access this dashboard.' };
        throw error;
    }
};

const findUsersByNormalizedEmail = async (users, email, options = {}) => {
    const normalizedTarget = normalizeEmail(email);
    const excludeUserId = String(options.excludeUserId || '').trim();
    const matches = [];

    // 1. Primary Indexed Query: Try direct Appwrite query (O(1) / O(log N) scalable lookup)
    try {
        const directResponse = await users.list([
            Query.equal('email', normalizedTarget),
            Query.limit(10)
        ]);
        const directUsers = Array.isArray(directResponse?.users) ? directResponse.users : [];
        for (const candidate of directUsers) {
            const candidateId = String(candidate?.$id || '').trim();
            if (excludeUserId && candidateId === excludeUserId) continue;
            matches.push(candidate);
        }
        if (matches.length > 0) {
            return matches;
        }
    } catch (queryErr) {
        console.warn(`Direct email query on Appwrite users failed, falling back to paginated scan: ${queryErr.message}`);
    }

    // 2. Secondary Fallback Query: Try with the literal raw email address (in case normalization altered it)
    try {
        const rawEmail = String(email || '').trim();
        if (rawEmail && rawEmail.toLowerCase() !== normalizedTarget) {
            const directResponse = await users.list([
                Query.equal('email', rawEmail),
                Query.limit(10)
            ]);
            const directUsers = Array.isArray(directResponse?.users) ? directResponse.users : [];
            for (const candidate of directUsers) {
                const candidateId = String(candidate?.$id || '').trim();
                if (excludeUserId && candidateId === excludeUserId) continue;
                // Double check normalization match
                if (normalizeEmail(candidate?.email || '') === normalizedTarget) {
                    matches.push(candidate);
                }
            }
            if (matches.length > 0) {
                return matches;
            }
        }
    } catch (rawQueryErr) {
        console.warn(`Raw email query on Appwrite users failed: ${rawQueryErr.message}`);
    }

    // 3. Last Resort Fallback (Paging through first 5000 users)
    const limit = 100;
    let offset = 0;

    while (offset < 5000) {
        const response = await users.list([Query.limit(limit), Query.offset(offset)]);
        const pageUsers = Array.isArray(response?.users) ? response.users : [];

        for (const candidate of pageUsers) {
            const candidateId = String(candidate?.$id || '').trim();
            const candidateEmail = normalizeEmail(candidate?.email || '');
            if (!candidateEmail || candidateEmail !== normalizedTarget) continue;
            if (excludeUserId && candidateId === excludeUserId) continue;
            matches.push(candidate);
        }

        if (pageUsers.length < limit) break;
        offset += limit;
    }

    return matches;
};

// ==============================================================================
// REGISTER
// Matches Python: @app.route('/api/register', methods=['POST'])
// ==============================================================================
router.post('/api/register', async (req, res) => {
    const { email, password, name } = req.body;

    if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email format.' });
    if (isDisposableEmail(email)) return res.status(400).json({ error: 'Disposable email addresses are not allowed.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters long.' });

    const normalizedEmail = normalizeEmail(email);

    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const users = new Users(serverClient);
        const existingUsers = await findUsersByNormalizedEmail(users, normalizedEmail);

        if (existingUsers.length > 0) {
            return res.status(409).json({ error: 'User with this email already exists.' });
        }

        // Create user
        const newUser = await users.create(ID.unique(), normalizedEmail, null, password, name);

        // Assign 'user' label for RLS
        try {
            await users.updateLabels(newUser.$id, ['user']);
        } catch (labelError) {
            console.error(`Failed to assign 'user' label: ${labelError.message}`);
        }

        // Send Verification Email:
        // 1. Create a temporary session for the new user
        // 2. Use that session to create a client and send the verification
        // 3. Delete the temporary session immediately
        const tempSession = await users.createSession(newUser.$id);
        const userClient = getAppwriteClient({ sessionToken: tempSession.secret });
        const userAccount = new Account(userClient);

        // Send verification email from user's perspective
        await userAccount.createVerification(`${process.env.FRONTEND_ORIGIN}/auth/verify`);

        // IMPORTANT: Immediately delete the temporary session
        await userAccount.deleteSession('current');

        // Create user document in our 'users' collection
        await manageUserOnLogin(newUser);

        res.status(201).json({ message: 'Registration successful. Please check your email to verify your account.' });

    } catch (err) {
        if (err.code === 409) return res.status(409).json({ error: 'User with this email already exists.' });
        console.error(`Error during registration: ${err.message}`);
        res.status(500).json({ error: 'Registration failed.' });
    }
});

// ==============================================================================
// LOGIN
// Matches Python: @app.route('/api/login', methods=['POST'])
// ==============================================================================
router.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const appContext = getAppContextFromRequest(req);
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const normalizedEmail = normalizeEmail(email);

    // Debug: Check user status via Admin API (matches Python)
    let user;
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const users = new Users(serverClient);
        const userDocs = await users.list([Query.equal('email', normalizedEmail)]);

        if (!userDocs.users || userDocs.users.length === 0) {
            console.warn(`Login failed: User ${normalizedEmail} not found in Appwrite.`);
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        user = userDocs.users[0];
        console.log(`User found: ${user.$id}, Status: ${user.status}, EmailVerification: ${user.emailVerification}`);

        if (!user.status) {
            return res.status(403).json({ error: 'Account is disabled.' });
        }
    } catch (e) {
        console.error(`Admin check failed: ${e.message}`);
    }

    // Attempt Login
    try {
        // Step 1: Verify credentials by attempting to create a session
        const tempClient = getAppwriteClient();
        const tempAccount = new Account(tempClient);
        const validationSession = await tempAccount.createEmailPasswordSession(normalizedEmail, password);

        // If we reach here, the password is valid.
        // Immediately delete the temporary session via Admin API (session secret is not returned)
        try {
            const adminClient = getAppwriteClient({ useApiKey: true });
            const adminUsers = new Users(adminClient);
            await adminUsers.deleteSession(user.$id, validationSession.$id);
        } catch (delErr) {
            console.warn(`Could not delete temporary validation session: ${delErr.message}`);
        }

        // Step 2: Use ADMIN client to create a new, clean session
        const userId = user.$id;
        const serverClient = getAppwriteClient({ useApiKey: true });
        const users = new Users(serverClient);
        const labels = Array.isArray(user?.labels) ? user.labels : [];

        enforceAppContextAccess(appContext, labels);

        const newSession = await users.createSession(userId);
        const token = getSessionSecret(newSession);

        // Step 3: Manage user document
        await manageUserOnLogin(user);
        try {
            await enforceLoginAccess(userId, {
                appContext,
                labels
            });
        } catch (accessError) {
            try {
                await users.deleteSession(userId, newSession.$id);
            } catch (_) {
                // Best effort cleanup for denied login.
            }
            throw accessError;
        }

        setSessionCookie(res, token, appContext);

        res.json({ token });

    } catch (err) {
        console.error(`Login failed: ${err.message}, Code: ${err.code}`);

        if (err?.statusCode === 403 && err?.payload) {
            return res.status(403).json(err.payload);
        }

        if (err.code === 429) return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
        if (err.code === 401) return res.status(401).json({ error: 'Invalid email or password.' });

        res.status(500).json({ error: 'An unexpected error occurred during login.' });
    }
});

// ==============================================================================
// GET CURRENT USER (/api/me)
// Matches Python: @app.route('/api/me', methods=['GET'])
// ==============================================================================
router.get('/api/me', loginRequired, async (req, res) => {
    try {
        const user = { ...req.user };
        const passwordUpdate = user.passwordUpdate;
        let hasPassword = !!(passwordUpdate && passwordUpdate !== '');

        if (!hasPassword && user.identities) {
            hasPassword = user.identities.some(id => id.provider === 'email');
        }

        user.hasPassword = hasPassword;

        // Check for linked Instagram accounts
        const { IG_ACCOUNTS_COLLECTION_ID } = require('../utils/appwrite');
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const planContext = await resolveUserPlanContext(databases, user.$id, user);

        const igAccounts = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            [Query.equal('user_id', user.$id)]
        );
        const accountAccessState = await recomputeAccountAccessStateForUser(
            databases,
            user.$id,
            planContext.profile,
            igAccounts.documents || []
        );
        const normalizedAccounts = accountAccessState.accounts || [];

        user.hasLinkedInstagram = Number(accountAccessState.summary?.total_linked_accounts || 0) > 0;
        user.access_state = req.accessState || null;
        user.total_linked_accounts = Number(accountAccessState.summary?.total_linked_accounts || 0);
        user.max_allowed_accounts = Number(accountAccessState.summary?.max_allowed_accounts || 0);
        user.active_account_limit = Number(accountAccessState.summary?.active_account_limit || 0);
        if (normalizedAccounts.length > 0) {
            const primaryIg = normalizedAccounts[0];
            user.instagram_username = primaryIg.username;
            user.instagram_profile_pic_url = primaryIg.profile_picture_url;
            user.ig_accounts = normalizedAccounts;
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

// ==============================================================================
// LOGOUT
// Matches Python: @app.route('/logout')
// ==============================================================================
router.get('/logout', async (req, res) => {
    const appContext = getAppContextFromRequest(req);
    let sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            sessionToken = authHeader.split(' ')[1];
        }
    }

    if (sessionToken) {
        try {
            const client = getAppwriteClient({ sessionToken });
            const account = new Account(client);
            await account.deleteSession('current');
        } catch (e) {
            // Ignore errors (matches Python: except AppwriteException: pass)
        }
    }

    clearSessionCookie(res, appContext);
    res.json({ message: 'Logged out' });
});

// ==============================================================================
// GOOGLE AUTH URL
// Matches Python: @app.route('/auth/google')
// Uses account.createOAuth2Token() — the EXACT same SDK method as Python's
// account.create_o_auth2_token()
// ==============================================================================
router.get('/auth/google', async (req, res) => {
    try {
        const client = getAppwriteClient();
        const account = new Account(client);
        const origin = resolveOAuthClientOrigin(req);
        const appContext = normalizeAppContext(req.query.target || getAppContextFromRequest(req));
        const frontendBridgeOrigin = normalizeOrigin(process.env.FRONTEND_ORIGIN) || origin;
        const callbackOrigin = appContext === 'admin' ? frontendBridgeOrigin : origin;

        if (!origin || !callbackOrigin) {
            return res.status(500).json({ error: 'OAuth origin is not configured.' });
        }

        const redirectUrl = await account.createOAuth2Token(
            'google',
            buildOAuthReturnUrl(callbackOrigin, '/auth/callback', {
                target: appContext,
                redirect_origin: origin
            }),
            buildOAuthReturnUrl(callbackOrigin, '/auth/callback', {
                target: appContext,
                redirect_origin: origin,
                error: 'oauth_failed'
            })
        );

        res.json({ url: redirectUrl });
    } catch (err) {
        console.error(`Google Auth Error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/auth/google-redirect', async (req, res) => {
    const origin = resolveOAuthOrigin(req);
    const userId = String(req.query.userId || '');
    const secret = String(req.query.secret || '');

    if (!origin || !userId || !secret) {
        return res.redirect(buildOAuthReturnUrl(
            normalizeOrigin(process.env.FRONTEND_ORIGIN) || normalizeOrigin(process.env.ADMIN_PANEL_ORIGIN) || '',
            '/login',
            { error: 'oauth_failed' }
        ));
    }

    return res.redirect(buildOAuthReturnUrl(origin, '/auth/callback', { userId, secret }));
});

router.get('/api/auth/google-failure', async (req, res) => {
    const origin = resolveOAuthOrigin(req)
        || normalizeOrigin(process.env.FRONTEND_ORIGIN)
        || normalizeOrigin(process.env.ADMIN_PANEL_ORIGIN);

    if (!origin) {
        return res.status(500).json({ error: 'OAuth origin is not configured.' });
    }

    return res.redirect(buildOAuthReturnUrl(origin, '/login', { error: 'oauth_failed' }));
});

// ==============================================================================
// GOOGLE OAUTH CALLBACK
// Matches Python: @app.route('/api/auth/google-callback', methods=['GET'])
// Uses account.createSession(userId, secret) with SERVER (API key) client
// ==============================================================================
router.get('/api/auth/google-callback', async (req, res) => {
    const userId = req.query.userId;
    const secret = req.query.secret;
    const appContext = normalizeAppContext(req.query.target || getAppContextFromRequest(req));

    if (!process.env.APPWRITE_API_KEY) {
        console.error("CRITICAL: APPWRITE_API_KEY is not set!");
        return res.status(500).json({ error: 'Server configuration error.' });
    }

    if (!secret || !userId) {
        return res.status(400).json({ error: 'Missing userId or secret' });
    }

    // Duplicate request protection with concurrency lock
    const cacheKey = `${userId}:${secret.substring(0, 16)}`;
    if (processedOAuthSecrets.has(cacheKey)) {
        let cachedToken = processedOAuthSecrets.get(cacheKey);
        
        // If another request is currently processing this session, wait for it
        if (cachedToken === 'processing') {
            for (let i = 0; i < 25; i++) {
                await new Promise(resolve => setTimeout(resolve, 200));
                cachedToken = processedOAuthSecrets.get(cacheKey);
                if (cachedToken !== 'processing') break;
            }
        }

        if (cachedToken && cachedToken !== 'processing') {
            setSessionCookie(res, cachedToken, appContext);
            return res.json({ token: cachedToken });
        } else {
            return res.status(400).json({ error: 'This OAuth session has already been processed or failed.' });
        }
    }

    // Set lock state immediately
    setOAuthCache(cacheKey, 'processing');

    try {
        // Use a server-side client with API key to create the session
        // This EXACTLY matches Python: server_client = get_appwrite_client(use_api_key=True)
        const serverClient = getAppwriteClient({ useApiKey: true });
        const account = new Account(serverClient);
        const users = new Users(serverClient);

        // Create a session for the user using the secret from the OAuth flow
        // Matches Python: session = account.create_session(user_id, secret)
        const session = await account.createSession(userId, secret);
        const sessionToken = getSessionSecret(session);

        // Get the user details using the new session
        const userClient = getAppwriteClient({ sessionToken });
        const user = await new Account(userClient).get();

        const currentUserId = user.$id;
        const labels = Array.isArray(user.labels) ? user.labels : [];
        const databases = new Databases(serverClient);

        // Find the actual Google email from identities if possible, fallback to user.email
        let oauthProviderEmail = null;
        if (user.identities && Array.isArray(user.identities)) {
            const googleIdentity = user.identities.find(id => id.provider === 'google');
            if (googleIdentity) {
                oauthProviderEmail = googleIdentity.providerEmail || googleIdentity.email || null;
            }
        }
        const normalizedOAuthEmail = normalizeEmail(oauthProviderEmail || user.email || '');
        const email = oauthProviderEmail || user.email;

        // Verify that the email returned by Google matches the email currently in their profile database.
        // If the user changed their email, the old Google account should no longer log them in.
        let databaseUser = null;
        try {
            databaseUser = await databases.getDocument(
                process.env.APPWRITE_DATABASE_ID,
                USERS_COLLECTION_ID,
                currentUserId
            );
        } catch (dbErr) {
            // Document might not exist if this is a brand new user signing up for the first time
        }

        if (databaseUser && databaseUser.email) {
            const currentDbEmail = normalizeEmail(databaseUser.email);
            if (currentDbEmail !== normalizedOAuthEmail) {
                console.log(`Google email ${normalizedOAuthEmail} does not match profile email ${currentDbEmail} for userId ${currentUserId}. Re-linking to a new/correct account...`);
                
                // Dissociate the Google identity from this account since they don't match,
                // so that the next time the user tries to sign in, it will create a new account.
                try {
                    if (user.identities && Array.isArray(user.identities)) {
                        for (const identity of user.identities) {
                            if (identity.provider === 'google') {
                                console.log(`Unlinking mismatching Google identity ${identity.$id} from user ${currentUserId} due to email discrepancy.`);
                                await users.deleteIdentity(currentUserId, identity.$id);
                            }
                        }
                    }
                } catch (unlinkErr) {
                    console.warn(`Failed to unlink mismatching Google identity: ${unlinkErr.message}`);
                }

                try {
                    await users.deleteSession(currentUserId, session.$id);
                } catch (cleanupErr) {
                    console.warn(`Failed to clean up Google OAuth session: ${cleanupErr.message}`);
                }

                // Check if a user with normalizedOAuthEmail already exists
                let targetUser = null;
                const existingTargetUsers = await findUsersByNormalizedEmail(users, normalizedOAuthEmail);
                if (existingTargetUsers.length > 0) {
                    targetUser = existingTargetUsers[0];
                    console.log(`Found existing user ${targetUser.$id} matching Google email ${normalizedOAuthEmail}.`);
                } else {
                    console.log(`Creating new user account for Google email ${normalizedOAuthEmail}...`);
                    targetUser = await users.create(ID.unique(), normalizedOAuthEmail, null, null, user.name);
                    try {
                        await users.updateLabels(targetUser.$id, ['user']);
                    } catch (labelError) {
                        console.error(`Failed to assign 'user' label to new OAuth user: ${labelError.message}`);
                    }
                }

                // Create a session for the target/new user account
                const nextSession = await users.createSession(targetUser.$id);
                const nextToken = getSessionSecret(nextSession);

                // Manage user document and set session cookie
                await manageUserOnLogin(targetUser);
                setSessionCookie(res, nextToken, appContext);
                setOAuthCache(cacheKey, nextToken);

                return res.json({ token: nextToken });
            }
        }

        if (email) {
            // 1. Strict Check: Disposable Email
            if (isDisposableEmail(email)) {
                console.warn(`Blocking disposable email login: ${email}`);
                await users.delete(currentUserId);
                setOAuthCache(cacheKey, null);
                return res.status(400).json({ error: 'Disposable email addresses are not allowed.' });
            }

            // 2. Strict Check: Duplicate Account Prevention
            const duplicateUsers = await findUsersByNormalizedEmail(users, normalizedOAuthEmail, { excludeUserId: currentUserId });

            if (duplicateUsers.length > 0) {
                const originalUser = duplicateUsers
                    .sort((a, b) => String(a.registration || '').localeCompare(String(b.registration || '')))[0];

                console.warn(`User ${currentUserId} is a duplicate of ${originalUser.$id}. Deleting new user.`);
                await users.delete(currentUserId);
                setOAuthCache(cacheKey, null);
                return res.status(409).json({ error: 'An account with this email already exists. Please log in with your password.' });
            }
        }

        if (appContext === 'admin' && !labels.includes('admin')) {
            const existsOnFrontend = await hasFrontendUserDocument(databases, currentUserId);

            try {
                await users.deleteSession(currentUserId, session.$id);
            } catch (cleanupErr) {
                console.warn(`Failed to remove denied admin OAuth session for ${currentUserId}: ${cleanupErr.message}`);
            }

            if (!existsOnFrontend) {
                console.warn(`Deleting non-frontend Google auth user ${currentUserId} after denied admin access.`);
                await users.delete(currentUserId);
                setOAuthCache(cacheKey, null);
                return res.status(403).json({ error: 'This Google account is not registered for DM Panda. Please sign up on the frontend first.' });
            }

            setOAuthCache(cacheKey, null);
            return res.status(403).json({ error: 'Only users with the admin label can access this dashboard.' });
        }

        await manageUserOnLogin(user);
        try {
            await enforceLoginAccess(currentUserId, {
                appContext,
                labels
            });
        } catch (accessError) {
            try {
                await users.deleteSession(currentUserId, session.$id);
            } catch (_) {
                // Best effort cleanup for denied OAuth login.
            }
            throw accessError;
        }

        // Cache the token for duplicate request protection
        setOAuthCache(cacheKey, sessionToken);

        setSessionCookie(res, sessionToken, appContext);
        res.json({ token: sessionToken });

    } catch (err) {
        setOAuthCache(cacheKey, null);
        console.error(`Google callback API error: ${err.message}, Code: ${err.code}`);
        if (err?.statusCode === 403 && err?.payload) {
            return res.status(403).json(err.payload);
        }
        res.status(500).json({ error: 'Failed to create session from Google OAuth.' });
    }
});

// ==============================================================================
// EMAIL VERIFICATION CALLBACK
// Matches Python: @app.route('/api/auth/verify-callback', methods=['POST'])
// ==============================================================================
router.post('/api/auth/verify-callback', async (req, res) => {
    const { userId, secret } = req.body;
    if (!userId || !secret) return res.status(400).json({ error: 'Missing user ID or secret' });

    try {
        // Use a guest client to validate the secret, avoiding API key mismatch issues
        const guestClient = getAppwriteClient({ useApiKey: false });
        const guestAccount = new Account(guestClient);
        const serverClient = getAppwriteClient({ useApiKey: true });
        const users = new Users(serverClient);

        // Validate the verification secret
        await guestAccount.updateVerification({ userId, secret });

        // Create a new session for the user
        const session = await users.createSession(userId);
        const token = getSessionSecret(session);

        setSessionCookie(res, token, 'frontend');
        res.json({ token });

    } catch (err) {
        console.error(`Verification Callback Error: ${err.message}`);
        res.status(401).json({ error: 'Invalid or expired verification link.' });
    }
});

// ==============================================================================
// FORGOT PASSWORD
// Matches Python: @app.route('/api/forgot-password', methods=['POST'])
// ==============================================================================
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

        // Use Account with API key to create recovery
        const account = new Account(serverClient);
        await account.createRecovery(normalizedEmail, `${process.env.FRONTEND_ORIGIN}/auth/recovery`);

        res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });

    } catch (err) {
        console.error(`Forgot Password Error: ${err.message}`);
        // Always return success message to prevent email enumeration
        res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }
});

// ==============================================================================
// PASSWORD RECOVERY CALLBACK
// Matches Python: @app.route('/api/auth/recovery', methods=['POST'])
// ==============================================================================
router.post('/api/auth/recovery', async (req, res) => {
    const { userId, secret, newPassword, confirmPassword } = req.body;

    if (!userId || !secret) return res.status(400).json({ error: 'Missing userId or secret' });
    if (!newPassword || !confirmPassword) return res.status(400).json({ error: 'Password is required' });
    if (newPassword !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });

    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const account = new Account(serverClient);

        await account.updateRecovery(userId, secret, newPassword);

        res.json({ message: 'Password reset successful. You can now log in with your new password.' });

    } catch (err) {
        console.error(`Recovery Error: ${err.message}`);
        res.status(401).json({ error: 'Invalid or expired recovery link.' });
    }
});

module.exports = router;

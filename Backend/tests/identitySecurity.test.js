const test = require('node:test');
const assert = require('node:assert/strict');

// Simulate the OAuth callback mismatch logic
async function handleGoogleOAuthCallback({
    googleEmail,
    currentUser,
    databaseUser,
    mockAppwriteUsers,
    mockAppwriteSessions,
    mockAppwriteDatabases,
    mockSessionCookieFn,
    mockCacheMap,
    cacheKey,
    appContext
}) {
    const normalizedOAuthEmail = googleEmail.trim().toLowerCase();
    const currentUserId = currentUser.$id;
    const session = { $id: 'session-temp' };

    if (databaseUser && databaseUser.email) {
        const currentDbEmail = databaseUser.email.trim().toLowerCase();
        if (currentDbEmail !== normalizedOAuthEmail) {
            // Unlink Google identity from old account
            if (currentUser.identities && Array.isArray(currentUser.identities)) {
                for (const identity of currentUser.identities) {
                    if (identity.provider === 'google') {
                        await mockAppwriteUsers.deleteIdentity(currentUserId, identity.$id);
                    }
                }
            }

            // Cleanup old session
            await mockAppwriteUsers.deleteSession(currentUserId, session.$id);

            // Find or create new target user
            let targetUser = null;
            const existingUsers = mockAppwriteUsers.listByEmail(normalizedOAuthEmail);
            if (existingUsers.length > 0) {
                targetUser = existingUsers[0];
            } else {
                targetUser = await mockAppwriteUsers.create(normalizedOAuthEmail, currentUser.name);
            }

            // Create a session for the target user
            const nextSession = await mockAppwriteUsers.createSession(targetUser.$id);
            const nextToken = nextSession.secret;

            // Set cookie
            mockSessionCookieFn(nextToken);
            mockCacheMap.set(cacheKey, nextToken);

            return { status: 200, json: { token: nextToken } };
        }
    }

    return { status: 200, json: { token: 'original-token' } };
}

// Simulate standard email/password login logic
function handlePasswordLogin({ email, password, mockAppwriteUsers }) {
    const normalizedEmail = email.trim().toLowerCase();
    const userDocs = mockAppwriteUsers.listByEmail(normalizedEmail);

    if (userDocs.length === 0) {
        return { status: 401, json: { error: 'Invalid email or password.' } };
    }

    // Try to create session with password (mock validation)
    const user = userDocs[0];
    if (user.password !== password) {
        return { status: 401, json: { error: 'Invalid email or password.' } };
    }

    return { status: 200, json: { token: 'session-token-' + user.$id } };
}

test('OAuth email mismatch -> unlinks identity and logs into / creates target account', async () => {
    // 1. Setup mock Appwrite users store
    const store = {
        users: [
            {
                $id: 'user-old-profile',
                name: 'Vignesh',
                email: 'new_email@example.com',
                identities: [{ $id: 'ident-google', provider: 'google' }]
            }
        ],
        deletedIdentities: [],
        deletedSessions: [],
        createdUsers: [],
        createdSessions: [],
        listByEmail(email) {
            return this.users.filter(u => u.email === email);
        },
        async deleteIdentity(userId, identityId) {
            this.deletedIdentities.push({ userId, identityId });
            const user = this.users.find(u => u.$id === userId);
            if (user) {
                user.identities = user.identities.filter(i => i.$id !== identityId);
            }
        },
        async deleteSession(userId, sessionId) {
            this.deletedSessions.push({ userId, sessionId });
        },
        async create(email, name) {
            const newUser = {
                $id: 'user-new-oauth-profile',
                name,
                email,
                identities: []
            };
            this.users.push(newUser);
            this.createdUsers.push(newUser);
            return newUser;
        },
        async createSession(userId) {
            const sess = { $id: 'sess-' + userId, secret: 'secret-' + userId };
            this.createdSessions.push({ userId, session: sess });
            return sess;
        }
    };

    let cookieSet = null;
    const cacheMap = new Map();

    const response = await handleGoogleOAuthCallback({
        googleEmail: 'old_email@example.com', // old email
        currentUser: store.users[0],
        databaseUser: { email: 'new_email@example.com' }, // updated email in DB
        mockAppwriteUsers: store,
        mockSessionCookieFn: (t) => { cookieSet = t; },
        mockCacheMap: cacheMap,
        cacheKey: 'test-oauth-secret',
        appContext: {}
    });

    // Asserts:
    // 1. Identity should be unlinked from the old user
    assert.deepEqual(store.deletedIdentities, [{ userId: 'user-old-profile', identityId: 'ident-google' }]);
    // 2. Old user identities list should be empty
    assert.equal(store.users.find(u => u.$id === 'user-old-profile').identities.length, 0);
    // 3. New user should be created with the old/Google email
    assert.equal(store.createdUsers.length, 1);
    assert.equal(store.createdUsers[0].email, 'old_email@example.com');
    // 4. Session cookie should be set for the new user
    assert.equal(cookieSet, 'secret-user-new-oauth-profile');
    assert.equal(cacheMap.get('test-oauth-secret'), 'secret-user-new-oauth-profile');
    assert.equal(response.status, 200);
});

test('Password login -> fails if old email is used after update', () => {
    const store = {
        users: [
            {
                $id: 'user-updated-profile',
                email: 'new_email@example.com', // email has been updated
                password: 'secret_password_123'
            }
        ],
        listByEmail(email) {
            return this.users.filter(u => u.email === email);
        }
    };

    // Attempting login with old email
    const res1 = handlePasswordLogin({
        email: 'old_email@example.com',
        password: 'secret_password_123',
        mockAppwriteUsers: store
    });

    assert.equal(res1.status, 401);
    assert.equal(res1.json.error, 'Invalid email or password.');

    // Attempting login with new email
    const res2 = handlePasswordLogin({
        email: 'new_email@example.com',
        password: 'secret_password_123',
        mockAppwriteUsers: store
    });

    assert.equal(res2.status, 200);
    assert.equal(res2.json.token, 'session-token-user-updated-profile');
});

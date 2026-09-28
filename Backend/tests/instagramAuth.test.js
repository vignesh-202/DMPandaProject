const test = require('node:test');
const assert = require('node:assert');
const {
    isInstagramAuthError,
    handleInstagramAuthorizationFailure,
    validateInstagramAccountToken,
    clearInstagramAccountReauth
} = require('../utils/instagramAuthHandler');
const {
    isLinkedAccountActive,
    normalizeAccountAccess
} = require('../utils/accountAccess');

test('Instagram Auth Handler - Error Classification', async (t) => {
    await t.test('identifies error code 190 as Instagram auth error', () => {
        const err = { response: { data: { error: { code: 190, message: 'Invalid OAuth access token' } } } };
        assert.strictEqual(isInstagramAuthError(err), true);
    });

    await t.test('identifies error code 102 subcode 459 as Instagram auth error', () => {
        const err = { response: { data: { error: { code: 102, error_subcode: 459, message: 'User changed password' } } } };
        assert.strictEqual(isInstagramAuthError(err), true);
    });

    await t.test('identifies OAuthException type as Instagram auth error', () => {
        const err = { response: { data: { error: { type: 'OAuthException', message: 'Session has expired' } } } };
        assert.strictEqual(isInstagramAuthError(err), true);
    });

    await t.test('identifies Off-Meta technologies disabled as auth error', () => {
        const err = { response: { data: { error: { message: 'Off Meta Technologies future activity is turned off' } } } };
        assert.strictEqual(isInstagramAuthError(err), true);
    });

    await t.test('does NOT classify rate limits (code 4, 17, 32, 613) as auth errors', () => {
        const rateLimitErr = { response: { data: { error: { code: 4, message: 'Application request limit reached' } } } };
        assert.strictEqual(isInstagramAuthError(rateLimitErr), false);

        const userRateLimit = { response: { data: { error: { code: 613, message: 'Calls to this API have exceeded the rate limit' } } } };
        assert.strictEqual(isInstagramAuthError(userRateLimit), false);
    });

    await t.test('does NOT classify transient network or timeout errors as auth errors', () => {
        const timeoutErr = new Error('connect ETIMEDOUT');
        timeoutErr.code = 'ETIMEDOUT';
        assert.strictEqual(isInstagramAuthError(timeoutErr), false);

        const socketErr = new Error('read ECONNRESET');
        socketErr.code = 'ECONNRESET';
        assert.strictEqual(isInstagramAuthError(socketErr), false);
    });
});

test('Account Access Model - Single Source of Truth', async (t) => {
    await t.test('Scenario 1: Active account with valid token', () => {
        const account = {
            $id: 'acc_1',
            status: 'active',
            admin_status: 'active',
            reauth_required: false,
            permissions: '',
            token_expires_at: new Date(Date.now() + 86400000).toISOString()
        };

        const access = normalizeAccountAccess(account);
        assert.strictEqual(access.is_active, true);
        assert.strictEqual(access.status, 'active');
        assert.strictEqual(access.reauth_required, false);
        assert.strictEqual(access.disabled_by_user, false);
        assert.strictEqual(isLinkedAccountActive(account), true);
    });

    await t.test('Scenario 2: Inactive because token is invalid / reauth required', () => {
        const account = {
            $id: 'acc_2',
            status: 'inactive',
            admin_status: 'active',
            reauth_required: true,
            permissions: 'dm_panda_reconnect_required',
            token_expires_at: new Date(Date.now() + 86400000).toISOString()
        };

        const access = normalizeAccountAccess(account);
        assert.strictEqual(access.is_active, false);
        assert.strictEqual(access.status, 'inactive');
        assert.strictEqual(access.reauth_required, true);
        assert.strictEqual(access.access_reason, 'reconnect_required');
        assert.strictEqual(access.disabled_by_user, false); // Crucial: NOT disabled by user
        assert.strictEqual(isLinkedAccountActive(account), false);
    });

    await t.test('Scenario 3: Inactive because user manually disabled the account', () => {
        const account = {
            $id: 'acc_3',
            status: 'inactive',
            admin_status: 'active',
            reauth_required: false,
            permissions: '',
            token_expires_at: new Date(Date.now() + 86400000).toISOString()
        };

        const access = normalizeAccountAccess(account);
        assert.strictEqual(access.is_active, false);
        assert.strictEqual(access.status, 'inactive');
        assert.strictEqual(access.reauth_required, false); // NOT reauth required
        assert.strictEqual(access.disabled_by_user, true); // Disabled by user
        assert.strictEqual(access.access_reason, 'inactive');
        assert.strictEqual(isLinkedAccountActive(account), false);
    });

    await t.test('Scenario 4: Inactive because token expired past token_expires_at', () => {
        const account = {
            $id: 'acc_4',
            status: 'active', // Even if status was active in DB, expired token must override
            admin_status: 'active',
            reauth_required: false,
            permissions: '',
            token_expires_at: new Date(Date.now() - 1000).toISOString() // Expired!
        };

        const access = normalizeAccountAccess(account);
        assert.strictEqual(access.is_active, false);
        assert.strictEqual(access.status, 'inactive');
        assert.strictEqual(access.reauth_required, true);
        assert.strictEqual(access.access_reason, 'reconnect_required');
        assert.strictEqual(isLinkedAccountActive(account), false);
    });
});

test('Instagram Auth Handler - Deactivation and Email Idempotency', async (t) => {
    await t.test('marks account inactive and sends email once', async () => {
        const updatedDocs = [];
        const mockDatabases = {
            getDocument: async () => ({
                $id: 'acc_test',
                user_id: 'user_1',
                username: 'test_ig',
                status: 'active',
                reauth_required: false,
                reauth_email_sent_at: null,
                permissions: ''
            }),
            updateDocument: async (dbId, collId, docId, data) => {
                updatedDocs.push(data);
                return { $id: docId, ...data };
            }
        };

        const result = await handleInstagramAuthorizationFailure({
            databases: mockDatabases,
            accountId: 'acc_test',
            error: { response: { data: { error: { code: 190, message: 'Invalid token' } } } }
        });

        assert.strictEqual(result.handled, true);
        assert.strictEqual(result.deactivated, true);
        assert.strictEqual(updatedDocs.length, 1);
        assert.strictEqual(updatedDocs[0].status, 'inactive');
        assert.strictEqual(updatedDocs[0].reauth_required, true);
        assert.ok(updatedDocs[0].reauth_email_sent_at, 'reauth_email_sent_at should be recorded');
        assert.ok(updatedDocs[0].permissions.includes('dm_panda_reconnect_required'));
    });

    await t.test('skips email notification if reauth_email_sent_at is already set (deduplication)', async () => {
        const updatedDocs = [];
        const existingSentAt = new Date(Date.now() - 3600000).toISOString();
        const mockDatabases = {
            getDocument: async () => ({
                $id: 'acc_test_dup',
                user_id: 'user_1',
                username: 'test_ig',
                status: 'inactive',
                reauth_required: true,
                reauth_email_sent_at: existingSentAt,
                permissions: 'dm_panda_reconnect_required'
            }),
            updateDocument: async (dbId, collId, docId, data) => {
                updatedDocs.push(data);
                return { $id: docId, ...data };
            }
        };

        const result = await handleInstagramAuthorizationFailure({
            databases: mockDatabases,
            accountId: 'acc_test_dup',
            error: { response: { data: { error: { code: 190, message: 'Invalid token' } } } }
        });

        assert.strictEqual(result.handled, true);
        assert.strictEqual(result.emailSent, false); // No duplicate email!
    });
});

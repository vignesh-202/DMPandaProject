const test = require('node:test');
const assert = require('node:assert/strict');

// Mock token validation logic resembling emailChangeToken.js
function validateTokenMock(tokenDoc) {
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
}

// Mock verification endpoint logic
async function verifyEmailChangeMock({
    token,
    mockDatabases,
    mockUsers,
    currentTime = Date.now()
}) {
    if (!token) {
        return { status: 400, json: { error: 'Verification token is required.' } };
    }

    // 1. Look up token
    const tokenDoc = mockDatabases.findToken(token);
    
    // 2. Validate token status and expiry
    const validation = validateTokenMock(tokenDoc);
    if (!validation.valid) {
        return { status: validation.statusCode, json: { error: validation.error } };
    }

    const { user_id: userId, old_email: oldEmail, new_email: newEmail } = tokenDoc;

    // 3. Confirm account exists
    let currentUser;
    try {
        currentUser = mockUsers.get(userId);
    } catch {
        tokenDoc.status = 'expired';
        return { status: 404, json: { error: 'The account associated with this request no longer exists.' } };
    }

    // 4. Race condition guard: check if email was already changed
    const currentEmail = currentUser.email.trim().toLowerCase();
    const normalizedNew = newEmail.trim().toLowerCase();
    const normalizedOld = oldEmail.trim().toLowerCase();

    if (currentEmail === normalizedNew) {
        tokenDoc.status = 'used';
        return { status: 200, json: { message: 'Your email address has already been updated to this address.', email: newEmail } };
    }

    if (currentEmail !== normalizedOld) {
        tokenDoc.status = 'expired';
        return { status: 409, json: { error: 'Your email has been changed since this request was made. Please initiate a new email change.' } };
    }

    // 5. Collision check at verification time
    const conflictingUser = mockUsers.findByEmail(normalizedNew);
    if (conflictingUser && conflictingUser.$id !== userId) {
        tokenDoc.status = 'expired';
        return { status: 409, json: { error: 'This email address is no longer available. Another account has claimed it.' } };
    }

    // 6. Finalize updates
    mockUsers.updateEmail(userId, normalizedNew);
    tokenDoc.status = 'used';

    // 7. Unlink Google identities since email changed
    if (currentUser.identities) {
        currentUser.identities = currentUser.identities.filter(id => id.provider === 'email');
    }

    return {
        status: 200,
        json: {
            message: 'Your email address has been successfully updated. You can now log in with your new email.',
            email: normalizedNew
        }
    };
}

test('validateTokenMock - token status/expiration checks', () => {
    // Valid pending token
    const validToken = {
        status: 'pending',
        expires_at: new Date(Date.now() + 60000).toISOString()
    };
    assert.deepEqual(validateTokenMock(validToken), { valid: true, tokenDoc: validToken });

    // Used token
    assert.equal(validateTokenMock({ status: 'used' }).statusCode, 409);

    // Expired status token
    assert.equal(validateTokenMock({ status: 'expired' }).statusCode, 410);

    // Expired timestamp token
    assert.equal(validateTokenMock({
        status: 'pending',
        expires_at: new Date(Date.now() - 1000).toISOString()
    }).statusCode, 410);
});

test('verifyEmailChangeMock - successful flow and identity unlinking', async () => {
    const mockDatabases = {
        tokens: [
            {
                $id: 'tok-123',
                token: 'secret-token-1',
                user_id: 'user-456',
                old_email: 'old@example.com',
                new_email: 'new@example.com',
                status: 'pending',
                expires_at: new Date(Date.now() + 60000).toISOString()
            }
        ],
        findToken(tokenVal) {
            return this.tokens.find(t => t.token === tokenVal);
        }
    };

    const mockUsers = {
        users: [
            {
                $id: 'user-456',
                email: 'old@example.com',
                identities: [
                    { $id: 'id-email', provider: 'email' },
                    { $id: 'id-google', provider: 'google' }
                ]
            }
        ],
        get(id) {
            const u = this.users.find(u => u.$id === id);
            if (!u) throw new Error('Not found');
            return u;
        },
        findByEmail(email) {
            return this.users.find(u => u.email === email);
        },
        updateEmail(id, email) {
            const u = this.get(id);
            u.email = email;
        }
    };

    const res = await verifyEmailChangeMock({
        token: 'secret-token-1',
        mockDatabases,
        mockUsers
    });

    assert.equal(res.status, 200);
    assert.equal(mockUsers.get('user-456').email, 'new@example.com');
    // Ensure Google identity is unlinked
    assert.deepEqual(mockUsers.get('user-456').identities, [{ $id: 'id-email', provider: 'email' }]);
    assert.equal(mockDatabases.findToken('secret-token-1').status, 'used');
});

test('verifyEmailChangeMock - race condition: email already changed (idempotent)', async () => {
    const mockDatabases = {
        tokens: [
            {
                $id: 'tok-123',
                token: 'secret-token-1',
                user_id: 'user-456',
                old_email: 'old@example.com',
                new_email: 'new@example.com',
                status: 'pending',
                expires_at: new Date(Date.now() + 60000).toISOString()
            }
        ],
        findToken(tokenVal) {
            return this.tokens.find(t => t.token === tokenVal);
        }
    };

    const mockUsers = {
        users: [
            {
                $id: 'user-456',
                email: 'new@example.com', // Already changed
                identities: []
            }
        ],
        get(id) {
            return this.users.find(u => u.$id === id);
        },
        findByEmail(email) {
            return this.users.find(u => u.email === email);
        }
    };

    const res = await verifyEmailChangeMock({
        token: 'secret-token-1',
        mockDatabases,
        mockUsers
    });

    assert.equal(res.status, 200);
    assert.equal(res.json.message, 'Your email address has already been updated to this address.');
    assert.equal(mockDatabases.findToken('secret-token-1').status, 'used');
});

test('verifyEmailChangeMock - race condition: email changed to something else', async () => {
    const mockDatabases = {
        tokens: [
            {
                $id: 'tok-123',
                token: 'secret-token-1',
                user_id: 'user-456',
                old_email: 'old@example.com',
                new_email: 'new@example.com',
                status: 'pending',
                expires_at: new Date(Date.now() + 60000).toISOString()
            }
        ],
        findToken(tokenVal) {
            return this.tokens.find(t => t.token === tokenVal);
        }
    };

    const mockUsers = {
        users: [
            {
                $id: 'user-456',
                email: 'thirdemail@example.com', // changed to something else
                identities: []
            }
        ],
        get(id) {
            return this.users.find(u => u.$id === id);
        },
        findByEmail(email) {
            return this.users.find(u => u.email === email);
        }
    };

    const res = await verifyEmailChangeMock({
        token: 'secret-token-1',
        mockDatabases,
        mockUsers
    });

    assert.equal(res.status, 409);
    assert.match(res.json.error, /Your email has been changed since this request was made/);
    assert.equal(mockDatabases.findToken('secret-token-1').status, 'expired');
});

test('verifyEmailChangeMock - collision: new email taken by another user', async () => {
    const mockDatabases = {
        tokens: [
            {
                $id: 'tok-123',
                token: 'secret-token-1',
                user_id: 'user-456',
                old_email: 'old@example.com',
                new_email: 'taken@example.com',
                status: 'pending',
                expires_at: new Date(Date.now() + 60000).toISOString()
            }
        ],
        findToken(tokenVal) {
            return this.tokens.find(t => t.token === tokenVal);
        }
    };

    const mockUsers = {
        users: [
            {
                $id: 'user-456',
                email: 'old@example.com',
                identities: []
            },
            {
                $id: 'user-other',
                email: 'taken@example.com', // other user claimed it
                identities: []
            }
        ],
        get(id) {
            return this.users.find(u => u.$id === id);
        },
        findByEmail(email) {
            return this.users.find(u => u.email === email);
        }
    };

    const res = await verifyEmailChangeMock({
        token: 'secret-token-1',
        mockDatabases,
        mockUsers
    });

    assert.equal(res.status, 409);
    assert.match(res.json.error, /This email address is no longer available/);
    assert.equal(mockDatabases.findToken('secret-token-1').status, 'expired');
});

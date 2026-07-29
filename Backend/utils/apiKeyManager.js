const crypto = require('crypto');
const { ID, Query, Databases, Users } = require('node-appwrite');
const { getAppwriteClient, APPWRITE_DATABASE_ID, USERS_COLLECTION_ID } = require('./appwrite');

const API_KEYS_COLLECTION_ID = process.env.API_KEYS_COLLECTION_ID || 'api_keys';

const generateKeyString = () => {
    const randomHex = crypto.randomBytes(16).toString('hex');
    return `dmp_live_${randomHex}`;
};

const maskKeyString = (key) => {
    if (!key || key.length < 12) return 'dmp_live_••••••••';
    return `${key.slice(0, 9)}••••••••${key.slice(-4)}`;
};

/**
 * Ensure database client is initialized
 */
const getDatabases = (client) => {
    const appwriteClient = client || getAppwriteClient({ useApiKey: true });
    return new Databases(appwriteClient);
};

/**
 * Fallback memory / user-document based API key storage if api_keys collection doesn't exist yet.
 */
const getUserDocApiKeys = async (databases, userId) => {
    try {
        const userDoc = await databases.getDocument(
            APPWRITE_DATABASE_ID,
            USERS_COLLECTION_ID,
            userId
        );
        const rawJson = userDoc.api_keys_json || '[]';
        return JSON.parse(rawJson);
    } catch (_) {
        return [];
    }
};

const saveUserDocApiKeys = async (databases, userId, keysList) => {
    try {
        await databases.updateDocument(
            APPWRITE_DATABASE_ID,
            USERS_COLLECTION_ID,
            userId,
            { api_keys_json: JSON.stringify(keysList) }
        );
    } catch (err) {
        console.warn(`Could not save API keys to user doc fallback for ${userId}:`, err.message);
    }
};

/**
 * Create a new API Key for a user
 */
const createApiKey = async (userId, name = 'Default API Key') => {
    const databases = getDatabases();
    const rawKey = generateKeyString();
    const maskedKey = maskKeyString(rawKey);
    const now = new Date().toISOString();
    const keyId = ID.unique();

    const keyRecord = {
        keyId,
        userId,
        rawKey,
        maskedKey,
        name: name.trim() || 'Default API Key',
        createdAt: now,
        lastUsedAt: null,
        status: 'active'
    };

    try {
        // Try creating in dedicated api_keys collection
        const doc = await databases.createDocument(
            APPWRITE_DATABASE_ID,
            API_KEYS_COLLECTION_ID,
            keyId,
            {
                user_id: userId,
                raw_key: rawKey,
                masked_key: maskedKey,
                name: keyRecord.name,
                created_at: now,
                last_used_at: null,
                status: 'active'
            }
        );
        return {
            id: doc.$id,
            name: doc.name,
            key: rawKey,
            maskedKey: doc.masked_key,
            createdAt: doc.created_at,
            lastUsedAt: doc.last_used_at,
            status: doc.status
        };
    } catch (err) {
        // Fallback to user document attribute if collection doesn't exist
        const existingKeys = await getUserDocApiKeys(databases, userId);
        existingKeys.push(keyRecord);
        await saveUserDocApiKeys(databases, userId, existingKeys);
        return {
            id: keyId,
            name: keyRecord.name,
            key: rawKey,
            maskedKey,
            createdAt: now,
            lastUsedAt: null,
            status: 'active'
        };
    }
};

/**
 * List all API Keys for a user
 */
const listApiKeys = async (userId) => {
    const databases = getDatabases();

    try {
        const response = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            API_KEYS_COLLECTION_ID,
            [
                Query.equal('user_id', userId),
                Query.orderDesc('created_at'),
                Query.limit(100)
            ]
        );

        return response.documents
            .filter(doc => doc.status !== 'revoked')
            .map(doc => ({
                id: doc.$id,
                name: doc.name,
                maskedKey: doc.masked_key,
                createdAt: doc.created_at,
                lastUsedAt: doc.last_used_at,
                status: doc.status
            }));
    } catch (err) {
        // Fallback to user doc
        const existingKeys = await getUserDocApiKeys(databases, userId);
        return existingKeys
            .filter(k => k.status !== 'revoked')
            .map(k => ({
                id: k.keyId || k.id,
                name: k.name,
                maskedKey: k.maskedKey,
                createdAt: k.createdAt,
                lastUsedAt: k.lastUsedAt,
                status: k.status
            }));
    }
};

/**
 * Revoke an API Key
 */
const revokeApiKey = async (userId, keyId) => {
    const databases = getDatabases();

    try {
        await databases.updateDocument(
            APPWRITE_DATABASE_ID,
            API_KEYS_COLLECTION_ID,
            keyId,
            { status: 'revoked' }
        );
        return true;
    } catch (err) {
        // Fallback to user doc
        const existingKeys = await getUserDocApiKeys(databases, userId);
        const updatedKeys = existingKeys.map(k => {
            if ((k.keyId || k.id) === keyId) {
                return { ...k, status: 'revoked' };
            }
            return k;
        });
        await saveUserDocApiKeys(databases, userId, updatedKeys);
        return true;
    }
};

/**
 * Validate an API key raw string and return the user ID & key details
 */
const validateApiKey = async (rawKey) => {
    if (!rawKey || typeof rawKey !== 'string' || !rawKey.startsWith('dmp_live_')) {
        return null;
    }

    const databases = getDatabases();

    try {
        const response = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            API_KEYS_COLLECTION_ID,
            [
                Query.equal('raw_key', rawKey.trim()),
                Query.equal('status', 'active'),
                Query.limit(1)
            ]
        );

        if (response.documents.length > 0) {
            const doc = response.documents[0];

            // Touch lastUsedAt asynchronously
            const now = new Date().toISOString();
            databases.updateDocument(
                APPWRITE_DATABASE_ID,
                API_KEYS_COLLECTION_ID,
                doc.$id,
                { last_used_at: now }
            ).catch(() => null);

            return {
                keyId: doc.$id,
                userId: doc.user_id,
                name: doc.name
            };
        }
    } catch (err) {
        // Try scanning users collection fallback
        try {
            const usersList = await databases.listDocuments(
                APPWRITE_DATABASE_ID,
                USERS_COLLECTION_ID,
                [Query.limit(100)]
            );

            for (const userDoc of usersList.documents) {
                if (!userDoc.api_keys_json) continue;
                try {
                    const keys = JSON.parse(userDoc.api_keys_json);
                    const match = keys.find(k => k.rawKey === rawKey.trim() && k.status === 'active');
                    if (match) {
                        return {
                            keyId: match.keyId || match.id,
                            userId: userDoc.$id,
                            name: match.name
                        };
                    }
                } catch (_) {}
            }
        } catch (_) {}
    }

    return null;
};

module.exports = {
    createApiKey,
    listApiKeys,
    revokeApiKey,
    validateApiKey,
    API_KEYS_COLLECTION_ID
};

const { validateApiKey } = require('../utils/apiKeyManager');
const { getAppwriteClient, USERS_COLLECTION_ID, APPWRITE_DATABASE_ID } = require('../utils/appwrite');
const { Users, Databases } = require('node-appwrite');
const { loginRequired } = require('./auth');

const apiKeyOrSessionAuth = async (req, res, next) => {
    let apiKey = req.headers['x-api-key'] || req.headers['x-dmpanda-api-key'];

    if (!apiKey) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token && token.startsWith('dmp_live_')) {
                apiKey = token;
            }
        }
    }

    if (apiKey) {
        try {
            const keyInfo = await validateApiKey(apiKey);
            if (!keyInfo) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid or revoked API Key'
                });
            }

            const serverClient = getAppwriteClient({ useApiKey: true });
            const users = new Users(serverClient);
            const databases = new Databases(serverClient);

            const user = await users.get(keyInfo.userId);

            const { hasUltraPlanAccess } = require('../utils/planConfig');
            const hasUltraAccess = await hasUltraPlanAccess(databases, user.$id);
            if (!hasUltraAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'API Access is available only on the Ultra plan. Please upgrade to Ultra to use API features.'
                });
            }

            let userDocument = null;
            try {
                userDocument = await databases.getDocument(
                    APPWRITE_DATABASE_ID,
                    USERS_COLLECTION_ID,
                    user.$id
                );
            } catch (_) {}

            req.user = user;
            req.userDocument = userDocument;
            req.apiKeyInfo = keyInfo;
            req.isApiKeyAuth = true;

            return next();
        } catch (err) {
            console.error('API Key validation error:', err.message);
            return res.status(500).json({
                success: false,
                error: 'Authentication failed'
            });
        }
    }

    // Fall back to session cookie auth for dashboard requests
    return loginRequired(req, res, next);
};

module.exports = { apiKeyOrSessionAuth };

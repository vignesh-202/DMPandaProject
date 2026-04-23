const { Account } = require('node-appwrite');
const { getAppwriteClient } = require('../utils/appwrite');
const { getSessionTokenFromRequest, clearSessionCookie, getAppContextFromRequest } = require('../utils/sessionContext');
const { createServerDatabases, loadUserAccessState, buildAccessDeniedPayload } = require('../utils/accessControl');

const isAdminApiRequest = (req) => String(req?.originalUrl || req?.url || '').startsWith('/api/admin');
const isAdminContextRequest = (req) => isAdminApiRequest(req) || getAppContextFromRequest(req) === 'admin';
const hasAdminLabel = (user) => Array.isArray(user?.labels) && user.labels.includes('admin');
const isTransientFetchError = (error) => {
    const message = String(error?.message || '').trim().toLowerCase();
    return message.includes('fetch failed')
        || message.includes('socket hang up')
        || message.includes('etimedout')
        || message.includes('econnreset')
        || message.includes('enotfound')
        || message.includes('eai_again');
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const retryTransient = async (operation, retries = 2) => {
    let attempt = 0;
    while (attempt <= retries) {
        try {
            return await operation();
        } catch (error) {
            if (!isTransientFetchError(error) || attempt === retries) {
                throw error;
            }
            attempt += 1;
            await delay(200 * attempt);
        }
    }
    return null;
};

const sendAuthError = (req, res, status, error, data = null) => {
    if (isAdminApiRequest(req)) {
        return res.status(status).json({
            success: false,
            data,
            error
        });
    }
    return res.status(status).json({ error });
};

const loginRequired = async (req, res, next) => {
    let sessionToken = getSessionTokenFromRequest(req);

    if (!sessionToken) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            sessionToken = authHeader.split(' ')[1];
        }
    }

    if (!sessionToken) {
        return sendAuthError(req, res, 401, 'Not authorized');
    }

    try {
        const client = getAppwriteClient({ sessionToken });
        const account = new Account(client);
        const user = await retryTransient(() => account.get());
        const databases = createServerDatabases();
        const { userDocument, accessState } = await retryTransient(() => loadUserAccessState(databases, user.$id));
        const adminOverrideAllowed = isAdminContextRequest(req) && hasAdminLabel(user);

        if (accessState.is_hard_banned && !adminOverrideAllowed) {
            clearSessionCookie(res, getAppContextFromRequest(req));
            const payload = buildAccessDeniedPayload(accessState, accessState.ban_message || 'Your account has been blocked.');
            if (isAdminApiRequest(req)) {
                return res.status(403).json({
                    success: false,
                    data: payload,
                    error: payload?.message || 'Your account has been blocked.'
                });
            }
            return res.status(403).json(payload);
        }

        req.user = user;
        req.userDocument = userDocument;
        req.accessState = accessState;
        req.adminAccessOverride = adminOverrideAllowed;
        req.appwriteClient = client;
        next();
    } catch (err) {
        const authCode = Number(err?.code || err?.response?.code || 0);
        const message = String(err?.message || '').toLowerCase();
        const isInvalidSession =
            authCode === 401
            || message.includes('session')
            || message.includes('unauthorized')
            || message.includes('missing scopes')
            || message.includes('role: guests');

        if (isInvalidSession) {
            clearSessionCookie(res, getAppContextFromRequest(req));
            return sendAuthError(req, res, 401, 'Session is invalid');
        }

        console.warn(`Auth service temporarily unavailable: ${err.message}`);
        return sendAuthError(req, res, 503, 'Authentication service is temporarily unavailable');
    }
};

module.exports = { loginRequired };

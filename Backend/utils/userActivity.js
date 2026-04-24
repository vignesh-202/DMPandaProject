const { Databases } = require('node-appwrite');
const {
    getAppwriteClient,
    APPWRITE_DATABASE_ID,
    USERS_COLLECTION_ID
} = require('./appwrite');

const ACTIVITY_TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000;

const parseDate = (value) => {
    const safe = String(value || '').trim();
    if (!safe) return null;
    const parsed = new Date(safe);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getNowIso = (now = new Date()) => new Date(now).toISOString();

const getUsersDatabases = () => {
    const client = getAppwriteClient({ useApiKey: true });
    return new Databases(client);
};

const getUserDocumentIfExists = async (databases, userId) => {
    try {
        return await databases.getDocument(APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, String(userId || '').trim());
    } catch (error) {
        if (Number(error?.code || error?.response?.code || 0) === 404) {
            return null;
        }
        throw error;
    }
};

const shouldTouchActivity = (userDocument, options = {}) => {
    if (!userDocument) return true;
    if (options.force === true || options.markLogin === true) return true;
    if (options.clearCleanupState !== false && String(userDocument.cleanup_state_json || '').trim()) {
        return true;
    }
    const lastActiveAt = parseDate(userDocument.last_active_at || userDocument.last_login || userDocument.first_login);
    if (!lastActiveAt) return true;
    const now = options.now instanceof Date ? options.now : new Date();
    return (now.getTime() - lastActiveAt.getTime()) >= ACTIVITY_TOUCH_INTERVAL_MS;
};

const buildActivityPatch = (userDocument, options = {}) => {
    const nowIso = getNowIso(options.now);
    const patch = {
        last_active_at: nowIso
    };

    if (options.markLogin === true) {
        patch.last_login = nowIso;
        if (!String(userDocument?.first_login || '').trim()) {
            patch.first_login = nowIso;
        }
    }

    if (options.clearCleanupState !== false && String(userDocument?.cleanup_state_json || '').trim()) {
        patch.cleanup_state_json = null;
    }

    return patch;
};

const ensureUserActivityDocument = async (user, options = {}) => {
    const databases = options.databases || getUsersDatabases();
    const userId = String(user?.$id || '').trim();
    if (!userId) return null;

    const nowIso = getNowIso(options.now);
    const existing = await getUserDocumentIfExists(databases, userId);
    if (!existing) {
        return databases.createDocument(
            APPWRITE_DATABASE_ID,
            USERS_COLLECTION_ID,
            userId,
            {
                name: user?.name || 'N/A',
                email: user?.email || 'N/A',
                first_login: nowIso,
                last_login: nowIso,
                last_active_at: nowIso,
                status: 'active',
                plan_id: 'free',
                plan_expires_at: null,
                kill_switch_enabled: true,
                cleanup_protected: false,
                cleanup_state_json: null
            }
        );
    }

    const patch = {
        name: user?.name || existing.name || 'N/A',
        email: user?.email || existing.email || 'N/A',
        ...buildActivityPatch(existing, {
            now: options.now,
            markLogin: options.markLogin !== false,
            clearCleanupState: options.clearCleanupState !== false
        })
    };

    return databases.updateDocument(APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, userId, patch);
};

const touchUserActivity = async (userId, options = {}) => {
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) return null;

    const databases = options.databases || getUsersDatabases();
    const userDocument = options.userDocument || await getUserDocumentIfExists(databases, safeUserId);
    if (!userDocument) return null;
    if (!shouldTouchActivity(userDocument, options)) {
        return userDocument;
    }

    const patch = buildActivityPatch(userDocument, options);
    if (!Object.keys(patch).length) {
        return userDocument;
    }

    return databases.updateDocument(APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, safeUserId, patch);
};

module.exports = {
    ACTIVITY_TOUCH_INTERVAL_MS,
    ensureUserActivityDocument,
    touchUserActivity,
    shouldTouchActivity,
    buildActivityPatch
};

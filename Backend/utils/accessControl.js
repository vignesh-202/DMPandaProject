const { Databases, Query } = require('node-appwrite');
const {
    getAppwriteClient,
    APPWRITE_DATABASE_ID,
    USERS_COLLECTION_ID
} = require('./appwrite');

const normalizeBanMode = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'soft' || normalized === 'hard') return normalized;
    return 'none';
};

const normalizeKillSwitch = (value, fallback = true) => {
    if (value === null || value === undefined || value === '') return Boolean(fallback);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const normalized = String(value).trim().toLowerCase();
    if (['false', '0', 'off', 'disabled', 'no'].includes(normalized)) return false;
    if (['true', '1', 'on', 'enabled', 'yes'].includes(normalized)) return true;
    return Boolean(fallback);
};

const buildAccessState = (userDocument = null) => {
    const banMode = normalizeBanMode(userDocument?.ban_mode);
    const banMessage = String(
        userDocument?.ban_reason
        || ''
    ).trim() || null;
    const killSwitchEnabled = normalizeKillSwitch(userDocument?.kill_switch_enabled, true);
    const automationLockReason = banMode === 'hard'
        ? 'hard_ban'
        : (banMode === 'soft'
            ? 'soft_ban'
            : (killSwitchEnabled ? null : 'kill_switch_disabled'));

    return {
        ban_mode: banMode,
        ban_message: banMessage,
        kill_switch_enabled: killSwitchEnabled,
        is_soft_banned: banMode === 'soft',
        is_hard_banned: banMode === 'hard',
        automation_locked: Boolean(automationLockReason),
        automation_lock_reason: automationLockReason,
        dashboard_allowed: banMode !== 'hard',
        login_allowed: banMode !== 'hard'
    };
};

const getFrontendUserDocument = async (databases, userId) => {
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) return null;

    try {
        return await databases.getDocument(APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, safeUserId);
    } catch (error) {
        const code = Number(error?.code || error?.response?.code || 0);
        if (code === 404) return null;
    }

    try {
        const response = await databases.listDocuments(APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, [
            Query.equal('$id', safeUserId),
            Query.limit(1)
        ]);
        return response.documents?.[0] || null;
    } catch (_) {
        return null;
    }
};

const loadUserAccessState = async (databases, userId, options = {}) => {
    const userDocument = options.userDocument || await getFrontendUserDocument(databases, userId);
    const accessState = buildAccessState(userDocument);
    return { userDocument, accessState };
};

const buildAccessDeniedPayload = (accessState, fallbackError) => ({
    error: fallbackError || (accessState?.is_hard_banned ? 'Account access is blocked.' : 'Automation access is restricted.'),
    code: accessState?.is_hard_banned ? 'hard_ban' : 'soft_ban_automation_locked',
    access_state: accessState
});

const createServerDatabases = () => {
    const client = getAppwriteClient({ useApiKey: true });
    return new Databases(client);
};

module.exports = {
    normalizeBanMode,
    normalizeKillSwitch,
    buildAccessState,
    getFrontendUserDocument,
    loadUserAccessState,
    buildAccessDeniedPayload,
    createServerDatabases
};

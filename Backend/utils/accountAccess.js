const { Query } = require('node-appwrite');
const {
    APPWRITE_DATABASE_ID,
    IG_ACCOUNTS_COLLECTION_ID
} = require('./appwrite');

const parseJsonObject = (value, fallback = {}) => {
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
};

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

const retryAppwriteOperation = async (operation, {
    retries = 2,
    retryDelayMs = 250
} = {}) => {
    let attempt = 0;
    let lastError;
    while (attempt <= retries) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (!isTransientFetchError(error) || attempt === retries) {
                throw error;
            }
            await delay(retryDelayMs * (attempt + 1));
            attempt += 1;
        }
    }
    throw lastError;
};

const toFiniteNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const toBoolean = (value, fallback = false) => {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const normalized = String(value || '').trim().toLowerCase();
    if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) return false;
    return fallback;
};

const getProfileLimits = (profile = null) => {
    const parsed = parseJsonObject(profile?.limits_json, {});
    const activeLimit = toFiniteNumber(
        parsed.instagram_connections_limit
        ?? profile?.instagram_connections_limit
    ) ?? 0;
    const linkedLimit = toFiniteNumber(
        parsed.instagram_link_limit
        ?? profile?.instagram_link_limit
    );
    return {
        instagram_connections_limit: activeLimit,
        instagram_link_limit: linkedLimit != null ? linkedLimit : activeLimit
    };
};

const isLinkedAccountActive = (account = null) => {
    if (!account) return false;
    const status = String(account.status || 'active').trim().toLowerCase();
    return toBoolean(account.is_active, status === 'active') && status === 'active';
};

const getAccountOrderValue = (account = null) => {
    const raw = account?.linked_at || account?.$createdAt || account?.$updatedAt || '';
    const parsed = new Date(raw).getTime();
    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
};

const compareAccountsByLinkedOrder = (left, right) => {
    const delta = getAccountOrderValue(left) - getAccountOrderValue(right);
    if (delta !== 0) return delta;
    const createdDelta = new Date(left?.$createdAt || 0).getTime() - new Date(right?.$createdAt || 0).getTime();
    if (!Number.isNaN(createdDelta) && createdDelta !== 0) return createdDelta;
    return String(left?.$id || '').localeCompare(String(right?.$id || ''));
};

const normalizeAccountAccess = (account = null) => {
    const adminDisabled = toBoolean(account?.admin_disabled, false);
    const planLocked = toBoolean(account?.plan_locked, false);
    const accessOverrideEnabled = toBoolean(account?.access_override_enabled, false);
    const linkedActive = isLinkedAccountActive(account);

    let accessState = 'active';
    let accessReason = null;
    let effectiveAccess = linkedActive;

    if (!linkedActive) {
        accessState = 'inactive';
        accessReason = 'inactive';
        effectiveAccess = false;
    } else if (adminDisabled) {
        accessState = 'admin_disabled';
        accessReason = 'admin_disabled';
        effectiveAccess = false;
    } else if (planLocked && !accessOverrideEnabled) {
        accessState = 'plan_locked';
        accessReason = 'plan_locked';
        effectiveAccess = false;
    } else if (accessOverrideEnabled) {
        accessState = 'override_enabled';
        accessReason = 'override_enabled';
        effectiveAccess = true;
    }

    return {
        admin_disabled: adminDisabled,
        plan_locked: planLocked,
        access_override_enabled: accessOverrideEnabled,
        effective_access: effectiveAccess,
        access_state: accessState,
        access_reason: accessReason
    };
};

const listUserInstagramAccounts = async (databases, userId) => {
    const response = await retryAppwriteOperation(() => databases.listDocuments(APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, [
        Query.equal('user_id', String(userId || '').trim()),
        Query.limit(200)
    ]));
    return response.documents || [];
};

const buildAccountAccessPatch = (account, nextFields) => {
    const patch = {};
    Object.entries(nextFields).forEach(([key, value]) => {
        const current = account?.[key];
        if (current !== value) {
            patch[key] = value;
        }
    });
    return patch;
};

const recomputeAccountAccessForUser = async (databases, userId, profile = null, accounts = null) => {
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) return [];

    const docs = Array.isArray(accounts) ? accounts : await listUserInstagramAccounts(databases, safeUserId);
    const limit = Math.max(0, Number(getProfileLimits(profile).instagram_connections_limit || 0));
    const orderedLinkedActiveAccounts = docs
        .filter((account) => isLinkedAccountActive(account))
        .slice()
        .sort(compareAccountsByLinkedOrder);

    const defaultWindowIds = new Set(
        orderedLinkedActiveAccounts
            .slice(0, limit)
            .map((account) => String(account.$id || '').trim())
            .filter(Boolean)
    );

    const updates = [];
    const nextAccounts = [];

    for (const account of docs) {
        const accountId = String(account?.$id || '').trim();
        const linkedActive = isLinkedAccountActive(account);
        const adminDisabled = toBoolean(account?.admin_disabled, false);
        const accessOverrideEnabled = toBoolean(account?.access_override_enabled, false);
        const withinDefaultWindow = defaultWindowIds.has(accountId);
        const nextPlanLocked = linkedActive && !withinDefaultWindow && !accessOverrideEnabled;
        const normalized = normalizeAccountAccess({
            ...account,
            admin_disabled: adminDisabled,
            access_override_enabled: accessOverrideEnabled,
            plan_locked: nextPlanLocked
        });
        const patch = buildAccountAccessPatch(account, {
            plan_locked: nextPlanLocked,
            access_state: normalized.access_state,
            access_reason: normalized.access_reason,
            effective_access: normalized.effective_access
        });

        if (Object.keys(patch).length > 0) {
            updates.push(
                retryAppwriteOperation(() => databases.updateDocument(
                    APPWRITE_DATABASE_ID,
                    IG_ACCOUNTS_COLLECTION_ID,
                    account.$id,
                    patch
                ))
            );
        }

        nextAccounts.push({
            ...account,
            ...patch,
            admin_disabled: adminDisabled,
            access_override_enabled: accessOverrideEnabled
        });
    }

    if (updates.length > 0) {
        const results = await Promise.allSettled(updates);
        const failures = results.filter((result) => result.status === 'rejected');
        if (failures.length > 0) {
            const error = new Error(`Failed to recompute Instagram account access for ${failures.length} account(s).`);
            error.failures = failures.map((result) => result.reason?.message || String(result.reason || 'unknown'));
            throw error;
        }
    }

    return nextAccounts
        .slice()
        .sort(compareAccountsByLinkedOrder)
        .map((account) => ({
            ...account,
            ...normalizeAccountAccess(account)
        }));
};

module.exports = {
    parseJsonObject,
    getProfileLimits,
    isLinkedAccountActive,
    normalizeAccountAccess,
    listUserInstagramAccounts,
    recomputeAccountAccessForUser,
    compareAccountsByLinkedOrder
};

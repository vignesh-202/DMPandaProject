const { Query } = require('node-appwrite');
const {
    APPWRITE_DATABASE_ID,
    IG_ACCOUNTS_COLLECTION_ID
} = require('./appwrite');

const ACCOUNT_ACCESS_CACHE_TTL_MS = 5000;
const accountAccessCache = new Map();

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
    const baseLimit = Math.max(0, Number(toFiniteNumber(profile?.instagram_connections_limit) || 0));
    return {
        instagram_connections_limit: baseLimit,
        active_account_limit: baseLimit,
        max_allowed_accounts: baseLimit
    };
};

const isLinkedAccountActive = (account = null) => {
    if (!account) return false;
    const status = String(account.status || 'active').trim().toLowerCase();
    return toBoolean(account.is_active, status === 'active') && status === 'active';
};

const getAccountOrderValue = (account = null) => {
    const raw = account?.linked_at || '';
    const parsed = new Date(raw).getTime();
    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
};

const compareAccountsByLinkedOrder = (left, right) => {
    const delta = getAccountOrderValue(left) - getAccountOrderValue(right);
    if (delta !== 0) return delta;
    return String(left?.$id || '').localeCompare(String(right?.$id || ''));
};

const normalizeAccountAccess = (account = null) => {
    const adminDisabled = toBoolean(account?.admin_disabled, false);
    const planLocked = toBoolean(account?.plan_locked, false);
    const accessOverrideEnabled = toBoolean(account?.access_override_enabled, false);
    const linkedActive = isLinkedAccountActive(account);

    let accessState = 'active';
    let accessReason = '';
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
        is_active: linkedActive,
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

const cloneAccountAccessState = (state) => ({
    ...state,
    limits: { ...(state?.limits || {}) },
    summary: { ...(state?.summary || {}) },
    default_window_ids: Array.isArray(state?.default_window_ids) ? [...state.default_window_ids] : [],
    accounts: Array.isArray(state?.accounts)
        ? state.accounts.map((account) => ({ ...account }))
        : []
});

const buildAccountAccessCacheSignature = (profile = null, accounts = []) => JSON.stringify({
    instagram_connections_limit: profile?.instagram_connections_limit ?? null,
    accounts: (Array.isArray(accounts) ? accounts : [])
        .map((account) => ({
            id: String(account?.$id || '').trim(),
            linked_at: String(account?.linked_at || '').trim(),
            status: String(account?.status || '').trim(),
            is_active: toBoolean(account?.is_active, String(account?.status || 'active').trim().toLowerCase() === 'active'),
            admin_disabled: toBoolean(account?.admin_disabled, false),
            access_override_enabled: toBoolean(account?.access_override_enabled, false),
            plan_locked: toBoolean(account?.plan_locked, false),
            effective_access: toBoolean(account?.effective_access, false),
            access_state: String(account?.access_state || '').trim(),
            access_reason: String(account?.access_reason || '').trim()
        }))
        .sort((left, right) => left.id.localeCompare(right.id))
});

const readAccountAccessCache = (userId, signature) => {
    const cached = accountAccessCache.get(userId);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now() || cached.signature !== signature) {
        accountAccessCache.delete(userId);
        return null;
    }
    return cloneAccountAccessState(cached.value);
};

const writeAccountAccessCache = (userId, signature, value) => {
    accountAccessCache.set(userId, {
        signature,
        expiresAt: Date.now() + ACCOUNT_ACCESS_CACHE_TTL_MS,
        value: cloneAccountAccessState(value)
    });
};

const recomputeAccountAccessStateForUser = async (databases, userId, profile = null, accounts = null) => {
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) {
        return {
            accounts: [],
            summary: {
                total_linked_accounts: 0,
                max_allowed_accounts: 0,
                active_account_limit: 0
            },
            limits: getProfileLimits(profile),
            default_window_ids: []
        };
    }

    const docs = Array.isArray(accounts) ? accounts : await listUserInstagramAccounts(databases, safeUserId);
    const limitState = getProfileLimits(profile);
    const signature = buildAccountAccessCacheSignature(profile, docs);
    const cached = readAccountAccessCache(safeUserId, signature);
    if (cached) {
        return cached;
    }
    const limit = Math.max(0, Number(limitState.active_account_limit || 0));
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

    const normalizedAccounts = nextAccounts
        .slice()
        .sort(compareAccountsByLinkedOrder)
        .map((account) => ({
            ...account,
            ...normalizeAccountAccess(account)
        }));
    const state = {
        accounts: normalizedAccounts,
        summary: {
            total_linked_accounts: orderedLinkedActiveAccounts.length,
            max_allowed_accounts: Number(limitState.max_allowed_accounts || 0),
            active_account_limit: Number(limitState.active_account_limit || 0)
        },
        limits: limitState,
        default_window_ids: Array.from(defaultWindowIds)
    };
    writeAccountAccessCache(safeUserId, signature, state);
    return state;
};

const recomputeAccountAccessForUser = async (databases, userId, profile = null, accounts = null) => {
    const state = await recomputeAccountAccessStateForUser(databases, userId, profile, accounts);
    return state.accounts;
};

module.exports = {
    getProfileLimits,
    isLinkedAccountActive,
    normalizeAccountAccess,
    listUserInstagramAccounts,
    recomputeAccountAccessStateForUser,
    recomputeAccountAccessForUser,
    compareAccountsByLinkedOrder
};

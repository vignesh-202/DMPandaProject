const { Query } = require('node-appwrite');
const {
    APPWRITE_DATABASE_ID,
    PRICING_COLLECTION_ID,
    PROFILES_COLLECTION_ID,
    USERS_COLLECTION_ID
} = require('./appwrite');

const parseJsonArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return value.split(',').map((item) => item.trim()).filter(Boolean);
        }
    }
    return [];
};

const parseJsonObject = (value, fallback = {}) => {
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
};

const parseJsonObjectArray = (value) => {
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const normalizePlanCode = (value) => String(value || '').trim().toLowerCase();
const normalizePlanSource = (value, fallback = 'self') => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'admin' || normalized === 'self') return normalized;
    return fallback === 'admin' ? 'admin' : 'self';
};

const normalizeFeatureKey = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[+/\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const toFiniteNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const next = Number(value);
    return Number.isFinite(next) ? next : null;
};

const normalizeBooleanEntitlement = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return false;
    if (['yes', 'true', 'included', 'enabled', 'active', 'available', 'unlimited'].includes(normalized)) return true;
    if (['no', 'false', 'disabled', 'inactive', 'not included'].includes(normalized)) return false;
    const numeric = toFiniteNumber(value);
    return numeric != null ? numeric !== 0 : true;
};

const normalizeStoredLimit = (value) => {
    const numeric = toFiniteNumber(value);
    if (numeric == null || numeric <= 0) return null;
    return numeric;
};

const RESERVED_PROFILE_CONFIG_KEYS = new Set([
    '__feature_overrides',
    '__limit_overrides',
    '__paid_plan_snapshot'
]);
const LIMIT_ENTITLEMENT_KEYS = new Set([
    'instagram_connections_limit',
    'instagram_link_limit',
    'actions_per_hour_limit',
    'actions_per_day_limit',
    'actions_per_month_limit',
    'hourly_action_limit',
    'daily_action_limit',
    'monthly_action_limit'
]);

const DEFAULT_FREE_PROFILE_LIMITS = Object.freeze({
    instagram_connections_limit: 0,
    instagram_link_limit: 0,
    hourly_action_limit: 0,
    daily_action_limit: 0,
    monthly_action_limit: null
});

const PLAN_DURATION_DAYS = Object.freeze({
    monthly: 30,
    yearly: 364
});

const encodeProfileLimit = (value) => {
    const numeric = toFiniteNumber(value);
    if (numeric == null || numeric <= 0) return 0;
    return numeric;
};

const normalizeBillingCycle = (value, fallback = 'monthly') => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'yearly') return 'yearly';
    if (normalized === 'monthly') return 'monthly';
    return String(fallback || 'monthly').trim().toLowerCase() === 'yearly' ? 'yearly' : 'monthly';
};

const resolvePlanDurationDays = (billingCycle) => PLAN_DURATION_DAYS[normalizeBillingCycle(billingCycle)] || PLAN_DURATION_DAYS.monthly;

const normalizeSubscriptionStatus = (value, fallback = 'inactive') => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'active' || normalized === 'inactive' || normalized === 'expired' || normalized === 'trial' || normalized === 'cancelled' || normalized === 'past_due') {
        return normalized;
    }
    return String(fallback || 'inactive').trim().toLowerCase() === 'active' ? 'active' : 'inactive';
};

const toIsoDateTime = (value) => {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
};

const calculateSubscriptionExpiry = ({
    billingCycle = 'monthly',
    durationDays = null,
    baseDate = null
} = {}) => {
    const parsedBaseDate = baseDate ? new Date(baseDate) : new Date();
    const safeBaseDate = Number.isNaN(parsedBaseDate.getTime()) ? new Date() : parsedBaseDate;
    const resolvedDays = toFiniteNumber(durationDays) != null
        ? Math.max(1, Math.floor(Number(durationDays)))
        : resolvePlanDurationDays(billingCycle);
    const next = new Date(safeBaseDate);
    next.setUTCDate(next.getUTCDate() + resolvedDays);
    return next.toISOString();
};

const buildPlanEntitlements = (comparison) => {
    const entries = Array.isArray(comparison) ? comparison : [];
    const entitlements = entries.reduce((acc, item) => {
        const key = normalizeFeatureKey(item?.key || item?.label);
        if (!key || LIMIT_ENTITLEMENT_KEYS.has(key)) return acc;
        acc[key] = normalizeBooleanEntitlement(item?.value);
        return acc;
    }, {});
    if (entitlements.webhook_integrations === true && entitlements.collect_email !== true) {
        entitlements.collect_email = true;
    }
    if (entitlements.email_collector === true && entitlements.collect_email !== true) {
        entitlements.collect_email = true;
    }
    return entitlements;
};

const normalizePlanDocument = (plan) => {
    const comparison = parseJsonObjectArray(plan?.comparison_json || plan?.comparison);
    const entitlements = buildPlanEntitlements(comparison);
    const features = parseJsonArray(plan?.features);
    const monthlyLimit = normalizeStoredLimit(plan?.actions_per_month_limit);
    const activeAccountLimit = toFiniteNumber(plan?.instagram_connections_limit) || 0;
    const linkedAccountLimit = toFiniteNumber(plan?.instagram_link_limit);

    return {
        id: String(plan?.$id || '').trim(),
        plan_code: normalizePlanCode(plan?.plan_code || plan?.name),
        name: String(plan?.name || 'Plan').trim() || 'Plan',
        price_monthly_inr: Number(plan?.price_monthly_inr || 0),
        price_yearly_inr: Number(plan?.price_yearly_inr || 0),
        price_monthly_usd: Number(plan?.price_monthly_usd || 0),
        price_yearly_usd: Number(plan?.price_yearly_usd || 0),
        price_yearly_monthly_inr: Number(plan?.price_yearly_monthly_inr || 0),
        price_yearly_monthly_usd: Number(plan?.price_yearly_monthly_usd || 0),
        is_custom: Boolean(plan?.is_custom),
        is_popular: Boolean(plan?.is_popular),
        display_order: Number(plan?.display_order || 0),
        button_text: String(plan?.button_text || 'Choose Plan'),
        yearly_bonus: String(plan?.yearly_bonus || ''),
        features,
        comparison,
        entitlements,
        instagram_connections_limit: activeAccountLimit,
        instagram_link_limit: linkedAccountLimit != null ? linkedAccountLimit : activeAccountLimit,
        actions_per_hour_limit: toFiniteNumber(plan?.actions_per_hour_limit) || 0,
        actions_per_day_limit: toFiniteNumber(plan?.actions_per_day_limit) || 0,
        actions_per_month_limit: monthlyLimit
    };
};

const sortPlans = (plans) => plans.sort((a, b) => {
    if (a.display_order !== b.display_order) return a.display_order - b.display_order;
    return a.name.localeCompare(b.name);
});

const listPricingPlans = async (databases) => {
    const response = await databases.listDocuments(APPWRITE_DATABASE_ID, PRICING_COLLECTION_ID, [
        Query.limit(100)
    ]);
    return sortPlans((response.documents || []).map(normalizePlanDocument));
};

const findPlanByIdentifier = (plans, identifier) => {
    const normalizedIdentifier = normalizePlanCode(identifier);
    if (!normalizedIdentifier) return null;
    return plans.find((plan) =>
        plan.id === identifier
        || normalizePlanCode(plan.id) === normalizedIdentifier
        || normalizePlanCode(plan.plan_code) === normalizedIdentifier
        || normalizePlanCode(plan.name) === normalizedIdentifier
    ) || null;
};

const getPlanByIdentifier = async (databases, identifier) => {
    const plans = await listPricingPlans(databases);
    return findPlanByIdentifier(plans, identifier);
};

const getUserProfile = async (databases, userId) => {
    const result = await databases.listDocuments(APPWRITE_DATABASE_ID, PROFILES_COLLECTION_ID, [
        Query.equal('user_id', String(userId || '').trim()),
        Query.limit(1)
    ]);
    return result.documents?.[0] || null;
};

const getUserSelfMemory = async (databases, userId, userFallback = null) => {
    const fallbackId = String(userFallback?.$id || userId || '').trim();
    const useFallback = userFallback
        && (
            Object.prototype.hasOwnProperty.call(userFallback, 'plan_id')
            || Object.prototype.hasOwnProperty.call(userFallback, 'plan_expires_at')
            || Object.prototype.hasOwnProperty.call(userFallback, '$id')
        );
    if (useFallback) {
        return {
            user: {
                ...userFallback,
                $id: fallbackId || String(userFallback?.$id || '').trim()
            },
            plan_id: normalizePlanCode(userFallback?.plan_id || 'free') || 'free',
            plan_expires_at: userFallback?.plan_expires_at || null
        };
    }
    if (!fallbackId) {
        return {
            user: null,
            plan_id: 'free',
            plan_expires_at: null
        };
    }
    try {
        const user = await databases.getDocument(APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, fallbackId);
        return {
            user,
            plan_id: normalizePlanCode(user?.plan_id || 'free') || 'free',
            plan_expires_at: user?.plan_expires_at || null
        };
    } catch {
        return {
            user: null,
            plan_id: 'free',
            plan_expires_at: null
        };
    }
};

const isExpiredSubscription = (planId, expiresAt) => {
    if (normalizePlanCode(planId) === 'free') return false;
    if (!expiresAt) return false;
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed.getTime() < Date.now();
};

const parseProfileConfig = (profile) => {
    const parsed = parseJsonObject(profile?.feature_overrides_json, {});
    const rawFeatureOverrides = parseJsonObject(parsed.__feature_overrides, {});
    const rawLimitOverrides = parseJsonObject(parsed.__limit_overrides, {});
    const paidPlanSnapshot = parseJsonObject(parsed.__paid_plan_snapshot, null);

    const legacyFeatureOverrides = Object.entries(parsed).reduce((acc, [key, value]) => {
        if (RESERVED_PROFILE_CONFIG_KEYS.has(key)) return acc;
        acc[key] = value;
        return acc;
    }, {});

    return {
        raw: parsed,
        feature_overrides: {
            ...legacyFeatureOverrides,
            ...rawFeatureOverrides
        },
        limit_overrides: rawLimitOverrides,
        paid_plan_snapshot: paidPlanSnapshot && typeof paidPlanSnapshot === 'object'
            ? paidPlanSnapshot
            : null
    };
};

const parseRuntimeLimits = (profile = null) => {
    const parsed = parseJsonObject(profile?.limits_json, {});
    const monthlyValue = normalizeStoredLimit(
        parsed.monthly_action_limit
        ?? profile?.monthly_action_limit
    );

    return {
        instagram_connections_limit: toFiniteNumber(
            parsed.instagram_connections_limit
            ?? profile?.instagram_connections_limit
        ) ?? DEFAULT_FREE_PROFILE_LIMITS.instagram_connections_limit,
        instagram_link_limit: toFiniteNumber(
            parsed.instagram_link_limit
            ?? profile?.instagram_link_limit
        ) ?? (
            toFiniteNumber(parsed.instagram_connections_limit ?? profile?.instagram_connections_limit)
            ?? DEFAULT_FREE_PROFILE_LIMITS.instagram_link_limit
        ),
        hourly_action_limit: toFiniteNumber(
            parsed.hourly_action_limit
            ?? profile?.hourly_action_limit
        ) ?? DEFAULT_FREE_PROFILE_LIMITS.hourly_action_limit,
        daily_action_limit: toFiniteNumber(
            parsed.daily_action_limit
            ?? profile?.daily_action_limit
        ) ?? DEFAULT_FREE_PROFILE_LIMITS.daily_action_limit,
        monthly_action_limit: monthlyValue
    };
};

const parseRuntimeFeatures = (profile = null) => {
    const parsed = parseJsonObject(profile?.features_json, null);
    if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed;
    }

    return parseProfileConfig(profile).feature_overrides;
};

const parsePaidPlanSnapshot = (profile = null) => {
    const direct = parseJsonObject(profile?.paid_plan_snapshot_json, null);
    if (direct && typeof direct === 'object' && Object.keys(direct).length > 0) {
        return direct;
    }
    return parseProfileConfig(profile).paid_plan_snapshot;
};

const parseSnapshotRuntime = (snapshot = null) => {
    const runtime = parseJsonObject(snapshot?.__rt, null);
    return runtime && typeof runtime === 'object' ? runtime : {};
};

const serializeExpiredPlanRuntime = (snapshot = null) => {
    if (!snapshot || typeof snapshot !== 'object') return null;
    const planCode = normalizePlanCode(snapshot.plan_code || '');
    const planName = String(snapshot.plan_name || '').trim() || null;
    const expiresAt = toIsoDateTime(snapshot.expires_at || null);
    const payload = {
        c: planCode || null,
        n: planName,
        e: expiresAt
    };
    return Object.values(payload).some((value) => value) ? payload : null;
};

const applySnapshotRuntimeState = ({
    currentProfile = null,
    snapshot = null,
    resetReminderState = false,
    expiredPlanSnapshot = undefined
} = {}) => {
    const existingSnapshot = parseJsonObject(snapshot, null)
        || ((resetReminderState === true || expiredPlanSnapshot !== undefined)
            ? (parsePaidPlanSnapshot(currentProfile) || {})
            : null);

    if (!existingSnapshot || typeof existingSnapshot !== 'object') {
        return null;
    }

    const nextSnapshot = { ...existingSnapshot };
    const nextRuntime = { ...parseSnapshotRuntime(existingSnapshot) };

    if (resetReminderState === true) {
        delete nextRuntime.r;
    }

    if (expiredPlanSnapshot !== undefined) {
        const serializedExpired = serializeExpiredPlanRuntime(expiredPlanSnapshot);
        if (serializedExpired) {
            nextRuntime.lx = serializedExpired;
        } else {
            delete nextRuntime.lx;
        }
    }

    if (Object.keys(nextRuntime).length > 0) {
        nextSnapshot.__rt = nextRuntime;
    } else {
        delete nextSnapshot.__rt;
    }

    return Object.keys(nextSnapshot).length > 0 ? nextSnapshot : null;
};

const getRuntimePlanIdentity = (profile = null) => ({
    plan_code: normalizePlanCode(profile?.plan_code || 'free') || 'free',
    plan_name: String(profile?.plan_name || 'Free Plan').trim() || 'Free Plan',
    plan_status: normalizeSubscriptionStatus(profile?.plan_status || 'inactive'),
    billing_cycle: profile?.billing_cycle
        ? normalizeBillingCycle(profile.billing_cycle)
        : null,
    expires_at: profile?.expires_at || null
});

const inferPlanSource = (profile = null, selfMemory = null) => {
    const profilePlan = normalizePlanCode(profile?.plan_code || 'free') || 'free';
    const userPlan = normalizePlanCode(selfMemory?.plan_id || 'free') || 'free';
    const profileExpiry = toIsoDateTime(profile?.expires_at || null);
    const userExpiry = toIsoDateTime(selfMemory?.plan_expires_at || null);
    if (profilePlan !== userPlan) return 'admin';
    if ((profileExpiry || null) !== (userExpiry || null)) return 'admin';
    return 'self';
};

const buildRuntimeFeatureSnapshot = ({
    plan = null,
    featureOverrides = {},
    noWatermarkEnabled = false
} = {}) => {
    const entitlements = Object.entries(plan?.entitlements || {}).reduce((acc, [key, value]) => {
        if (value === true) {
            acc[key] = true;
        }
        return acc;
    }, {});

    Object.entries(parseJsonObject(featureOverrides, {})).forEach(([key, value]) => {
        const normalizedKey = normalizeFeatureKey(key);
        if (!normalizedKey || normalizedKey === 'watermark_text') return;
        if (normalizeBooleanEntitlement(value)) {
            entitlements[normalizedKey] = true;
        } else {
            delete entitlements[normalizedKey];
        }
    });

    if (noWatermarkEnabled === true) {
        entitlements.no_watermark = true;
    }

    return entitlements;
};

const buildAdminOverrideSummary = ({
    featureOverrides = {},
    limitOverrides = {}
} = {}) => {
    const limitKeys = Object.keys(parseJsonObject(limitOverrides, {}))
        .map((key) => String(key || '').trim())
        .filter(Boolean);
    const featureKeys = Object.keys(parseJsonObject(featureOverrides, {}))
        .map((key) => normalizeFeatureKey(key))
        .filter((key) => Boolean(key) && key !== 'watermark_text');

    if (limitKeys.length === 0 && featureKeys.length === 0) {
        return null;
    }

    return {
        l: limitKeys,
        f: featureKeys
    };
};

const buildProfileConfigPayload = ({
    currentProfile = null,
    featureOverrides,
    limitOverrides,
    paidPlanSnapshot
} = {}) => {
    const existing = parseProfileConfig(currentProfile);
    const nextFeatureOverrides = featureOverrides === undefined
        ? existing.feature_overrides
        : parseJsonObject(featureOverrides, {});
    const nextLimitOverrides = limitOverrides === undefined
        ? existing.limit_overrides
        : parseJsonObject(limitOverrides, {});
    const nextPaidPlanSnapshot = paidPlanSnapshot === undefined
        ? existing.paid_plan_snapshot
        : parseJsonObject(paidPlanSnapshot, null);
    const payload = {};

    if (Object.keys(nextFeatureOverrides).length > 0) {
        payload.__feature_overrides = nextFeatureOverrides;
    }
    if (Object.keys(nextLimitOverrides).length > 0) {
        payload.__limit_overrides = nextLimitOverrides;
    }
    if (nextPaidPlanSnapshot && typeof nextPaidPlanSnapshot === 'object' && Object.keys(nextPaidPlanSnapshot).length > 0) {
        payload.__paid_plan_snapshot = nextPaidPlanSnapshot;
    }

    return Object.keys(payload).length > 0 ? JSON.stringify(payload) : null;
};

const resolvePlanEntitlements = (plan, profile = null) => {
    const runtimeFeatures = parseJsonObject(profile?.features_json, null);
    if (runtimeFeatures && typeof runtimeFeatures === 'object' && Object.keys(runtimeFeatures).length > 0) {
        return runtimeFeatures;
    }

    const entitlements = {
        ...(plan?.entitlements || {})
    };
    const overrides = parseProfileConfig(profile).feature_overrides;

    Object.entries(overrides).forEach(([key, value]) => {
        const normalizedKey = normalizeFeatureKey(key);
        if (!normalizedKey) return;
        entitlements[normalizedKey] = normalizeBooleanEntitlement(value);
    });

    return entitlements;
};

const resolvePlanLimits = (plan, profile = null) => {
    const runtimeLimits = parseJsonObject(profile?.limits_json, null);
    if (runtimeLimits && typeof runtimeLimits === 'object' && Object.keys(runtimeLimits).length > 0) {
        return parseRuntimeLimits(profile);
    }

    const hourlyPlanLimit = toFiniteNumber(plan?.actions_per_hour_limit);
    const dailyPlanLimit = toFiniteNumber(plan?.actions_per_day_limit);
    const monthlyPlanLimit = normalizeStoredLimit(plan?.actions_per_month_limit);
    const planActiveLimit = toFiniteNumber(plan?.instagram_connections_limit) || 0;
    const planLinkedLimit = toFiniteNumber(plan?.instagram_link_limit);
    const profileConfig = parseProfileConfig(profile);
    const limitOverrides = profileConfig.limit_overrides;
    const profileMonthlyLimit = normalizeStoredLimit(
        limitOverrides.monthly_action_limit ?? profile?.monthly_action_limit
    );
    const profileHourlyLimit = toFiniteNumber(
        limitOverrides.hourly_action_limit ?? profile?.hourly_action_limit
    );
    const profileDailyLimit = toFiniteNumber(
        limitOverrides.daily_action_limit ?? profile?.daily_action_limit
    );
    const profileConnectionsLimit = toFiniteNumber(
        limitOverrides.instagram_connections_limit ?? profile?.instagram_connections_limit
    );
    const profileLinkLimit = toFiniteNumber(
        limitOverrides.instagram_link_limit ?? profile?.instagram_link_limit
    );

    return {
        instagram_connections_limit: profileConnectionsLimit != null
            ? profileConnectionsLimit
            : planActiveLimit,
        instagram_link_limit: profileLinkLimit != null
            ? profileLinkLimit
            : (planLinkedLimit != null ? planLinkedLimit : planActiveLimit),
        hourly_action_limit: profileHourlyLimit != null
            ? profileHourlyLimit
            : (hourlyPlanLimit != null ? hourlyPlanLimit : 0),
        daily_action_limit: profileDailyLimit != null
            ? profileDailyLimit
            : (dailyPlanLimit != null ? dailyPlanLimit : 0),
        monthly_action_limit: profileMonthlyLimit != null
            ? profileMonthlyLimit
            : (plan ? monthlyPlanLimit : null),
        no_watermark: resolvePlanEntitlements(plan, profile).no_watermark === true
    };
};

const buildPaidPlanSnapshot = ({
    plan,
    billingCycle = 'monthly',
    expires = null,
    status = 'active',
    limits = null
} = {}) => {
    if (!plan) return null;
    const resolvedLimits = limits || resolvePlanLimits(plan, null);
    return {
        plan_id: String(plan.plan_code || plan.id || 'free').trim() || 'free',
        billing_cycle: normalizeBillingCycle(billingCycle),
        status: normalizeSubscriptionStatus(status, 'active'),
        expires: toIsoDateTime(expires),
        limits: {
            instagram_connections_limit: Number(resolvedLimits.instagram_connections_limit || 0),
            instagram_link_limit: Number(resolvedLimits.instagram_link_limit || 0),
            hourly_action_limit: Number(resolvedLimits.hourly_action_limit || 0),
            daily_action_limit: Number(resolvedLimits.daily_action_limit || 0),
            monthly_action_limit: resolvedLimits.monthly_action_limit == null
                ? null
                : Number(resolvedLimits.monthly_action_limit || 0)
        }
    };
};

const buildPlanProfilePayload = ({
    currentProfile = null,
    plan = null,
    planId = null,
    billingCycle = null,
    subscriptionStatus = 'inactive',
    subscriptionExpires = null,
    featureOverrides = undefined,
    limitOverrides = undefined,
    noWatermarkEnabled = undefined,
    paidPlanSnapshot = undefined,
    credits = undefined,
    preserveUsage = true,
    resetReminderState = undefined,
    expiredPlanSnapshot = undefined
} = {}) => {
    const normalizedPlanId = String(planId || plan?.plan_code || plan?.id || 'free').trim() || 'free';
    const isFreePlan = normalizePlanCode(normalizedPlanId) === 'free';
    const normalizedStatus = isFreePlan
        ? 'inactive'
        : normalizeSubscriptionStatus(subscriptionStatus, 'active');
    const normalizedBillingCycle = isFreePlan
        ? null
        : normalizeBillingCycle(billingCycle || currentProfile?.billing_cycle || 'monthly');
    const normalizedExpires = isFreePlan ? null : toIsoDateTime(subscriptionExpires);
    const defaults = resolvePlanLimits(plan, null);
    const nextFeatureOverrides = featureOverrides === undefined
        ? parseProfileConfig(currentProfile).feature_overrides
        : parseJsonObject(featureOverrides, {});
    const nextLimitOverrides = limitOverrides === undefined
        ? parseProfileConfig(currentProfile).limit_overrides
        : parseJsonObject(limitOverrides, {});
    const resolvedNoWatermark = noWatermarkEnabled === undefined
        ? Boolean(nextFeatureOverrides.no_watermark ?? defaults.no_watermark)
        : Boolean(noWatermarkEnabled);
    const effectiveLimits = {
        instagram_connections_limit: toFiniteNumber(nextLimitOverrides.instagram_connections_limit) != null
            ? Number(nextLimitOverrides.instagram_connections_limit)
            : Number(defaults.instagram_connections_limit || 0),
        instagram_link_limit: toFiniteNumber(nextLimitOverrides.instagram_link_limit) != null
            ? Number(nextLimitOverrides.instagram_link_limit)
            : Number(defaults.instagram_link_limit || defaults.instagram_connections_limit || 0),
        hourly_action_limit: toFiniteNumber(nextLimitOverrides.hourly_action_limit) != null
            ? Number(nextLimitOverrides.hourly_action_limit)
            : Number(defaults.hourly_action_limit || 0),
        daily_action_limit: toFiniteNumber(nextLimitOverrides.daily_action_limit) != null
            ? Number(nextLimitOverrides.daily_action_limit)
            : Number(defaults.daily_action_limit || 0),
        monthly_action_limit: nextLimitOverrides.monthly_action_limit === null
            ? null
            : (
                toFiniteNumber(nextLimitOverrides.monthly_action_limit) != null
                    ? Number(nextLimitOverrides.monthly_action_limit)
                    : defaults.monthly_action_limit
            )
    };
    const runtimeFeatures = buildRuntimeFeatureSnapshot({
        plan,
        featureOverrides: nextFeatureOverrides,
        noWatermarkEnabled: resolvedNoWatermark
    });
    const adminOverrideSummary = buildAdminOverrideSummary({
        featureOverrides: nextFeatureOverrides,
        limitOverrides: nextLimitOverrides
    });
    const shouldResetReminderState = resetReminderState === true;
    const basePaidSnapshotPayload = paidPlanSnapshot === undefined
        ? (isFreePlan ? null : (parsePaidPlanSnapshot(currentProfile) || null))
        : parseJsonObject(paidPlanSnapshot, null);
    const paidSnapshotPayload = applySnapshotRuntimeState({
        currentProfile,
        snapshot: basePaidSnapshotPayload,
        resetReminderState: shouldResetReminderState,
        expiredPlanSnapshot
    }) || basePaidSnapshotPayload;

    const payload = {
        user_id: String(currentProfile?.user_id || '').trim() || undefined,
        plan_code: normalizedPlanId,
        plan_name: String(plan?.name || currentProfile?.plan_name || normalizedPlanId || 'Free Plan').trim() || 'Free Plan',
        plan_status: normalizedStatus,
        billing_cycle: normalizedBillingCycle,
        expires_at: normalizedExpires,
        limits_json: JSON.stringify({
            instagram_connections_limit: Number(effectiveLimits.instagram_connections_limit || 0),
            instagram_link_limit: Number(effectiveLimits.instagram_link_limit || 0),
            hourly_action_limit: Number(effectiveLimits.hourly_action_limit || 0),
            daily_action_limit: Number(effectiveLimits.daily_action_limit || 0),
            monthly_action_limit: effectiveLimits.monthly_action_limit == null
                ? null
                : Number(effectiveLimits.monthly_action_limit || 0)
        }),
        features_json: JSON.stringify(runtimeFeatures),
        paid_plan_snapshot_json: paidSnapshotPayload ? JSON.stringify(paidSnapshotPayload) : null,
        admin_override_json: adminOverrideSummary ? JSON.stringify(adminOverrideSummary) : null,
        kill_switch_enabled: currentProfile?.kill_switch_enabled !== false,
        instagram_connections_limit: Number(effectiveLimits.instagram_connections_limit || 0),
        instagram_link_limit: Number(effectiveLimits.instagram_link_limit || 0),
        hourly_action_limit: Number(effectiveLimits.hourly_action_limit || 0),
        daily_action_limit: Number(effectiveLimits.daily_action_limit || 0),
        monthly_action_limit: encodeProfileLimit(effectiveLimits.monthly_action_limit),
        feature_overrides_json: buildProfileConfigPayload({
            currentProfile,
            featureOverrides: nextFeatureOverrides,
            limitOverrides: nextLimitOverrides,
            paidPlanSnapshot: paidSnapshotPayload
        })
    };

    if (credits !== undefined) {
        payload.credits = Number(credits || 0);
    } else if (!currentProfile?.$id && currentProfile?.credits !== undefined) {
        payload.credits = Number(currentProfile.credits || 0);
    }

    if (preserveUsage && currentProfile) {
        payload.hourly_actions_used = Number(currentProfile.hourly_actions_used || 0);
        payload.daily_actions_used = Number(currentProfile.daily_actions_used || 0);
        payload.monthly_actions_used = Number(currentProfile.monthly_actions_used || 0);
    }

    Object.keys(payload).forEach((key) => {
        if (payload[key] === undefined) {
            delete payload[key];
        }
    });

    return payload;
};

const inferBillingCycleFromExpiry = (expiresAt) => {
    if (!expiresAt) return 'monthly';
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) return 'monthly';
    const remainingDays = Math.ceil((parsed.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return remainingDays > 180 ? 'yearly' : 'monthly';
};

const updateUserSelfPlanMemory = async (databases, userId, planId = 'free', planExpiresAt = null) => {
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) return null;
    try {
        return await databases.updateDocument(APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, safeUserId, {
            plan_id: normalizePlanCode(planId || 'free') || 'free',
            plan_expires_at: planExpiresAt || null
        });
    } catch {
        return null;
    }
};

const upsertEffectiveProfile = async (databases, userId, currentProfile, plan, options = {}) => {
    const safeUserId = String(userId || '').trim();
    if (!safeUserId || !plan) return currentProfile;
    const payload = buildPlanProfilePayload({
        currentProfile,
        plan,
        planId: options.planId || plan.plan_code || plan.id || 'free',
        billingCycle: options.billingCycle || null,
        subscriptionStatus: options.subscriptionStatus || (normalizePlanCode(plan.plan_code || plan.id) === 'free' ? 'inactive' : 'active'),
        subscriptionExpires: options.subscriptionExpires || null,
        featureOverrides: options.featureOverrides,
        limitOverrides: options.limitOverrides,
        noWatermarkEnabled: options.noWatermarkEnabled,
        paidPlanSnapshot: options.paidPlanSnapshot,
        preserveUsage: options.preserveUsage !== false,
        resetReminderState: options.resetReminderState,
        expiredPlanSnapshot: options.expiredPlanSnapshot
    });
    try {
        if (currentProfile?.$id) {
            return await databases.updateDocument(APPWRITE_DATABASE_ID, PROFILES_COLLECTION_ID, currentProfile.$id, payload);
        }
        return await databases.createDocument(APPWRITE_DATABASE_ID, PROFILES_COLLECTION_ID, safeUserId, {
            user_id: safeUserId,
            ...payload
        });
    } catch {
        return {
            ...(currentProfile || {}),
            $id: currentProfile?.$id || safeUserId,
            user_id: safeUserId,
            ...payload
        };
    }
};

const resolveUserPlanContext = async (databases, userId, userFallback = null) => {
    const safeUserId = String(userId || userFallback?.$id || '').trim();
    const [plans, selfMemory, existingProfile] = await Promise.all([
        listPricingPlans(databases),
        getUserSelfMemory(databases, safeUserId, userFallback),
        getUserProfile(databases, safeUserId)
    ]);
    const freePlan = findPlanByIdentifier(plans, 'free') || normalizePlanDocument({ plan_code: 'free', name: 'Free Plan' });

    let profile = existingProfile;
    let runtimeIdentity = getRuntimePlanIdentity(profile);
    let effectivePlanId = runtimeIdentity.plan_code || 'free';
    let effectivePlan = findPlanByIdentifier(plans, effectivePlanId) || freePlan;
    let planSource = inferPlanSource(profile, selfMemory);
    let billingCycle = runtimeIdentity.billing_cycle;
    let subscriptionStatus = runtimeIdentity.plan_status;
    let effectiveExpiresAt = runtimeIdentity.expires_at;

    const selfPlanId = normalizePlanCode(selfMemory.plan_id || 'free') || 'free';
    const selfPlanExpiresAt = selfMemory.plan_expires_at || null;
    const selfPlanExpired = isExpiredSubscription(selfPlanId, selfPlanExpiresAt);
    const effectivePlanExpired = isExpiredSubscription(effectivePlanId, effectiveExpiresAt);

    if (selfPlanExpired) {
        await updateUserSelfPlanMemory(databases, safeUserId, 'free', null);
    }

    if (effectivePlanExpired) {
        const activeSelfPlan = selfPlanId !== 'free' && !selfPlanExpired
            ? (findPlanByIdentifier(plans, selfPlanId) || null)
            : null;

        if (planSource === 'admin' && effectivePlanId !== 'free' && activeSelfPlan) {
            profile = await upsertEffectiveProfile(databases, safeUserId, profile, activeSelfPlan, {
                planId: selfPlanId,
                billingCycle: inferBillingCycleFromExpiry(selfPlanExpiresAt),
                subscriptionStatus: 'active',
                subscriptionExpires: selfPlanExpiresAt,
                paidPlanSnapshot: buildPaidPlanSnapshot({
                    plan: activeSelfPlan,
                    billingCycle: inferBillingCycleFromExpiry(selfPlanExpiresAt),
                    expires: selfPlanExpiresAt,
                    status: 'active'
                })
            });
        } else {
            profile = await upsertEffectiveProfile(databases, safeUserId, profile, freePlan, {
                planId: 'free',
                billingCycle: null,
                subscriptionStatus: 'inactive',
                subscriptionExpires: null
            });
            if (planSource !== 'admin' || effectivePlanId !== 'free') {
                await updateUserSelfPlanMemory(databases, safeUserId, 'free', null);
            }
        }
        runtimeIdentity = getRuntimePlanIdentity(profile);
        effectivePlanId = runtimeIdentity.plan_code || 'free';
        effectivePlan = findPlanByIdentifier(plans, effectivePlanId) || freePlan;
        planSource = inferPlanSource(profile, {
            ...selfMemory,
            plan_id: selfPlanExpired ? 'free' : selfPlanId,
            plan_expires_at: selfPlanExpired ? null : selfPlanExpiresAt
        });
        billingCycle = runtimeIdentity.billing_cycle;
        subscriptionStatus = runtimeIdentity.plan_status;
        effectiveExpiresAt = runtimeIdentity.expires_at;
    }

    return {
        profile,
        plans,
        plan: effectivePlan,
        planSource,
        subscriptionPlanId: effectivePlanId,
        subscriptionStatus: normalizeSubscriptionStatus(subscriptionStatus),
        billingCycle: billingCycle ? normalizeBillingCycle(billingCycle) : null,
        entitlements: resolvePlanEntitlements(effectivePlan, profile),
        limits: resolvePlanLimits(effectivePlan, profile),
        selfPlanId: selfPlanExpired ? 'free' : selfPlanId,
        selfPlanExpiresAt: selfPlanExpired ? null : selfPlanExpiresAt,
        selfUserDocument: selfMemory.user || null
    };
};

module.exports = {
    parseJsonArray,
    parseJsonObject,
    parseJsonObjectArray,
    normalizePlanCode,
    normalizePlanSource,
    normalizeFeatureKey,
    normalizeBooleanEntitlement,
    normalizeStoredLimit,
    encodeProfileLimit,
    PLAN_DURATION_DAYS,
    normalizeBillingCycle,
    resolvePlanDurationDays,
    normalizeSubscriptionStatus,
    calculateSubscriptionExpiry,
    parseRuntimeLimits,
    parseRuntimeFeatures,
    parsePaidPlanSnapshot,
    getRuntimePlanIdentity,
    inferPlanSource,
    parseProfileConfig,
    buildProfileConfigPayload,
    buildPlanProfilePayload,
    buildPaidPlanSnapshot,
    buildRuntimeFeatureSnapshot,
    buildAdminOverrideSummary,
    buildPlanEntitlements,
    normalizePlanDocument,
    listPricingPlans,
    findPlanByIdentifier,
    getPlanByIdentifier,
    getUserProfile,
    getUserSelfMemory,
    resolvePlanEntitlements,
    resolvePlanLimits,
    updateUserSelfPlanMemory,
    upsertEffectiveProfile,
    resolveUserPlanContext
};

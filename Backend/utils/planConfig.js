const { Query } = require('node-appwrite');
const rawSharedPlanFeatures = require('../../shared/planFeatures.json');
const {
    APPWRITE_DATABASE_ID,
    PRICING_COLLECTION_ID,
    PROFILES_COLLECTION_ID,
    TRANSACTIONS_COLLECTION_ID
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
const VALID_PLAN_SOURCES = new Set(['payment', 'admin', 'system']);
const PLAN_SOURCE_DEBUG = String(process.env.DEBUG_PLAN_SOURCE || '').trim() === '1';
const isValidPlanSource = (value) => VALID_PLAN_SOURCES.has(String(value || '').trim().toLowerCase());
const normalizePlanSource = (value, fallback = 'system') => {
    const normalized = String(value || '').trim().toLowerCase();
    if (VALID_PLAN_SOURCES.has(normalized)) return normalized;
    const normalizedFallback = String(fallback || 'system').trim().toLowerCase();
    return VALID_PLAN_SOURCES.has(normalizedFallback) ? normalizedFallback : 'system';
};

const normalizeFeatureKey = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[+/\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const DEFAULT_PLAN_FEATURES = Object.freeze({
    version: '2.1.0',
    benefitFieldPrefix: 'benefit_',
    benefitKeys: [
        'unlimited_contacts',
        'post_comment_dm_reply',
        'post_comment_reply_automation',
        'reel_comment_dm_reply',
        'reel_comment_reply_automation',
        'share_reel_to_admin',
        'share_post_to_admin',
        'super_profile',
        'inbox_menu',
        'collect_email',
        'suggest_more',
        'followers_only',
        'comment_moderation',
        'seen_typing',
        'welcome_message',
        'convo_starters',
        'dm_automation',
        'story_automation',
        'no_watermark',
        'global_trigger',
        'mentions',
        'instagram_live_automation',
        'priority_support',
        'once_per_user_24h'
    ],
    benefitStorageKeys: {
        post_comment_reply_automation: 'post_comment_reply',
        reel_comment_reply_automation: 'reel_comment_reply'
    },
    legacyBenefitStorageKeys: {
        post_comment_reply_automation: ['post_comment_reply'],
        reel_comment_reply_automation: ['reel_comment_reply'],
        post_comment_dm_reply: ['post_comment_dm_automation'],
        reel_comment_dm_reply: ['reel_comment_dm_automation'],
        share_reel_to_admin: ['share_reel_to_dm'],
        share_post_to_admin: ['share_post_to_dm']
    },
    benefitAliases: {
        post_comment_dm: 'post_comment_dm_reply',
        post_comment_dm_automation: 'post_comment_dm_reply',
        post_comment_reply: 'post_comment_reply_automation',
        reel_comment_dm: 'reel_comment_dm_reply',
        reel_comment_dm_automation: 'reel_comment_dm_reply',
        reel_comment_reply: 'reel_comment_reply_automation',
        share_reel_to_dm: 'share_reel_to_admin',
        share_post_to_dm: 'share_post_to_admin',
        dm_automations: 'dm_automation',
        auto_reply_dm_keywords: 'dm_automation',
        story_mentions_custom_dm: 'mentions',
        mention: 'mentions',
        email_collector: 'collect_email',
        webhook_integrations: 'collect_email',
        seen_typing_indicator: 'seen_typing',
        no_watermark_branding: 'no_watermark',
        once_per_user: 'once_per_user_24h',
        instagram_connections: 'instagram_connections_limit'
    },
    limitKeys: [
        'instagram_connections_limit',
        'actions_per_hour_limit',
        'actions_per_day_limit',
        'actions_per_month_limit',
        'hourly_action_limit',
        'daily_action_limit',
        'monthly_action_limit'
    ]
});

const EXPECTED_PLAN_FEATURES_VERSION = process.env.PLAN_FEATURES_VERSION || DEFAULT_PLAN_FEATURES.version;
const SHARED_PLAN_FEATURES_VERSION = String(rawSharedPlanFeatures?.version || '').trim();
const PLAN_FEATURES_VERSION_MISMATCH = SHARED_PLAN_FEATURES_VERSION && SHARED_PLAN_FEATURES_VERSION !== EXPECTED_PLAN_FEATURES_VERSION;
if (PLAN_FEATURES_VERSION_MISMATCH) {
    console.error(
        `[plan-features] version mismatch detected. expected=${EXPECTED_PLAN_FEATURES_VERSION} actual=${SHARED_PLAN_FEATURES_VERSION}. Falling back to bundled defaults.`
    );
}
const sharedPlanFeatures = PLAN_FEATURES_VERSION_MISMATCH ? DEFAULT_PLAN_FEATURES : {
    ...DEFAULT_PLAN_FEATURES,
    ...(rawSharedPlanFeatures || {})
};

const BENEFIT_KEYS = Object.freeze(sharedPlanFeatures.benefitKeys || DEFAULT_PLAN_FEATURES.benefitKeys);
const BENEFIT_KEY_SET = new Set(BENEFIT_KEYS);
const BENEFIT_FIELD_PREFIX = sharedPlanFeatures.benefitFieldPrefix || DEFAULT_PLAN_FEATURES.benefitFieldPrefix;
const BENEFIT_ALIASES = Object.freeze(sharedPlanFeatures.benefitAliases || DEFAULT_PLAN_FEATURES.benefitAliases);
const BENEFIT_STORAGE_KEYS = Object.freeze(sharedPlanFeatures.benefitStorageKeys || DEFAULT_PLAN_FEATURES.benefitStorageKeys);
const LEGACY_BENEFIT_STORAGE_KEYS = Object.freeze(sharedPlanFeatures.legacyBenefitStorageKeys || DEFAULT_PLAN_FEATURES.legacyBenefitStorageKeys || {});
const FEATURE_LABELS = Object.freeze(sharedPlanFeatures.featureLabels || {});
const FEATURE_LAYER_MAP = Object.freeze(sharedPlanFeatures.featureLayerMap || {});

const benefitFieldForKey = (key) => `${BENEFIT_FIELD_PREFIX}${BENEFIT_STORAGE_KEYS[key] || key}`;

const normalizeBenefitKey = (value) => {
    const normalized = normalizeFeatureKey(value);
    if (!normalized) return '';
    const withoutPrefix = normalized.startsWith(BENEFIT_FIELD_PREFIX)
        ? normalized.slice(BENEFIT_FIELD_PREFIX.length)
        : normalized;
    return BENEFIT_ALIASES[withoutPrefix] || withoutPrefix;
};

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

const getFeatureLabel = (key) => {
    const normalizedKey = normalizeBenefitKey(key);
    return FEATURE_LABELS[normalizedKey] || String(normalizedKey || key || '')
        .split(/[_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

const RESERVED_PROFILE_CONFIG_KEYS = new Set([
    '__feature_overrides',
    '__limit_overrides'
]);
const LIMIT_ENTITLEMENT_KEYS = new Set(sharedPlanFeatures.limitKeys || DEFAULT_PLAN_FEATURES.limitKeys);

const DEFAULT_FREE_PROFILE_LIMITS = Object.freeze({
    instagram_connections_limit: 0,
    active_account_limit: 0,
    hourly_action_limit: 0,
    daily_action_limit: 0,
    monthly_action_limit: null
});

const PLAN_DURATION_DAYS = Object.freeze({
    monthly: 30,
    yearly: 364
});

const VALID_SELF_SUBSCRIPTION_STATUSES = new Set(['success', 'paid', 'captured', 'completed', 'active']);
const NEGATIVE_SELF_SUBSCRIPTION_STATUSES = new Set([
    'refunded',
    'partially_refunded',
    'chargeback',
    'disputed',
    'void',
    'reversed',
    'cancelled',
    'canceled'
]);
const IGNORED_SELF_SUBSCRIPTION_STATUSES = new Set([
    'pending',
    'created',
    'attempted',
    'failed',
    'failure',
    'expired',
    'abandoned'
]);

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

const normalizeBenefitMap = (value = {}) => {
    const source = parseJsonObject(value, {});
    return Object.entries(source).reduce((acc, [key, enabled]) => {
        const normalizedKey = normalizeBenefitKey(key);
        if (!normalizedKey || !BENEFIT_KEY_SET.has(normalizedKey)) return acc;
        acc[normalizedKey] = normalizeBooleanEntitlement(enabled);
        return acc;
    }, {});
};

const extractBenefitAttributes = (document = {}) => BENEFIT_KEYS.reduce((acc, key) => {
    const field = benefitFieldForKey(key);
    const legacyField = `${BENEFIT_FIELD_PREFIX}${key}`;
    if (Object.prototype.hasOwnProperty.call(document || {}, field)) {
        acc[key] = normalizeBooleanEntitlement(document[field]);
    } else if (legacyField !== field && Object.prototype.hasOwnProperty.call(document || {}, legacyField)) {
        acc[key] = normalizeBooleanEntitlement(document[legacyField]);
    } else if (Object.prototype.hasOwnProperty.call(document || {}, key)) {
        acc[key] = normalizeBooleanEntitlement(document[key]);
    } else {
        for (const legacyStorageKey of LEGACY_BENEFIT_STORAGE_KEYS[key] || []) {
            const alternateField = `${BENEFIT_FIELD_PREFIX}${legacyStorageKey}`;
            if (Object.prototype.hasOwnProperty.call(document || {}, alternateField)) {
                acc[key] = normalizeBooleanEntitlement(document[alternateField]);
                break;
            }
        }
    }
    return acc;
}, {});

const buildPlanEntitlements = (comparison, planDocument = null) => {
    const entries = Array.isArray(comparison) ? comparison : [];
    const entitlements = entries.reduce((acc, item) => {
        const key = normalizeBenefitKey(item?.key || item?.label);
        if (!key || LIMIT_ENTITLEMENT_KEYS.has(key)) return acc;
        acc[key] = normalizeBooleanEntitlement(item?.value);
        return acc;
    }, {});
    const featureListEntitlements = parseJsonArray(planDocument?.features).reduce((acc, item) => {
        const key = normalizeBenefitKey(item);
        if (!key || LIMIT_ENTITLEMENT_KEYS.has(key)) return acc;
        acc[key] = true;
        return acc;
    }, {});
    const booleanAttributes = extractBenefitAttributes(planDocument || {});
    return BENEFIT_KEYS.reduce((acc, key) => {
        acc[key] = Boolean(booleanAttributes[key] ?? entitlements[key] ?? featureListEntitlements[key] ?? false);
        return acc;
    }, {});
};

const normalizePlanDocument = (plan) => {
    const comparison = parseJsonObjectArray(plan?.comparison_json || plan?.comparison);
    const entitlements = buildPlanEntitlements(comparison, plan);
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
        actions_per_month_limit: monthlyLimit,
        monthly_duration_days: toFiniteNumber(plan?.monthly_duration_days) || PLAN_DURATION_DAYS.monthly,
        yearly_duration_days: toFiniteNumber(plan?.yearly_duration_days) || PLAN_DURATION_DAYS.yearly
    };
};

const getPlanFeatureItems = (features = {}) => BENEFIT_KEYS.map((key) => ({
    key,
    label: getFeatureLabel(key),
    enabled: features?.[key] === true
}));

const buildAccountLimitEnvelope = ({
    instagram_connections_limit,
    instagram_link_limit
} = {}) => {
    const baseActiveLimit = Math.max(0, Number(toFiniteNumber(instagram_connections_limit) || 0));
    const maxAllowedAccounts = Math.max(
        0,
        Number(toFiniteNumber(instagram_link_limit) ?? toFiniteNumber(instagram_connections_limit) ?? 0)
    );
    const activeAccountLimit = Math.max(0, Math.min(baseActiveLimit, maxAllowedAccounts));

    return {
        instagram_connections_limit: baseActiveLimit,
        instagram_link_limit: maxAllowedAccounts,
        active_account_limit: activeAccountLimit
    };
};

const getPlanLimitsEnvelope = (limits = {}) => {
    const accountEnvelope = buildAccountLimitEnvelope(limits);
    const connections = Number(accountEnvelope.instagram_connections_limit || 0);
    const linkLimit = Number(accountEnvelope.instagram_link_limit || connections || 0);
    const hourly = Number(limits.hourly_action_limit ?? limits.actions_per_hour_limit ?? 0);
    const daily = Number(limits.daily_action_limit ?? limits.actions_per_day_limit ?? 0);
    const monthlyRaw = limits.monthly_action_limit ?? limits.actions_per_month_limit;
    const monthly = monthlyRaw == null ? null : Number(monthlyRaw || 0);
    return {
        connections,
        instagram_connections_limit: connections,
        instagram_link_limit: linkLimit,
        active_account_limit: accountEnvelope.active_account_limit,
        per_hour: hourly,
        per_day: daily,
        per_month: monthly,
        hourly_action_limit: hourly,
        daily_action_limit: daily,
        monthly_action_limit: monthly,
        actions_per_hour_limit: hourly,
        actions_per_day_limit: daily,
        actions_per_month_limit: monthly
    };
};

const buildPlanApiPayload = (plan, profile = null) => {
    const normalized = normalizePlanDocument(plan || {});
    const features = resolvePlanEntitlements(normalized, profile);
    const resolvedLimits = resolvePlanLimits(normalized, profile);
    const limits = getPlanLimitsEnvelope(resolvedLimits);
    const featureItems = getPlanFeatureItems(features);
    return {
        id: normalized.id,
        plan_code: normalized.plan_code,
        name: normalized.name,
        display_order: normalized.display_order,
        button_text: normalized.button_text,
        is_popular: normalized.is_popular,
        is_custom: normalized.is_custom,
        pricing: {
            monthly: {
                inr: normalized.price_monthly_inr,
                usd: normalized.price_monthly_usd
            },
            yearly: {
                inr: normalized.price_yearly_inr,
                usd: normalized.price_yearly_usd
            },
            yearly_monthly_display: {
                inr: normalized.price_yearly_monthly_inr,
                usd: normalized.price_yearly_monthly_usd
            }
        },
        duration_days: {
            monthly: normalized.monthly_duration_days,
            yearly: normalized.yearly_duration_days
        },
        limits,
        features,
        feature_items: featureItems,
        feature_layer_map: FEATURE_LAYER_MAP,
        yearly_bonus: normalized.yearly_bonus,
        entitlements: features,
        comparison: featureItems.map((item) => ({
            key: item.key,
            label: item.label,
            value: item.enabled
        })),
        price_monthly_inr: normalized.price_monthly_inr,
        price_monthly_usd: normalized.price_monthly_usd,
        price_yearly_inr: normalized.price_yearly_inr,
        price_yearly_usd: normalized.price_yearly_usd,
        price_yearly_monthly_inr: normalized.price_yearly_monthly_inr,
        price_yearly_monthly_usd: normalized.price_yearly_monthly_usd,
        instagram_connections_limit: limits.instagram_connections_limit,
        instagram_link_limit: limits.instagram_link_limit,
        active_account_limit: limits.active_account_limit,
        actions_per_hour_limit: limits.actions_per_hour_limit,
        actions_per_day_limit: limits.actions_per_day_limit,
        actions_per_month_limit: limits.actions_per_month_limit
    };
};

const buildPricingComparison = (planPayloads = []) => BENEFIT_KEYS.map((key) => ({
    key,
    label: getFeatureLabel(key),
    values: planPayloads.reduce((acc, plan) => {
        acc[plan.plan_code || plan.id] = plan.features?.[key] === true;
        return acc;
    }, {})
}));

const buildPricingApiPayload = (plans = [], currencyPolicy = {}) => {
    const payloadPlans = sortPlans(plans.map((plan) => buildPlanApiPayload(plan)));
    return {
        plans: payloadPlans,
        comparison: buildPricingComparison(payloadPlans),
        feature_layer_map: FEATURE_LAYER_MAP,
        currency: {
            country_code: currencyPolicy.countryCode || null,
            default: currencyPolicy.defaultCurrency || 'USD',
            allowed: currencyPolicy.allowedCurrencies || ['USD', 'INR']
        },
        country_code: currencyPolicy.countryCode || null,
        default_currency: currencyPolicy.defaultCurrency || 'USD',
        allowed_currencies: currencyPolicy.allowedCurrencies || ['USD', 'INR']
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

const pickTransactionValue = (transaction, ...keys) => {
    for (const key of keys) {
        if (transaction?.[key] !== undefined && transaction?.[key] !== null && transaction?.[key] !== '') {
            return transaction[key];
        }
    }
    return null;
};

const normalizeTransactionStatus = (value) => String(value || '').trim().toLowerCase();

const getTransactionPlanId = (transaction) => normalizePlanCode(
    pickTransactionValue(transaction, 'planCode', 'plan_code', 'planId', 'plan_id', 'planName', 'plan_name')
);

const getTransactionCreatedAt = (transaction) => (
    pickTransactionValue(transaction, 'transactionDate', 'transaction_date', 'created_at', '$createdAt')
);

const getTransactionBillingCycle = (transaction) => normalizeBillingCycle(
    pickTransactionValue(transaction, 'billingCycle', 'billing_cycle') || 'monthly'
);

const calculateTransactionExpiry = (transaction, plan = null) => {
    const billingCycle = getTransactionBillingCycle(transaction);
    const startDate = getTransactionCreatedAt(transaction);
    const durationDays = billingCycle === 'yearly'
        ? toFiniteNumber(plan?.yearly_duration_days) || PLAN_DURATION_DAYS.yearly
        : toFiniteNumber(plan?.monthly_duration_days) || PLAN_DURATION_DAYS.monthly;
    return calculateSubscriptionExpiry({
        billingCycle,
        durationDays,
        baseDate: startDate
    });
};

const listUserTransactions = async (databases, userId, limit = 250) => {
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) return [];
    const [bySnakeCase, byCamelCase] = await Promise.all([
        databases.listDocuments(APPWRITE_DATABASE_ID, TRANSACTIONS_COLLECTION_ID, [
            Query.equal('user_id', safeUserId),
            Query.limit(limit)
        ]).catch(() => ({ documents: [] })),
        databases.listDocuments(APPWRITE_DATABASE_ID, TRANSACTIONS_COLLECTION_ID, [
            Query.equal('userId', safeUserId),
            Query.limit(limit)
        ]).catch(() => ({ documents: [] }))
    ]);
    const seen = new Set();
    return [...(bySnakeCase.documents || []), ...(byCamelCase.documents || [])].filter((doc) => {
        const key = String(doc?.$id || doc?.transactionId || '').trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const parseAdminOverride = (profile = null) => {
    const parsed = parseJsonObject(profile?.admin_override_json, null);
    if (!parsed || typeof parsed !== 'object') return null;
    const planId = normalizePlanCode(parsed.p || parsed.plan_id || parsed.plan_code || 'free') || 'free';
    const expiresAt = toIsoDateTime(parsed.e || parsed.expires_at || parsed.expiry_date || null);
    const billingCycle = (parsed.b || parsed.billing_cycle) ? normalizeBillingCycle(parsed.b || parsed.billing_cycle) : null;
    return {
        plan_id: planId,
        plan_name: String(parsed.n || parsed.plan_name || parsed.name || profile?.plan_name || planId || '').trim() || null,
        billing_cycle: billingCycle,
        expires_at: expiresAt,
        created_at: toIsoDateTime(parsed.c || parsed.created_at || null),
        limit_overrides: expandAdminOverrideLimitOverrides(parsed.l || parsed.limit_overrides),
        feature_overrides: expandAdminOverrideFeatureOverrides(parsed.f || parsed.feature_overrides)
    };
};

const hasActiveAdminOverride = (override = null) => {
    if (!override?.expires_at) return false;
    const parsed = new Date(override.expires_at);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed.getTime() > Date.now();
};

const buildAdminOverridePayload = ({
    planId = 'free',
    billingCycle = null,
    expiresAt = null,
    planName = null,
    createdAt = null,
    limitOverrides = {},
    featureOverrides = {}
} = {}) => {
    const normalizedPlanId = normalizePlanCode(planId || 'free') || 'free';
    const normalizedExpiresAt = toIsoDateTime(expiresAt);
    if (!normalizedExpiresAt) return null;
    void planName;
    void createdAt;
    void limitOverrides;
    void featureOverrides;
    return JSON.stringify({
        p: normalizedPlanId,
        b: billingCycle ? normalizeBillingCycle(billingCycle) : null,
        e: normalizedExpiresAt
    });
};

const clearAdminOverridePayload = () => null;

const ADMIN_OVERRIDE_LIMIT_KEY_MAP = Object.freeze({
    instagram_connections_limit: 'i',
    hourly_action_limit: 'h',
    daily_action_limit: 'd',
    monthly_action_limit: 'm'
});

const ADMIN_OVERRIDE_LIMIT_KEY_MAP_REVERSE = Object.freeze(
    Object.entries(ADMIN_OVERRIDE_LIMIT_KEY_MAP).reduce((acc, [key, shortKey]) => {
        acc[shortKey] = key;
        return acc;
    }, {})
);

const ADMIN_OVERRIDE_FEATURE_KEY_MAP = Object.freeze(
    BENEFIT_KEYS.reduce((acc, key, index) => {
        acc[key] = index.toString(36);
        return acc;
    }, {})
);

const ADMIN_OVERRIDE_FEATURE_KEY_MAP_REVERSE = Object.freeze(
    Object.entries(ADMIN_OVERRIDE_FEATURE_KEY_MAP).reduce((acc, [key, shortKey]) => {
        acc[shortKey] = key;
        return acc;
    }, {})
);

const compactAdminOverrideLimitOverrides = (overrides = {}) => Object.entries(parseJsonObject(overrides, {})).reduce((acc, [key, value]) => {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey || value === undefined) return acc;
    acc[ADMIN_OVERRIDE_LIMIT_KEY_MAP[normalizedKey] || normalizedKey] = value;
    return acc;
}, {});

const expandAdminOverrideLimitOverrides = (overrides = {}) => Object.entries(parseJsonObject(overrides, {})).reduce((acc, [key, value]) => {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey || value === undefined) return acc;
    acc[ADMIN_OVERRIDE_LIMIT_KEY_MAP_REVERSE[normalizedKey] || normalizedKey] = value;
    return acc;
}, {});

const compactAdminOverrideFeatureOverrides = (overrides = {}) => Object.entries(parseJsonObject(overrides, {})).reduce((acc, [key, value]) => {
    const normalizedKey = normalizeBenefitKey(key);
    if (!normalizedKey || value === undefined) return acc;
    acc[ADMIN_OVERRIDE_FEATURE_KEY_MAP[normalizedKey] || normalizedKey] = value;
    return acc;
}, {});

const expandAdminOverrideFeatureOverrides = (overrides = {}) => Object.entries(parseJsonObject(overrides, {})).reduce((acc, [key, value]) => {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey || value === undefined) return acc;
    const expandedKey = normalizeBenefitKey(ADMIN_OVERRIDE_FEATURE_KEY_MAP_REVERSE[normalizedKey] || normalizedKey);
    if (!expandedKey) return acc;
    acc[expandedKey] = value;
    return acc;
}, {});

const selectLatestTransactionFromDocuments = (transactions = [], pricingPlans = [], now = Date.now()) => {
    const plans = Array.isArray(pricingPlans) ? pricingPlans : [];
    const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const latestTransaction = (Array.isArray(transactions) ? transactions : [])
        .map((transaction) => {
            const createdAt = toIsoDateTime(getTransactionCreatedAt(transaction));
            return {
                transaction,
                createdAt,
                createdAtMs: createdAt ? new Date(createdAt).getTime() : 0
            };
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs)[0] || null;

    if (!latestTransaction?.transaction) return null;

    const transaction = latestTransaction.transaction;
    const status = normalizeTransactionStatus(pickTransactionValue(transaction, 'status'));
    if (!VALID_SELF_SUBSCRIPTION_STATUSES.has(status)) {
        return null;
    }

    const planId = getTransactionPlanId(transaction);
    const plan = findPlanByIdentifier(plans, planId);
    const expiry = toIsoDateTime(pickTransactionValue(transaction, 'expiry_date') || calculateTransactionExpiry(transaction, plan));
    if (!plan || planId === 'free' || !expiry) return null;

    const expiryMs = new Date(expiry).getTime();
    if (Number.isNaN(expiryMs) || expiryMs <= nowMs) {
        return null;
    }

    return {
        transaction,
        planId,
        plan,
        expiryDate: expiry,
        billingCycle: getTransactionBillingCycle(transaction),
        createdAt: latestTransaction.createdAt
    };
};

const resolveEntitlementReplacementDecision = ({
    profile = null,
    pricingPlans = [],
    latestValidTransaction = null,
    now = Date.now()
} = {}) => {
    const plans = Array.isArray(pricingPlans) ? pricingPlans : [];
    const freePlan = findPlanByIdentifier(plans, 'free') || normalizePlanDocument({ plan_code: 'free', name: 'Free Plan' });
    const override = parseAdminOverride(profile);
    if (override && hasActiveAdminOverride(override)) {
        return {
            plan: findPlanByIdentifier(plans, override.plan_id) || freePlan,
            planId: override.plan_id,
            planSource: 'admin',
            billingCycle: override.billing_cycle,
            expiryDate: override.expires_at,
            clearAdminOverride: false,
            reason: 'active_admin_override'
        };
    }
    if (override) {
        return {
            plan: freePlan,
            planId: 'free',
            planSource: 'system',
            billingCycle: null,
            expiryDate: null,
            clearAdminOverride: true,
            reason: 'expired_admin_override'
        };
    }
    if (!profile) {
        return {
            plan: freePlan,
            planId: 'free',
            planSource: 'system',
            billingCycle: null,
            expiryDate: null,
            clearAdminOverride: false,
            reason: 'missing_profile'
        };
    }
    const runtimeIdentity = getRuntimePlanIdentity(profile);
    const runtimePlanId = runtimeIdentity.plan_code || 'free';
    const runtimeExpired = isExpiredSubscription(runtimePlanId, runtimeIdentity.expiry_date);
    if (runtimeExpired) {
        return {
            plan: freePlan,
            planId: 'free',
            planSource: 'system',
            billingCycle: null,
            expiryDate: null,
            clearAdminOverride: false,
            reason: 'expired_runtime_plan'
        };
    }
    return {
        plan: findPlanByIdentifier(plans, runtimePlanId) || freePlan,
        planId: runtimePlanId,
        planSource: inferPlanSource(profile),
        billingCycle: runtimeIdentity.billing_cycle,
        expiryDate: runtimeIdentity.expiry_date,
        clearAdminOverride: false,
        reason: latestValidTransaction ? 'current_runtime_plan_with_latest_transaction_available' : 'current_runtime_plan'
    };
};

const getLatestValidTransaction = async (databases, userId, pricingPlans = null, limit = 250) => {
    const plans = Array.isArray(pricingPlans) ? pricingPlans : await listPricingPlans(databases);
    const transactions = await listUserTransactions(databases, userId, limit);
    return selectLatestTransactionFromDocuments(transactions, plans);
};

const buildFreeSelfSubscriptionMemory = (extra = {}) => ({
    user: null,
    plan_id: 'free',
    expiry_date: null,
    billing_cycle: null,
    status: 'inactive',
    transaction: null,
    transaction_id: null,
    ...extra
});

const getUserSelfMemory = async (databases, userId, _userFallback = null, pricingPlans = null) => {
    const safeUserId = String(userId || _userFallback?.$id || '').trim();
    if (!safeUserId) return buildFreeSelfSubscriptionMemory();

    const plans = Array.isArray(pricingPlans) ? pricingPlans : await listPricingPlans(databases);
    const response = await databases.listDocuments(APPWRITE_DATABASE_ID, TRANSACTIONS_COLLECTION_ID, [
        Query.equal('user_id', safeUserId),
        Query.equal('status', 'success'),
        Query.orderDesc('created_at'),
        Query.limit(1)
    ]).catch(() => ({ documents: [] }));
    const decisiveTransaction = (response.documents || [])[0] || null;
    if (!decisiveTransaction) return buildFreeSelfSubscriptionMemory();

    const decisivePlanId = getTransactionPlanId(decisiveTransaction);
    const decisivePlan = findPlanByIdentifier(plans, decisivePlanId);
    const expiryDate = decisiveTransaction?.expiry_date || null;
    if (!decisivePlan || !decisivePlanId || decisivePlanId === 'free' || isExpiredSubscription(decisivePlanId, expiryDate)) {
        return buildFreeSelfSubscriptionMemory({
            transaction: decisiveTransaction,
            transaction_id: decisiveTransaction?.$id || decisiveTransaction?.transactionId || null,
            billing_cycle: getTransactionBillingCycle(decisiveTransaction),
            status: 'expired'
        });
    }

    return {
        user: null,
        plan_id: decisivePlanId,
        expiry_date: expiryDate,
        billing_cycle: getTransactionBillingCycle(decisiveTransaction),
        status: 'active',
        transaction: decisiveTransaction,
        transaction_id: decisiveTransaction?.$id || decisiveTransaction?.transactionId || null,
        plan: decisivePlan
    };
};

const isExpiredSubscription = (planId, expiresAt) => {
    if (normalizePlanCode(planId) === 'free') return false;
    if (!expiresAt) return false;
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed.getTime() < Date.now();
};

const parseProfileConfig = (profile = null) => {
    const override = parseAdminOverride(profile);
    const shouldUseRuntimeOverrides = Boolean(override) || normalizePlanSource(profile?.plan_source, 'system') === 'admin';
    return {
        raw: override || {},
        feature_overrides: shouldUseRuntimeOverrides
            ? parseRuntimeFeatureFlags(profile)
            : parseJsonObject(override?.feature_overrides, {}),
        limit_overrides: shouldUseRuntimeOverrides
            ? parseRuntimeLimitOverrides(profile)
            : parseJsonObject(override?.limit_overrides, {})
    };
};

const parseRuntimeLimits = (profile = null) => {
    const monthlyValue = normalizeStoredLimit(profile?.monthly_action_limit);
    const accountEnvelope = buildAccountLimitEnvelope({
        instagram_connections_limit: toFiniteNumber(
            profile?.instagram_connections_limit
        ) ?? DEFAULT_FREE_PROFILE_LIMITS.instagram_connections_limit
    });

    return {
        instagram_connections_limit: accountEnvelope.instagram_connections_limit,
        instagram_link_limit: accountEnvelope.instagram_link_limit,
        active_account_limit: accountEnvelope.active_account_limit,
        hourly_action_limit: toFiniteNumber(
            profile?.hourly_action_limit
        ) ?? DEFAULT_FREE_PROFILE_LIMITS.hourly_action_limit,
        daily_action_limit: toFiniteNumber(
            profile?.daily_action_limit
        ) ?? DEFAULT_FREE_PROFILE_LIMITS.daily_action_limit,
        monthly_action_limit: monthlyValue
    };
};

const parseRuntimeFeatures = (profile = null) => {
    return parseProfileConfig(profile).feature_overrides;
};

const parseRuntimeLimitOverrides = (profile = null) => ({
    instagram_connections_limit: toFiniteNumber(profile?.instagram_connections_limit) ?? DEFAULT_FREE_PROFILE_LIMITS.instagram_connections_limit,
    hourly_action_limit: toFiniteNumber(profile?.hourly_action_limit) ?? DEFAULT_FREE_PROFILE_LIMITS.hourly_action_limit,
    daily_action_limit: toFiniteNumber(profile?.daily_action_limit) ?? DEFAULT_FREE_PROFILE_LIMITS.daily_action_limit,
    monthly_action_limit: normalizeStoredLimit(profile?.monthly_action_limit)
});

const parseRuntimeFeatureFlags = (profile = null) => BENEFIT_KEYS.reduce((acc, key) => {
    acc[key] = profile?.[benefitFieldForKey(key)] === true;
    return acc;
}, {});

const getProfileBillingCycle = (profile = null, fallback = null) => {
    if (profile?.billing_cycle) {
        return normalizeBillingCycle(profile.billing_cycle);
    }
    if (fallback) {
        return normalizeBillingCycle(fallback);
    }
    return null;
};

const getRuntimePlanIdentity = (profile = null) => ({
    plan_code: normalizePlanCode(profile?.plan_code || 'free') || 'free',
    plan_name: String(profile?.plan_name || 'Free Plan').trim() || 'Free Plan',
    billing_cycle: getProfileBillingCycle(profile),
    expiry_date: profile?.expiry_date || null,
    plan_source: normalizePlanSource(profile?.plan_source, 'system')
});

const inferPlanSource = (profile = null) => {
    return normalizePlanSource(profile?.plan_source, 'system');
};

const buildRuntimeFeatureSnapshot = ({
    plan = null,
    featureOverrides = {},
    noWatermarkEnabled = false
} = {}) => {
    const entitlements = BENEFIT_KEYS.reduce((acc, key) => {
        acc[key] = Boolean(plan?.entitlements?.[key] === true);
        return acc;
    }, {});

    Object.entries(parseJsonObject(featureOverrides, {})).forEach(([key, value]) => {
        const normalizedKey = normalizeBenefitKey(key);
        if (!normalizedKey || normalizedKey === 'watermark_text') return;
        if (!BENEFIT_KEY_SET.has(normalizedKey)) return;
        if (normalizeBooleanEntitlement(value)) {
            entitlements[normalizedKey] = true;
        } else {
            entitlements[normalizedKey] = false;
        }
    });

    if (noWatermarkEnabled === true) {
        entitlements.no_watermark = true;
    }

    return entitlements;
};

const compactRuntimeFeatureSnapshot = (features = {}) => Object.entries(features).reduce((acc, [key, value]) => {
    const normalizedKey = normalizeBenefitKey(key);
    if (!normalizedKey || !BENEFIT_KEY_SET.has(normalizedKey)) return acc;
    if (value === true) {
        acc[normalizedKey] = true;
    }
    return acc;
}, {});

const buildAdminOverrideSummary = ({
    featureOverrides = {},
    limitOverrides = {}
} = {}) => {
    const limitKeys = Object.keys(parseJsonObject(limitOverrides, {}))
        .map((key) => String(key || '').trim())
        .filter(Boolean);
    const featureKeys = Object.keys(parseJsonObject(featureOverrides, {}))
        .map((key) => normalizeBenefitKey(key))
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
    limitOverrides
} = {}) => {
    const existing = parseProfileConfig(currentProfile);
    return {
        feature_overrides: Object.keys(parseJsonObject(featureOverrides, {})).length > 0
            ? parseJsonObject(featureOverrides, {})
            : existing.feature_overrides,
        limit_overrides: Object.keys(parseJsonObject(limitOverrides, {})).length > 0
            ? parseJsonObject(limitOverrides, {})
            : existing.limit_overrides
    };
};

const resolvePlanEntitlements = (plan, profile = null) => {
    const entitlements = BENEFIT_KEYS.reduce((acc, key) => {
        acc[key] = Boolean(plan?.entitlements?.[key] === true);
        return acc;
    }, {});

    const overrides = parseProfileConfig(profile).feature_overrides;

    Object.entries(overrides).forEach(([key, value]) => {
        const normalizedKey = normalizeBenefitKey(key);
        if (!normalizedKey || !BENEFIT_KEY_SET.has(normalizedKey)) return;
        entitlements[normalizedKey] = normalizeBooleanEntitlement(value);
    });

    return entitlements;
};

const resolvePlanLimits = (plan, profile = null) => {
    const hourlyPlanLimit = toFiniteNumber(plan?.actions_per_hour_limit);
    const dailyPlanLimit = toFiniteNumber(plan?.actions_per_day_limit);
    const monthlyPlanLimit = normalizeStoredLimit(plan?.actions_per_month_limit);
    const planActiveLimit = toFiniteNumber(plan?.instagram_connections_limit) || 0;
    const profileMonthlyLimit = normalizeStoredLimit(
        profile?.monthly_action_limit
    );
    const profileHourlyLimit = toFiniteNumber(
        profile?.hourly_action_limit
    );
    const profileDailyLimit = toFiniteNumber(
        profile?.daily_action_limit
    );
    const profileConnectionsLimit = toFiniteNumber(
        profile?.instagram_connections_limit
    );
    const accountEnvelope = buildAccountLimitEnvelope({
        instagram_connections_limit: profileConnectionsLimit != null
            ? profileConnectionsLimit
            : planActiveLimit
    });

    return {
        instagram_connections_limit: accountEnvelope.instagram_connections_limit,
        instagram_link_limit: accountEnvelope.instagram_link_limit,
        active_account_limit: accountEnvelope.active_account_limit,
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
            active_account_limit: Number(resolvedLimits.active_account_limit || 0),
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
    planSource = null,
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
    expiredPlanSnapshot = undefined,
    adminOverrideJson = undefined
} = {}) => {
    const normalizedPlanId = String(planId || plan?.plan_code || plan?.id || 'free').trim() || 'free';
    const isFreePlan = normalizePlanCode(normalizedPlanId) === 'free';
    const normalizedStatus = isFreePlan
        ? 'inactive'
        : normalizeSubscriptionStatus(subscriptionStatus, 'active');
    const normalizedBillingCycle = isFreePlan
        ? null
        : (billingCycle ? normalizeBillingCycle(billingCycle) : getProfileBillingCycle(currentProfile, 'monthly'));
    const normalizedExpires = isFreePlan ? null : toIsoDateTime(subscriptionExpires);
    const requestedPlanSource = planSource ?? currentProfile?.plan_source ?? 'system';
    const normalizedPlanSource = isValidPlanSource(requestedPlanSource)
        ? normalizePlanSource(requestedPlanSource, 'system')
        : undefined;
    if (requestedPlanSource != null && String(requestedPlanSource).trim() && !isValidPlanSource(requestedPlanSource)) {
        console.warn(`[plan-source] invalid source "${requestedPlanSource}" ignored during persistence`);
    } else if (PLAN_SOURCE_DEBUG && normalizedPlanSource) {
        console.debug(`[plan-source] persisting source "${normalizedPlanSource}"`);
    }
    const defaults = resolvePlanLimits(plan, null);
    const profileConfig = parseProfileConfig(currentProfile);
    const requestedLimitOverrides = parseJsonObject(limitOverrides, {});
    const requestedFeatureOverrides = parseJsonObject(featureOverrides, {});
    const nextLimitOverrides = Object.keys(requestedLimitOverrides).length > 0
        ? requestedLimitOverrides
        : profileConfig.limit_overrides;
    const nextFeatureOverrides = Object.keys(requestedFeatureOverrides).length > 0
        ? requestedFeatureOverrides
        : profileConfig.feature_overrides;
    if (noWatermarkEnabled !== undefined) {
        nextFeatureOverrides.no_watermark = noWatermarkEnabled === true;
    }
    const effectiveLimits = {
        ...buildAccountLimitEnvelope({
            instagram_connections_limit: toFiniteNumber(nextLimitOverrides.instagram_connections_limit) != null
                ? Number(nextLimitOverrides.instagram_connections_limit)
                : Number(defaults.instagram_connections_limit || 0)
        }),
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
    const shouldResetReminderState = resetReminderState === true;
    void shouldResetReminderState;
    void paidPlanSnapshot;
    void expiredPlanSnapshot;
    const effectiveEntitlements = buildRuntimeFeatureSnapshot({
        plan,
        featureOverrides: nextFeatureOverrides,
        noWatermarkEnabled: nextFeatureOverrides.no_watermark === true
    });

    const payload = {
        user_id: String(currentProfile?.user_id || '').trim() || undefined,
        plan_code: normalizedPlanId,
        plan_source: normalizedPlanSource,
        plan_name: String(plan?.name || currentProfile?.plan_name || normalizedPlanId || 'Free Plan').trim() || 'Free Plan',
        expiry_date: normalizedExpires,
        billing_cycle: normalizedBillingCycle,
        kill_switch_enabled: currentProfile?.kill_switch_enabled !== false,
        instagram_connections_limit: Number(effectiveLimits.instagram_connections_limit || 0),
        hourly_action_limit: Number(effectiveLimits.hourly_action_limit || 0),
        daily_action_limit: Number(effectiveLimits.daily_action_limit || 0),
        monthly_action_limit: encodeProfileLimit(effectiveLimits.monthly_action_limit),
        admin_override_json: adminOverrideJson
    };

    BENEFIT_KEYS.forEach((key) => {
        payload[benefitFieldForKey(key)] = effectiveEntitlements[key] === true;
    });

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
    void databases;
    void userId;
    void planId;
    void planExpiresAt;
    return null;
};

const upsertEffectiveProfile = async (databases, userId, currentProfile, plan, options = {}) => {
    const safeUserId = String(userId || '').trim();
    if (!safeUserId || !plan) return currentProfile;
    const payload = buildPlanProfilePayload({
        currentProfile,
        plan,
        planId: options.planId || plan.plan_code || plan.id || 'free',
        planSource: options.planSource || null,
        billingCycle: options.billingCycle || null,
        subscriptionStatus: options.subscriptionStatus || (normalizePlanCode(plan.plan_code || plan.id) === 'free' ? 'inactive' : 'active'),
        subscriptionExpires: options.subscriptionExpires || null,
        featureOverrides: options.featureOverrides,
        limitOverrides: options.limitOverrides,
        noWatermarkEnabled: options.noWatermarkEnabled,
        paidPlanSnapshot: options.paidPlanSnapshot,
        preserveUsage: options.preserveUsage !== false,
        resetReminderState: options.resetReminderState,
        expiredPlanSnapshot: options.expiredPlanSnapshot,
        adminOverrideJson: options.adminOverrideJson
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
    const plans = await listPricingPlans(databases);
    const existingProfile = await getUserProfile(databases, safeUserId);
    const freePlan = findPlanByIdentifier(plans, 'free') || normalizePlanDocument({ plan_code: 'free', name: 'Free Plan' });
    const selfMemory = await getUserSelfMemory(databases, safeUserId, userFallback, plans);
    const latestValidTransaction = await getLatestValidTransaction(databases, safeUserId, plans);
    const decision = resolveEntitlementReplacementDecision({
        profile: existingProfile,
        pricingPlans: plans,
        latestValidTransaction
    });
    let profile = existingProfile;
    let plan = decision.plan || freePlan;
    let planSource = decision.planSource || 'system';
    let subscriptionPlanId = decision.planId || 'free';
    let billingCycle = decision.billingCycle || null;

    if (!profile) {
        profile = await upsertEffectiveProfile(databases, safeUserId, existingProfile, freePlan, {
            planId: 'free',
            planSource: 'system',
            billingCycle: null,
            subscriptionStatus: 'inactive',
            subscriptionExpires: null,
            adminOverrideJson: clearAdminOverridePayload()
        });
    } else if (decision.reason !== 'current_runtime_plan' && decision.reason !== 'current_runtime_plan_with_latest_transaction_available') {
        profile = await upsertEffectiveProfile(databases, safeUserId, existingProfile, plan, {
            planId: subscriptionPlanId,
            planSource,
            billingCycle,
            subscriptionStatus: subscriptionPlanId === 'free' ? 'inactive' : 'active',
            subscriptionExpires: decision.expiryDate,
            adminOverrideJson: decision.clearAdminOverride ? clearAdminOverridePayload() : existingProfile?.admin_override_json
        });
    }

    return {
        profile,
        plans,
        plan,
        planSource,
        subscriptionPlanId,
        billingCycle: billingCycle ? normalizeBillingCycle(billingCycle) : null,
        entitlements: resolvePlanEntitlements(plan, profile),
        limits: resolvePlanLimits(plan, profile),
        selfPlanId: latestValidTransaction?.planId || 'free',
        selfExpiryDate: latestValidTransaction?.expiryDate || null,
        selfUserDocument: selfMemory.user || null,
        selfTransaction: latestValidTransaction?.transaction || selfMemory.transaction || null,
        selfTransactionId: latestValidTransaction?.transaction?.$id || latestValidTransaction?.transaction?.transactionId || selfMemory.transaction_id || null
    };
};

module.exports = {
    parseJsonArray,
    parseJsonObject,
    parseJsonObjectArray,
    normalizePlanCode,
    isValidPlanSource,
    normalizePlanSource,
    normalizeFeatureKey,
    normalizeBenefitKey,
    normalizeBooleanEntitlement,
    normalizeStoredLimit,
    encodeProfileLimit,
    BENEFIT_KEYS,
    BENEFIT_FIELD_PREFIX,
    BENEFIT_STORAGE_KEYS,
    FEATURE_LABELS,
    FEATURE_LAYER_MAP,
    benefitFieldForKey,
    getFeatureLabel,
    VALID_SELF_SUBSCRIPTION_STATUSES,
    NEGATIVE_SELF_SUBSCRIPTION_STATUSES,
    IGNORED_SELF_SUBSCRIPTION_STATUSES,
    PLAN_DURATION_DAYS,
    normalizeBillingCycle,
    resolvePlanDurationDays,
    normalizeSubscriptionStatus,
    calculateSubscriptionExpiry,
    parseRuntimeLimits,
    parseRuntimeFeatures,
    getProfileBillingCycle,
    getRuntimePlanIdentity,
    inferPlanSource,
    parseProfileConfig,
    buildProfileConfigPayload,
    buildPlanProfilePayload,
    buildPaidPlanSnapshot,
    buildRuntimeFeatureSnapshot,
    buildAdminOverrideSummary,
    buildPlanEntitlements,
    extractBenefitAttributes,
    normalizeBenefitMap,
    normalizePlanDocument,
    getPlanFeatureItems,
    getPlanLimitsEnvelope,
    buildPlanApiPayload,
    buildPricingComparison,
    buildPricingApiPayload,
    listPricingPlans,
    findPlanByIdentifier,
    getPlanByIdentifier,
    getUserProfile,
    getUserSelfMemory,
    listUserTransactions,
    getLatestValidTransaction,
    parseAdminOverride,
    hasActiveAdminOverride,
    buildAdminOverridePayload,
    clearAdminOverridePayload,
    selectLatestTransactionFromDocuments,
    selectLatestValidTransactionFromDocuments: selectLatestTransactionFromDocuments,
    resolveEntitlementReplacementDecision,
    getTransactionPlanId,
    getTransactionCreatedAt,
    calculateTransactionExpiry,
    resolvePlanEntitlements,
    resolvePlanLimits,
    updateUserSelfPlanMemory,
    upsertEffectiveProfile,
    resolveUserPlanContext
};

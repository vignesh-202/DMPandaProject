const crypto = require('crypto');
const express = require('express');
const { Databases, Query, Users, ID } = require('node-appwrite');
const { loginRequired } = require('../middleware/auth');
const {
    Functions,
    getAppwriteClient,
    Messaging,
    APPWRITE_DATABASE_ID,
    USERS_COLLECTION_ID,
    PROFILES_COLLECTION_ID,
    IG_ACCOUNTS_COLLECTION_ID,
    PRICING_COLLECTION_ID,
    COUPONS_COLLECTION_ID,
    COUPON_REDEMPTIONS_COLLECTION_ID,
    TRANSACTIONS_COLLECTION_ID,
    AUTOMATIONS_COLLECTION_ID,
    LOGS_COLLECTION_ID,
    EMAIL_CAMPAIGNS_COLLECTION_ID,
    FUNCTION_REMOVE_INSTAGRAM
} = require('../utils/appwrite');
const { cleanupUserOwnedData } = require('../utils/userCleanup');
const {
    listPricingPlans,
    getPlanByIdentifier,
    normalizePlanDocument,
    resolvePlanEntitlements,
    resolvePlanLimits,
    resolveUserPlanContext,
    BENEFIT_KEYS,
    benefitFieldForKey,
    parseProfileConfig,
    normalizeBillingCycle,
    isValidPlanSource,
    normalizePlanSource,
    buildPlanProfilePayload
} = require('../utils/planConfig');
const {
    normalizeAccountAccess,
    recomputeAccountAccessStateForUser,
    recomputeAccountAccessForUser
} = require('../utils/accountAccess');
const { updateAutomationPlanValidationForUser } = require('../utils/automationPlanAudit');
const {
    normalizeBanMode,
    buildAccessState
} = require('../utils/accessControl');
const { setSessionCookie } = require('../utils/sessionContext');
const { touchUserActivity } = require('../utils/userActivity');
const { wrapAdminCampaignEmail } = require('../utils/emailTemplate');
const {
    DEFAULT_WATERMARK_POLICY,
    readWatermarkPolicy,
    saveWatermarkPolicy
} = require('../utils/systemConfig');
const sharedPlanFeatures = require('../../shared/planFeatures.json');

const router = express.Router();

const ADMIN_IMPERSONATION_TTL_MS = 2 * 60 * 1000;
const ADMIN_IMPERSONATION_AUDIENCE = 'admin-dashboard-access';
const usedAdminAccessTokens = new Map();
const PLAN_SOURCE_DEBUG = String(process.env.DEBUG_PLAN_SOURCE || '').trim() === '1';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const fail = (res, status, error, data = null) => res.status(status).json({
    success: false,
    data,
    error
});

const parsePositiveInteger = (value, fallback, options = {}) => {
    const { max = Number.MAX_SAFE_INTEGER, min = 1 } = options;
    const normalized = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(normalized)) return fallback;
    return Math.max(min, Math.min(max, normalized));
};

const buildOffsetPagination = ({ page, pageSize, total }) => ({
    page,
    page_size: pageSize,
    total,
    total_pages: Math.max(1, Math.ceil(total / pageSize)),
    has_next: page * pageSize < total,
    has_previous: page > 1
});

const adminRequired = (req, res, next) => {
    if (!req.user) return fail(res, 401, 'Unauthorized');
    const labels = Array.isArray(req.user.labels) ? req.user.labels : [];
    if (!labels.includes('admin')) {
        return fail(res, 403, 'Administrative access required.');
    }
    next();
};

const getServices = () => {
    const client = getAppwriteClient({ useApiKey: true });
    return {
        databases: new Databases(client),
        users: new Users(client),
        messaging: new Messaging(client)
    };
};

const getAdminAuditDocumentId = () => ID.unique();

const writeAdminAuditLog = async (databases, {
    adminId,
    action,
    targetUserId = null,
    payload = null
} = {}) => {
    void databases;
    void adminId;
    void action;
    void targetUserId;
    void payload;
    return null;
};

const buildSignedAdminAccessToken = ({ adminId, targetUserId }) => {
    const issuedAt = Date.now();
    const expiresAt = issuedAt + ADMIN_IMPERSONATION_TTL_MS;
    const nonce = crypto.randomBytes(12).toString('hex');
    const payload = {
        aud: ADMIN_IMPERSONATION_AUDIENCE,
        admin_id: String(adminId || '').trim(),
        target_user_id: String(targetUserId || '').trim(),
        iat: issuedAt,
        exp: expiresAt,
        nonce
    };
    const serializedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
        .createHmac('sha256', String(process.env.APPWRITE_API_KEY || ''))
        .update(serializedPayload)
        .digest('base64url');
    return `${serializedPayload}.${signature}`;
};

const verifySignedAdminAccessToken = (token) => {
    for (const [tokenHash, expiresAt] of usedAdminAccessTokens.entries()) {
        if (Number(expiresAt || 0) <= Date.now()) {
            usedAdminAccessTokens.delete(tokenHash);
        }
    }

    const [serializedPayload, providedSignature] = String(token || '').split('.');
    if (!serializedPayload || !providedSignature) {
        throw new Error('Invalid access token.');
    }

    const expectedSignature = crypto
        .createHmac('sha256', String(process.env.APPWRITE_API_KEY || ''))
        .update(serializedPayload)
        .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))) {
        throw new Error('Access token signature mismatch.');
    }

    const payload = JSON.parse(Buffer.from(serializedPayload, 'base64url').toString('utf-8'));
    if (payload?.aud !== ADMIN_IMPERSONATION_AUDIENCE) {
        throw new Error('Invalid access token audience.');
    }
    if (!payload?.target_user_id || !payload?.admin_id) {
        throw new Error('Access token is missing required fields.');
    }
    if (Number(payload?.exp || 0) <= Date.now()) {
        throw new Error('Access token expired.');
    }

    return payload;
};

const consumeSignedAdminAccessToken = (token) => {
    const tokenHash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
    if (usedAdminAccessTokens.has(tokenHash)) {
        throw new Error('Access token already used.');
    }
    const payload = verifySignedAdminAccessToken(token);
    usedAdminAccessTokens.set(tokenHash, Number(payload.exp || Date.now()));
    return payload;
};

const parseFeatures = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return raw.split(',').map((item) => item.trim()).filter(Boolean);
        }
    }
    return [];
};

const normalizePlan = (plan) => {
    const normalized = normalizePlanDocument(plan || {});
    const entitlements = resolvePlanEntitlements(normalized, null);
    return {
        id: normalized.id,
        name: normalized.name,
        plan_code: normalized.plan_code,
        price_monthly_inr: normalized.price_monthly_inr,
        price_monthly_usd: normalized.price_monthly_usd,
        price_yearly_inr: normalized.price_yearly_inr,
        price_yearly_usd: normalized.price_yearly_usd,
        price_yearly_monthly_inr: normalized.price_yearly_monthly_inr,
        price_yearly_monthly_usd: normalized.price_yearly_monthly_usd,
        yearly_bonus: normalized.yearly_bonus,
        is_popular: normalized.is_popular,
        is_custom: normalized.is_custom,
        display_order: normalized.display_order,
        button_text: normalized.button_text,
        instagram_connections_limit: Number(normalized.instagram_connections_limit || 0),
        instagram_link_limit: Number(normalized.instagram_link_limit || normalized.instagram_connections_limit || 0),
        actions_per_hour_limit: Number(normalized.actions_per_hour_limit || 0),
        actions_per_day_limit: Number(normalized.actions_per_day_limit || 0),
        actions_per_month_limit: Number(normalized.actions_per_month_limit || 0),
        features: normalized.features,
        comparison: normalized.comparison,
        entitlements,
        benefits: BENEFIT_KEYS.map((key) => ({
            key,
            label: sharedPlanFeatures.featureLabels?.[key] || key,
            enabled: entitlements[key] === true
        }))
    };
};

const normalizeCouponCode = (value) =>
    String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');

const normalizeCouponType = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'percent') return 'percent';
    return 'fixed';
};

const normalizeNonNegativeInteger = (value, fallback = 0) => {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) return fallback;
    return Math.max(0, Math.floor(normalized));
};

const parseStringArray = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
};

const serializeCoupon = (coupon) => ({
    id: coupon.$id,
    code: coupon.code || '',
    type: normalizeCouponType(coupon.type),
    value: Number(coupon.value || 0),
    active: coupon.active !== false,
    expires_at: coupon.expires_at || null,
    timing_status: coupon.expires_at
        ? (new Date(coupon.expires_at).getTime() < Date.now() ? 'expired' : 'scheduled')
        : 'no_expiry',
    billing_cycle_targets: normalizeCouponBillingTargets(coupon.billing_cycle_targets || ['monthly', 'yearly']),
    plan_ids: Array.isArray(coupon.plan_ids) ? coupon.plan_ids.map(String) : [],
    user_ids: Array.isArray(coupon.user_ids) ? coupon.user_ids.map(String) : [],
    usage_limit: normalizeNonNegativeInteger(coupon.usage_limit, 0),
    usage_per_user: normalizeNonNegativeInteger(coupon.usage_per_user, 0),
    one_time_use: normalizeNonNegativeInteger(coupon.usage_per_user, 0) === 1,
    redemption_count: normalizeNonNegativeInteger(coupon.redemption_count, 0),
    created_at: coupon.$createdAt || null,
    updated_at: coupon.$updatedAt || null
});

const validateCouponPayload = (payload) => {
    const code = normalizeCouponCode(payload?.code);
    const type = normalizeCouponType(payload?.type);
    const value = Number(payload?.value || 0);
    const usageLimit = normalizeNonNegativeInteger(payload?.usage_limit, 0);
    const usagePerUser = payload?.one_time_use === true
        ? 1
        : normalizeNonNegativeInteger(payload?.usage_per_user, 0);
    const errors = [];

    if (!code) errors.push('Coupon code is required.');
    if (code.length > 64) errors.push('Coupon code must be 64 characters or fewer.');
    if (!Number.isFinite(value) || value <= 0) errors.push('Coupon value must be greater than 0.');
    if (type === 'percent' && value > 100) errors.push('Percent coupons cannot exceed 100.');
    if (usageLimit < 0) errors.push('Usage limit cannot be negative.');
    if (usagePerUser < 0) errors.push('Per-user usage cannot be negative.');
    if (payload?.expires_at) {
        const expiresAt = new Date(payload.expires_at);
        if (Number.isNaN(expiresAt.getTime())) errors.push('Expiry date is invalid.');
        if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
            errors.push('Expiry date must be today or in the future.');
        }
    }

    return {
        code,
        type,
        value,
        active: payload?.active !== false,
        expires_at: payload?.expires_at ? new Date(payload.expires_at).toISOString() : null,
        billing_cycle_targets: normalizeCouponBillingTargets(payload?.billing_cycle_targets),
        plan_ids: parseStringArray(payload?.plan_ids),
        user_ids: parseStringArray(payload?.user_ids),
        usage_limit: usageLimit,
        usage_per_user: usagePerUser,
        one_time_use: usagePerUser === 1,
        bulk_count: normalizeNonNegativeInteger(payload?.bulk_count, 1),
        errors
    };
};

const buildCouponDocumentPayload = (payload, existing = null) => ({
    code: payload.code,
    type: payload.type,
    value: payload.value,
    active: payload.active,
    expires_at: payload.expires_at,
    billing_cycle_targets: payload.billing_cycle_targets,
    usage_limit: payload.usage_limit,
    usage_per_user: payload.usage_per_user,
    ...(payload.plan_ids.length > 0 || Array.isArray(existing?.plan_ids) ? { plan_ids: payload.plan_ids } : {}),
    ...(payload.user_ids.length > 0 || Array.isArray(existing?.user_ids) ? { user_ids: payload.user_ids } : {})
});

const shouldRetryCouponWithoutScopes = (error) => {
    const message = String(error?.message || '').toLowerCase();
    return (
        message.includes('plan_ids')
        || message.includes('user_ids')
        || message.includes('usage_limit')
        || message.includes('usage_per_user')
        || message.includes('unknown attribute')
        || message.includes('invalid document structure')
    );
};

const buildBulkCouponCodes = (prefix, count, existingCodes = new Set()) => {
    const safePrefix = normalizeCouponCode(prefix).slice(0, 57);
    const targetCount = Math.max(1, Math.min(500, normalizeNonNegativeInteger(count, 1)));
    const generated = [];
    const seen = new Set(Array.from(existingCodes));

    while (generated.length < targetCount) {
        const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
        const code = `${safePrefix}-${suffix}`.slice(0, 64);
        if (seen.has(code)) continue;
        seen.add(code);
        generated.push(code);
    }

    return generated;
};

const normalizeAutomationType = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return 'unknown';
    const aliases = {
        dm: 'dm',
        comment: 'comment',
        post: 'comment',
        reel: 'reel',
        story: 'story',
        mention: 'mention',
        mentions: 'mention',
        'story-reply': 'story',
        story_reply: 'story',
        suggest_more: 'suggest_more',
        comment_moderation: 'comment_moderation',
        moderation_hide: 'comment_moderation',
        moderation_delete: 'comment_moderation'
    };
    return aliases[normalized] || normalized;
};

const startOfDayIso = (daysAgo = 0) => {
    const dt = new Date();
    dt.setUTCHours(0, 0, 0, 0);
    dt.setUTCDate(dt.getUTCDate() - daysAgo);
    return dt.toISOString();
};

const TRAFFIC_WINDOW_OPTIONS = {
    '24h': { hours: 24, bucket: 'hour' },
    '7d': { days: 7, bucket: 'day' },
    '14d': { days: 14, bucket: 'day' },
    '21d': { days: 21, bucket: 'day' },
    '30d': { days: 30, bucket: 'day' }
};

const normalizeTrafficWindow = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return TRAFFIC_WINDOW_OPTIONS[normalized] ? normalized : '30d';
};

const startOfUtcHour = (value = new Date()) => {
    const dt = new Date(value);
    dt.setUTCMinutes(0, 0, 0);
    return dt;
};

const buildTrafficSeries = (logs, windowKey) => {
    const config = TRAFFIC_WINDOW_OPTIONS[windowKey] || TRAFFIC_WINDOW_OPTIONS['30d'];
    const now = new Date();

    if (config.bucket === 'hour') {
        const end = startOfUtcHour(now);
        const start = new Date(end);
        start.setUTCHours(end.getUTCHours() - (config.hours - 1));

        const buckets = [];
        const bucketMap = new Map();
        for (let index = 0; index < config.hours; index += 1) {
            const bucketDate = new Date(start);
            bucketDate.setUTCHours(start.getUTCHours() + index);
            const key = bucketDate.toISOString().slice(0, 13);
            const label = bucketDate.toISOString().slice(11, 16);
            const bucket = { key, label, value: 0 };
            buckets.push(bucket);
            bucketMap.set(key, bucket);
        }

        (Array.isArray(logs) ? logs : []).forEach((entry) => {
            const sentAt = new Date(entry.sent_at || entry.$createdAt || 0);
            if (Number.isNaN(sentAt.getTime()) || sentAt < start || sentAt > now) return;
            const key = sentAt.toISOString().slice(0, 13);
            const bucket = bucketMap.get(key);
            if (bucket) bucket.value += 1;
        });

        return buckets;
    }

    const end = new Date(now);
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (config.days - 1));

    const buckets = [];
    const bucketMap = new Map();
    for (let index = 0; index < config.days; index += 1) {
        const bucketDate = new Date(start);
        bucketDate.setUTCDate(start.getUTCDate() + index);
        const key = bucketDate.toISOString().slice(0, 10);
        const label = key.slice(5).replace('-', '/');
        const bucket = { key, label, value: 0 };
        buckets.push(bucket);
        bucketMap.set(key, bucket);
    }

    (Array.isArray(logs) ? logs : []).forEach((entry) => {
        const sentAt = new Date(entry.sent_at || entry.$createdAt || 0);
        if (Number.isNaN(sentAt.getTime()) || sentAt < start || sentAt > end) return;
        const key = sentAt.toISOString().slice(0, 10);
        const bucket = bucketMap.get(key);
        if (bucket) bucket.value += 1;
    });

    return buckets;
};

const listAllDocuments = async (databases, collectionId, queries = [], limit = 100) => {
    const documents = [];
    let offset = 0;

    while (true) {
        const response = await databases.listDocuments(APPWRITE_DATABASE_ID, collectionId, [
            Query.limit(limit),
            Query.offset(offset),
            ...queries
        ]);
        documents.push(...response.documents);
        if (response.documents.length < limit) break;
        offset += limit;
        if (offset > 5000) break;
    }

    return documents;
};

const listPagedDocuments = async (databases, collectionId, queries = [], {
    page = 1,
    pageSize = 20,
    orderBy = null,
    orderDirection = 'desc'
} = {}) => {
    const normalizedPage = parsePositiveInteger(page, 1);
    const normalizedPageSize = parsePositiveInteger(pageSize, 20, { max: 100 });
    const normalizedQueries = [
        Query.limit(normalizedPageSize),
        Query.offset((normalizedPage - 1) * normalizedPageSize),
        ...queries
    ];

    if (orderBy) {
        normalizedQueries.push(
            orderDirection === 'asc' ? Query.orderAsc(orderBy) : Query.orderDesc(orderBy)
        );
    }

    const response = await databases.listDocuments(APPWRITE_DATABASE_ID, collectionId, normalizedQueries);
    return {
        documents: response.documents || [],
        total: Number(response.total || 0),
        page: normalizedPage,
        pageSize: normalizedPageSize
    };
};

const getProfileForUser = async (databases, userId) => {
    const docs = await databases.listDocuments(APPWRITE_DATABASE_ID, PROFILES_COLLECTION_ID, [
        Query.equal('user_id', String(userId)),
        Query.limit(1)
    ]);
    return docs.documents[0] || null;
};

const buildProfileRollbackPayload = (profile = null) => {
    if (!profile) return null;
    return {
        user_id: String(profile.user_id || '').trim() || null,
        plan_code: profile.plan_code || null,
        plan_source: profile.plan_source || null,
        plan_name: profile.plan_name || null,
        expiry_date: profile.expiry_date || null,
        kill_switch_enabled: profile.kill_switch_enabled !== false,
        instagram_connections_limit: Number(profile.instagram_connections_limit || 0),
        hourly_action_limit: Number(profile.hourly_action_limit || 0),
        daily_action_limit: Number(profile.daily_action_limit || 0),
        monthly_action_limit: Number(profile.monthly_action_limit || 0),
        no_watermark: profile.no_watermark === true,
        credits: Number(profile.credits || 0),
        hourly_actions_used: Number(profile.hourly_actions_used || 0),
        daily_actions_used: Number(profile.daily_actions_used || 0),
        monthly_actions_used: Number(profile.monthly_actions_used || 0)
    };
};

const restoreProfileDocument = async (databases, profileId, rollbackPayload) => {
    if (!profileId || !rollbackPayload) return null;
    return databases.updateDocument(APPWRITE_DATABASE_ID, PROFILES_COLLECTION_ID, profileId, rollbackPayload);
};

const normalizePlanCode = (value) => String(value || '').trim().toLowerCase();
const toFiniteNumber = (value, fallback = null) => {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) return fallback;
    return normalized;
};
const parseAdminJsonObject = (value, fallback = {}) => {
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
};
const normalizeCouponBillingTargets = (value) => {
    const values = Array.isArray(value) ? value : parseStringArray(value);
    const normalized = Array.from(new Set(
        values
            .map((item) => normalizeBillingCycle(item))
            .filter(Boolean)
    ));
    return normalized.length > 0 ? normalized : ['monthly', 'yearly'];
};
const resolvePlanDefaults = (plan) => resolvePlanLimits(plan, null);
const buildLimitOverridePayload = (limits = {}) => {
    const payload = {};
    ['instagram_connections_limit', 'hourly_action_limit', 'daily_action_limit'].forEach((key) => {
        const normalized = toFiniteNumber(limits[key], null);
        if (normalized != null) {
            payload[key] = normalized;
        }
    });
    if (limits.monthly_action_limit === null) {
        payload.monthly_action_limit = null;
    } else {
        const monthly = toFiniteNumber(limits.monthly_action_limit, null);
        if (monthly != null) {
            payload.monthly_action_limit = monthly;
        }
    }
    return payload;
};
const parseSubscriptionExpiryDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
};
const deriveSubscriptionState = (planCode, expiryDate) => {
    const normalizedPlanCode = normalizePlanCode(planCode || 'free') || 'free';
    const normalizedExpiryDate = parseSubscriptionExpiryDate(expiryDate);
    if (normalizedPlanCode === 'free' && !normalizedExpiryDate) {
        return {
            plan_code: 'free',
            expiry_date: null,
            is_active: false,
            is_expired: false,
            derived_status: 'inactive'
        };
    }
    if (!normalizedExpiryDate) {
        return {
            plan_code: normalizedPlanCode,
            expiry_date: null,
            is_active: false,
            is_expired: false,
            derived_status: 'inactive'
        };
    }
    const isActive = new Date(normalizedExpiryDate).getTime() > Date.now();
    return {
        plan_code: normalizedPlanCode,
        expiry_date: normalizedExpiryDate,
        is_active: isActive,
        is_expired: !isActive,
        derived_status: isActive ? 'active' : 'expired'
    };
};
const buildAdminManagedExpiryDate = ({ durationMode = 'monthly', customExpiryDate = null, baseDate = null } = {}) => {
    const mode = String(durationMode || 'monthly').trim().toLowerCase();
    const parsedBaseDate = baseDate ? new Date(baseDate) : new Date();
    const safeBaseDate = Number.isNaN(parsedBaseDate.getTime()) ? new Date() : parsedBaseDate;
    if (mode === 'custom') {
        return parseSubscriptionExpiryDate(customExpiryDate);
    }
    const next = new Date(safeBaseDate);
    if (mode === 'yearly') {
        next.setUTCFullYear(next.getUTCFullYear() + 1);
    } else {
        next.setUTCDate(next.getUTCDate() + 30);
    }
    return next.toISOString();
};
const resolveLatestValidTransactionRestore = async (databases, userId, pricingPlans) => {
    const transactionsResponse = await databases.listDocuments(APPWRITE_DATABASE_ID, TRANSACTIONS_COLLECTION_ID, [
        Query.equal('user_id', String(userId)),
        Query.equal('status', 'success'),
        Query.orderDesc('created_at'),
        Query.limit(1)
    ]).catch(() => ({ documents: [] }));
    const latestTransaction = (Array.isArray(transactionsResponse?.documents) ? transactionsResponse.documents : [])[0] || null;
    const planId = normalizePlanCode(
        latestTransaction?.plan_code || latestTransaction?.planCode || latestTransaction?.planName || latestTransaction?.plan_name || 'free'
    );
    const expiryDate = parseSubscriptionExpiryDate(latestTransaction?.expiry_date || null);
    if (latestTransaction && planId && planId !== 'free' && expiryDate && new Date(expiryDate).getTime() > Date.now()) {
        const plan = pricingPlans.find((entry) => normalizePlanCode(entry.plan_code || entry.id) === planId) || null;
        if (plan) {
            return {
                plan,
                planId,
                expiryDate
            };
        }
    }
    const freePlan = pricingPlans.find((entry) => normalizePlanCode(entry.plan_code || entry.id) === 'free') || null;
    return {
        plan: freePlan,
        planId: 'free',
        expiryDate: null
    };
};
const RESET_PLAN_DURATION_DAYS = {
    monthly: 30,
    yearly: 364
};
const getResetTransactionPlanCode = (transaction) => normalizePlanCode(
    transaction?.planCode || transaction?.plan_code || transaction?.planName || transaction?.plan_name || 'free'
);
const getResetTransactionCreatedAt = (transaction) => (
    transaction?.transactionDate || transaction?.created_at || transaction?.$createdAt || null
);
const getResetTransactionBillingCycle = (transaction) => normalizeBillingCycle(
    transaction?.billingCycle || transaction?.billing_cycle || 'monthly'
);
const resolveResetTransactionExpiry = (transaction, plan = null) => {
    const directExpiry = parseSubscriptionExpiryDate(
        transaction?.expiry_date || transaction?.plan_expires_at || null
    );
    if (directExpiry) {
        return {
            expiryDate: directExpiry,
            source: transaction?.expiry_date ? 'expiry_date' : 'plan_expires_at',
            computedFrom: null,
            billingCycle: getResetTransactionBillingCycle(transaction),
            durationDays: null
        };
    }

    const transactionCreatedAt = getResetTransactionCreatedAt(transaction);
    const parsedCreatedAt = transactionCreatedAt ? new Date(transactionCreatedAt) : null;
    if (!parsedCreatedAt || Number.isNaN(parsedCreatedAt.getTime())) {
        return {
            expiryDate: null,
            source: 'missing',
            computedFrom: transactionCreatedAt || null,
            billingCycle: getResetTransactionBillingCycle(transaction),
            durationDays: null
        };
    }

    const billingCycle = getResetTransactionBillingCycle(transaction);
    const durationDays = billingCycle === 'yearly'
        ? toFiniteNumber(plan?.yearly_duration_days, null) || RESET_PLAN_DURATION_DAYS.yearly
        : toFiniteNumber(plan?.monthly_duration_days, null) || RESET_PLAN_DURATION_DAYS.monthly;
    const computedExpiry = new Date(parsedCreatedAt);
    computedExpiry.setUTCDate(computedExpiry.getUTCDate() + Math.max(1, Math.floor(Number(durationDays || 0))));

    return {
        expiryDate: parseSubscriptionExpiryDate(computedExpiry.toISOString()),
        source: 'computed_from_billing',
        computedFrom: parsedCreatedAt.toISOString(),
        billingCycle,
        durationDays
    };
};
const getLatestTransactionForUserReset = async (databases, userId) => {
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) return null;
    const response = await databases.listDocuments(APPWRITE_DATABASE_ID, TRANSACTIONS_COLLECTION_ID, [
        Query.equal('userId', safeUserId),
        Query.equal('status', 'success'),
        Query.orderDesc('$createdAt'),
        Query.limit(1)
    ]).catch(() => ({ documents: [] }));
    return (Array.isArray(response?.documents) ? response.documents : [])[0] || null;
};
const buildEffectivePlanResponse = async (databases, userId, userFallback = null) => {
    const context = await resolveUserPlanContext(databases, userId, userFallback);
    const subscriptionState = deriveSubscriptionState(context.profile?.plan_code, context.profile?.expiry_date);
    return {
        profile: context.profile,
        effective_plan: {
            id: String(context.profile?.plan_code || context.subscriptionPlanId || 'free'),
            plan_code: String(context.profile?.plan_code || context.subscriptionPlanId || 'free'),
            name: String(context.profile?.plan_name || context.subscriptionPlanId || 'Free Plan')
        },
        plan_source: normalizePlanSource(context.profile?.plan_source || context.planSource || 'system', 'system'),
        expiry_date: subscriptionState.expiry_date,
        is_active: subscriptionState.is_active,
        is_expired: subscriptionState.is_expired,
        derived_status: subscriptionState.derived_status,
        self_plan: {
            id: String(context.selfPlanId || 'free'),
            expiry_date: context.selfExpiryDate || null
        },
        effective_limits: context.limits,
        effective_entitlements: context.entitlements
    };
};
const scoreSearchMatch = (needle, haystack) => {
    const normalizedNeedle = String(needle || '').trim().toLowerCase();
    const normalizedHaystack = String(haystack || '').trim().toLowerCase();
    if (!normalizedNeedle || !normalizedHaystack) return 0;
    if (normalizedHaystack === normalizedNeedle) return 120;
    if (normalizedHaystack.startsWith(normalizedNeedle)) return 90;
    if (normalizedHaystack.includes(normalizedNeedle)) return 70;
    const compactNeedle = normalizedNeedle.replace(/\s+/g, '');
    const compactHaystack = normalizedHaystack.replace(/\s+/g, '');
    if (compactHaystack.includes(compactNeedle)) return 55;

    let sequentialHits = 0;
    let cursor = 0;
    for (const char of compactNeedle) {
        const nextIndex = compactHaystack.indexOf(char, cursor);
        if (nextIndex === -1) break;
        sequentialHits += 1;
        cursor = nextIndex + 1;
    }
    if (sequentialHits >= Math.max(3, compactNeedle.length - 1)) {
        return 40;
    }
    return 0;
};
const scoreUserDocumentSearch = (search, userDocument) => {
    if (!search) return 0;
    return Math.max(
        scoreSearchMatch(search, userDocument?.name),
        scoreSearchMatch(search, userDocument?.email),
        scoreSearchMatch(search, `${userDocument?.name || ''} ${userDocument?.email || ''}`)
    );
};
const normalizeEmailCampaignSegment = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    const allowed = new Set(['all', 'current_paid', 'current_free', 'active', 'expired', 'never_paid']);
    return allowed.has(normalized) ? normalized : 'all';
};
const normalizeEmailCampaignSort = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    const allowed = new Set(['newest', 'oldest', 'recent_subscription', 'expiring_soon', 'most_connected']);
    return allowed.has(normalized) ? normalized : 'newest';
};
const normalizeCampaignLinkedFilter = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    const allowed = new Set(['any', 'none', 'connected', 'multi']);
    return allowed.has(normalized) ? normalized : 'any';
};
const normalizeCampaignBinaryFilter = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'yes' || normalized === 'no' ? normalized : 'any';
};
const normalizeCampaignStatusFilter = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'active' || normalized === 'inactive' || normalized === 'expired' ? normalized : '';
};
const normalizeCampaignDate = (value) => {
    const normalized = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
};
const normalizeCampaignDateTime = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
};
const startOfDateUtc = (value) => value ? new Date(`${value}T00:00:00.000Z`) : null;
const endOfDateUtc = (value) => value ? new Date(`${value}T23:59:59.999Z`) : null;
const isIsoWithinRange = (value, from, to) => {
    if (!value) return false;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
    if (from && parsed < from) return false;
    if (to && parsed > to) return false;
    return true;
};
const isSuccessfulTransaction = (transaction) => {
    const normalized = String(transaction?.status || '').trim().toLowerCase();
    return ['success', 'paid', 'captured', 'completed'].includes(normalized);
};

const normalizeEmailCampaignFilters = (raw = {}) => ({
    search: String(raw.search || '').trim().toLowerCase(),
    segment: normalizeEmailCampaignSegment(raw.segment),
    plan_codes: parseStringArray(raw.plan_codes || raw.planCodes).map(normalizePlanCode).filter(Boolean),
    signup_from: normalizeCampaignDate(raw.signup_from || raw.created_from || raw.account_created_from),
    signup_to: normalizeCampaignDate(raw.signup_to || raw.created_to || raw.account_created_to),
    subscription_from: normalizeCampaignDate(raw.subscription_from),
    subscription_to: normalizeCampaignDate(raw.subscription_to),
    linked_instagram: normalizeCampaignLinkedFilter(raw.linked_instagram),
    has_transactions: normalizeCampaignBinaryFilter(raw.has_transactions),
    subscription_status: normalizeCampaignStatusFilter(raw.subscription_status),
    ban_mode: String(raw.ban_mode || '').trim().toLowerCase(),
    sort_by: normalizeEmailCampaignSort(raw.sort_by)
});

const serializeCampaignLedger = (campaign = {}) => ({
    id: String(campaign.$id || campaign.id || '').trim(),
    subject: String(campaign.subject || '').trim() || 'Untitled campaign',
    status: String(campaign.status || 'queued').trim().toLowerCase() || 'queued',
    admin_id: String(campaign.admin_id || '').trim() || null,
    appwrite_message_id: String(campaign.appwrite_message_id || '').trim() || null,
    target_total: Number(campaign.target_total || 0),
    queued_total: Number(campaign.queued_total || campaign.target_total || 0),
    delivered_total: Number(campaign.delivered_total || 0),
    failed_total: Number(campaign.failed_total || 0),
    scheduled_at: campaign.scheduled_at || null,
    sent_at: campaign.sent_at || null,
    created_at: campaign.created_at || campaign.$createdAt || null,
    updated_at: campaign.updated_at || campaign.$updatedAt || null,
    segment_key: String(campaign.segment_key || 'all').trim() || 'all'
});

const readCampaignLedgerPage = async (databases, {
    page = 1,
    pageSize = 10,
    status = 'sent'
} = {}) => {
    const queries = [];
    if (status) {
        queries.push(Query.equal('status', String(status).trim().toLowerCase()));
    }

    const result = await listPagedDocuments(databases, EMAIL_CAMPAIGNS_COLLECTION_ID, queries, {
        page,
        pageSize,
        orderBy: 'created_at',
        orderDirection: 'desc'
    }).catch(() => ({
        documents: [],
        total: 0,
        page: parsePositiveInteger(page, 1),
        pageSize: parsePositiveInteger(pageSize, 10, { max: 50 })
    }));

    return {
        items: result.documents.map(serializeCampaignLedger),
        pagination: buildOffsetPagination({
            page: result.page,
            pageSize: result.pageSize,
            total: result.total
        })
    };
};

const buildEmailCampaignAudience = async ({ databases, messaging }, rawFilters = {}, options = {}) => {
    const filters = normalizeEmailCampaignFilters(rawFilters);
    const [users, profiles, pricingDocs, transactions, accounts, recentMessagesPayload] = await Promise.all([
        listAllDocuments(databases, USERS_COLLECTION_ID).catch(() => []),
        listAllDocuments(databases, PROFILES_COLLECTION_ID).catch(() => []),
        listAllDocuments(databases, PRICING_COLLECTION_ID).catch(() => []),
        listAllDocuments(databases, TRANSACTIONS_COLLECTION_ID).catch(() => []),
        listAllDocuments(databases, IG_ACCOUNTS_COLLECTION_ID).catch(() => []),
        messaging.listMessages({ total: false }).catch(() => ({ messages: [] }))
    ]);

    const normalizedPlans = pricingDocs.map(normalizePlan);
    const planOptions = [
        { value: 'free', label: 'Free' },
        ...normalizedPlans.map((plan) => ({
            value: normalizePlanCode(plan.plan_code || plan.name),
            label: plan.name
        }))
    ].filter((option, index, array) => array.findIndex((entry) => entry.value === option.value) === index);

    const profileByUserId = new Map(
        profiles
            .filter((profile) => profile?.user_id)
            .map((profile) => [String(profile.user_id), profile])
    );

    const linkedCounts = accounts.reduce((acc, account) => {
        const key = String(account.user_id || '');
        if (!key) return acc;
        acc[key] = Number(acc[key] || 0) + 1;
        return acc;
    }, {});

    const transactionsByUserId = new Map();
    transactions
        .filter(isSuccessfulTransaction)
        .forEach((transaction) => {
            const userId = String(transaction.userId || transaction.user_id || '').trim();
            if (!userId) return;
            const list = transactionsByUserId.get(userId) || [];
            list.push(transaction);
            transactionsByUserId.set(userId, list);
        });

    const audience = users
        .filter((user) => String(user.email || '').includes('@'))
        .map((user) => {
            const userId = String(user.$id || '');
            const profile = profileByUserId.get(userId) || null;
            const userTransactions = (transactionsByUserId.get(userId) || [])
                .map((transaction) => ({
                    ...transaction,
                    transactionDate: transaction.transactionDate || transaction.created_at || transaction.$createdAt || null,
                    planCode: normalizePlanCode(transaction.planCode || transaction.plan_code || transaction.planName || transaction.plan_name),
                    amount: Number(transaction.finalAmount || transaction.final_amount || transaction.amount || 0)
                }))
                .filter((transaction) => transaction.transactionDate)
                .sort((a, b) => new Date(b.transactionDate || 0).getTime() - new Date(a.transactionDate || 0).getTime());

            const subscriptionDates = userTransactions
                .map((transaction) => {
                    const parsed = new Date(transaction.transactionDate || 0);
                    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
                })
                .filter(Boolean);

            const subscriptionState = deriveSubscriptionState(profile?.plan_code, profile?.expiry_date);
            const currentPlan = subscriptionState.plan_code;
            const currentStatus = subscriptionState.derived_status;
            const expiryDate = subscriptionState.expiry_date;
            const linkedInstagramAccounts = Number(linkedCounts[userId] || 0);
            const hasTransactions = userTransactions.length > 0;
            const hasPaidHistory = userTransactions.some((transaction) => transaction.planCode && transaction.planCode !== 'free' && transaction.amount > 0);
            const searchBlob = [
                user.name,
                user.email,
                currentPlan,
                currentStatus
            ].join(' ').toLowerCase();

            return {
                id: userId,
                name: user.name || 'Unnamed user',
                email: user.email,
                created_at: user.$createdAt || null,
                current_plan: currentPlan,
                current_status: currentStatus,
                expiry_date: expiryDate,
                linked_instagram_accounts: linkedInstagramAccounts,
                has_transactions: hasTransactions,
                has_paid_history: hasPaidHistory,
                first_subscription_at: subscriptionDates[subscriptionDates.length - 1] || null,
                last_subscription_at: subscriptionDates[0] || null,
                subscription_dates: subscriptionDates,
                latest_transaction_plan: userTransactions[0]?.planCode || null,
                ban_mode: String(user.ban_mode || 'none').trim().toLowerCase() || 'none',
                search_blob: searchBlob
            };
        });

    const signupFrom = startOfDateUtc(filters.signup_from);
    const signupTo = endOfDateUtc(filters.signup_to);
    const subscriptionFrom = startOfDateUtc(filters.subscription_from);
    const subscriptionTo = endOfDateUtc(filters.subscription_to);
    const now = Date.now();

    const filteredAudience = audience.filter((entry) => {
        if (filters.search && !entry.search_blob.includes(filters.search)) return false;

        if (filters.segment === 'current_paid' && !(entry.current_status === 'active' && entry.current_plan !== 'free')) return false;
        if (filters.segment === 'current_free' && entry.current_plan !== 'free') return false;
        if (filters.segment === 'active' && entry.current_status !== 'active') return false;
        if (filters.segment === 'expired' && !(entry.current_status !== 'active' && entry.has_paid_history)) return false;
        if (filters.segment === 'never_paid' && entry.has_paid_history) return false;

        if (filters.plan_codes.length > 0 && !filters.plan_codes.includes(entry.current_plan)) return false;

        if (filters.subscription_status) {
            if (entry.current_status !== filters.subscription_status) return false;
        }

        if (filters.linked_instagram === 'none' && entry.linked_instagram_accounts !== 0) return false;
        if (filters.linked_instagram === 'connected' && entry.linked_instagram_accounts < 1) return false;
        if (filters.linked_instagram === 'multi' && entry.linked_instagram_accounts < 2) return false;

        if (filters.has_transactions === 'yes' && !entry.has_transactions) return false;
        if (filters.has_transactions === 'no' && entry.has_transactions) return false;

        if (filters.ban_mode && entry.ban_mode !== filters.ban_mode) return false;

        if ((signupFrom || signupTo) && !isIsoWithinRange(entry.created_at, signupFrom, signupTo)) return false;

        if (subscriptionFrom || subscriptionTo) {
            const hasSubscriptionInWindow = entry.subscription_dates.some((value) => isIsoWithinRange(value, subscriptionFrom, subscriptionTo));
            if (!hasSubscriptionInWindow) return false;
        }

        return true;
    });

    filteredAudience.sort((a, b) => {
        if (filters.sort_by === 'oldest') {
            return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        }
        if (filters.sort_by === 'recent_subscription') {
            return new Date(b.last_subscription_at || 0).getTime() - new Date(a.last_subscription_at || 0).getTime();
        }
        if (filters.sort_by === 'expiring_soon') {
            return new Date(a.expiry_date || '9999-12-31').getTime() - new Date(b.expiry_date || '9999-12-31').getTime();
        }
        if (filters.sort_by === 'most_connected') {
            return Number(b.linked_instagram_accounts || 0) - Number(a.linked_instagram_accounts || 0);
        }
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    const summary = {
        total_users: audience.length,
        emailable_users: audience.length,
        current_paid_users: audience.filter((entry) => entry.current_status === 'active' && entry.current_plan !== 'free').length,
        current_free_users: audience.filter((entry) => entry.current_plan === 'free').length,
        active_subscribers: audience.filter((entry) => entry.current_status === 'active').length,
        never_paid_users: audience.filter((entry) => !entry.has_paid_history).length
    };

    const matching_summary = {
        recipients: filteredAudience.length,
        current_paid_users: filteredAudience.filter((entry) => entry.current_status === 'active' && entry.current_plan !== 'free').length,
        current_free_users: filteredAudience.filter((entry) => entry.current_plan === 'free').length,
        active_subscribers: filteredAudience.filter((entry) => entry.current_status === 'active').length,
        connected_instagram_users: filteredAudience.filter((entry) => entry.linked_instagram_accounts > 0).length
    };

    const recent_campaigns = await readCampaignLedgerPage(databases, {
        page: 1,
        pageSize: 8,
        status: 'sent'
    }).catch(() => ({ items: [], pagination: buildOffsetPagination({ page: 1, pageSize: 8, total: 0 }) }));

    return {
        filters,
        filter_options: {
            plans: planOptions,
            segments: [
                { value: 'all', label: 'All users' },
                { value: 'current_paid', label: 'Current paid' },
                { value: 'current_free', label: 'Current free' },
                { value: 'active', label: 'Active subscribers' },
                { value: 'expired', label: 'Expired paid' },
                { value: 'never_paid', label: 'Never paid' }
            ]
        },
        summary,
        matching_summary,
        audience_preview: filteredAudience.slice(0, 18),
        recent_campaigns: recent_campaigns.items,
        campaigns_pagination: recent_campaigns.pagination,
        ...(options.includeRecipientIds ? { recipient_ids: filteredAudience.map((entry) => entry.id) } : {})
    };
};

const getInstagramAccountsForUser = async (databases, userId) => {
    const docs = await databases.listDocuments(APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, [
        Query.equal('user_id', String(userId)),
        Query.limit(100)
    ]);
    return (docs.documents || []).map((account) => ({
        ...account,
        ...normalizeAccountAccess(account)
    }));
};

const getTransactionCreatedAt = (transaction) =>
    transaction.transactionDate || transaction.created_at || transaction.$createdAt || null;

const getTransactionFinalAmount = (transaction) =>
    Number(transaction.finalAmount ?? transaction.final_amount ?? transaction.amount ?? 0);

const getTransactionCouponCode = (transaction) =>
    String(transaction.couponCode ?? transaction.coupon_code ?? '').trim();

const getTransactionCouponId = (transaction) =>
    String(transaction.couponId ?? transaction.coupon_id ?? '').trim();

const getTransactionPlanId = (transaction) =>
    String(transaction.planCode ?? transaction.plan_code ?? transaction.planId ?? transaction.plan_id ?? '').trim() || null;

const buildDashboardMetrics = async (databases) => {
    const [users, profiles, accounts, transactions, automations, logs, coupons, couponRedemptions] = await Promise.all([
        listAllDocuments(databases, USERS_COLLECTION_ID),
        listAllDocuments(databases, PROFILES_COLLECTION_ID),
        listAllDocuments(databases, IG_ACCOUNTS_COLLECTION_ID),
        listAllDocuments(databases, TRANSACTIONS_COLLECTION_ID).catch(() => []),
        listAllDocuments(databases, AUTOMATIONS_COLLECTION_ID).catch(() => []),
        listAllDocuments(databases, LOGS_COLLECTION_ID, [
            Query.greaterThanEqual('sent_at', startOfDayIso(29))
        ]).catch(() => []),
        listAllDocuments(databases, COUPONS_COLLECTION_ID).catch(() => []),
        listAllDocuments(databases, COUPON_REDEMPTIONS_COLLECTION_ID).catch(() => [])
    ]);

    const statusLogs = logs.filter((entry) => String(entry.status || '').trim());
    const successLogs = statusLogs.filter((entry) => {
        const status = String(entry.status || '').toLowerCase();
        return status === 'success' || status === 'skipped';
    });

    const totals = {
        total_users: users.length,
        linked_instagram_accounts: accounts.length,
        paid_users: profiles.filter((profile) => deriveSubscriptionState(profile.plan_code, profile.expiry_date).is_active).length,
        overall_success_rate: statusLogs.length > 0
            ? Math.round((successLogs.length / statusLogs.length) * 100)
            : 100,
        active_automations: automations.filter((item) => Boolean(item.is_active)).length
    };

    const growthStart = new Date();
    growthStart.setUTCHours(0, 0, 0, 0);
    growthStart.setUTCDate(growthStart.getUTCDate() - 6);
    const user_growth = {};
    for (let i = 0; i < 7; i += 1) {
        const day = new Date(growthStart);
        day.setUTCDate(growthStart.getUTCDate() + i);
        user_growth[day.toISOString().slice(0, 10)] = 0;
    }
    users.forEach((user) => {
        const key = String(user.$createdAt || '').slice(0, 10);
        if (Object.prototype.hasOwnProperty.call(user_growth, key)) {
            user_growth[key] += 1;
        }
    });

    const plans = profiles.reduce((acc, profile) => {
        const key = String(profile.plan_code || 'free').trim() || 'free';
        acc[key] = Number(acc[key] || 0) + 1;
        return acc;
    }, {});

    const revenue_last_30_days = transactions.reduce((sum, transaction) => {
        const createdAt = new Date(getTransactionCreatedAt(transaction) || 0).getTime();
        if (!createdAt) return sum;
        if (Date.now() - createdAt > 30 * 24 * 60 * 60 * 1000) return sum;
        return sum + getTransactionFinalAmount(transaction);
    }, 0);

    const revenue_last_7_days = transactions.reduce((sum, transaction) => {
        const createdAt = new Date(getTransactionCreatedAt(transaction) || 0).getTime();
        if (!createdAt) return sum;
        if (Date.now() - createdAt > 7 * 24 * 60 * 60 * 1000) return sum;
        return sum + getTransactionFinalAmount(transaction);
    }, 0);

    const revenueSeries30Days = {};
    for (let i = 29; i >= 0; i -= 1) {
        revenueSeries30Days[startOfDayIso(i).slice(0, 10)] = 0;
    }
    transactions.forEach((transaction) => {
        const key = String(getTransactionCreatedAt(transaction) || '').slice(0, 10);
        if (key && Object.prototype.hasOwnProperty.call(revenueSeries30Days, key)) {
            revenueSeries30Days[key] += getTransactionFinalAmount(transaction);
        }
    });

    const poolCapacity = profiles.reduce((sum, profile) => sum + Number(profile.hourly_action_limit || 0), 0);
    const poolUsage = profiles.reduce((sum, profile) => sum + Number(profile.hourly_actions_used || 0), 0);
    const activeCoupons = coupons.filter((coupon) => coupon.active !== false && (!coupon.expires_at || new Date(coupon.expires_at).getTime() >= Date.now()));
    const expiredCoupons = coupons.filter((coupon) => coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now());
    const topCouponMap = couponRedemptions.reduce((acc, redemption) => {
        const code = String(redemption.coupon_code || '').trim();
        if (!code) return acc;
        acc[code] = Number(acc[code] || 0) + 1;
        return acc;
    }, {});
    const topCouponEntry = Object.entries(topCouponMap).sort((a, b) => b[1] - a[1])[0] || null;
    const couponTrendByDay = {};
    for (let i = 29; i >= 0; i -= 1) {
        couponTrendByDay[startOfDayIso(i).slice(0, 10)] = 0;
    }
    couponRedemptions.forEach((redemption) => {
        const key = String(redemption.created_at || redemption.$createdAt || '').slice(0, 10);
        if (Object.prototype.hasOwnProperty.call(couponTrendByDay, key)) {
            couponTrendByDay[key] += 1;
        }
    });

    return {
        totals,
        user_growth,
        plans,
        revenue_last_7_days,
        revenue_last_30_days,
        revenue_series_30_days: Object.entries(revenueSeries30Days).map(([day, value]) => ({ day, value })),
        pool: {
            capacity_per_hour: poolCapacity,
            usage_last_hour: poolUsage,
            usage_percent: poolCapacity > 0 ? Math.round((poolUsage / poolCapacity) * 100) : 0
        },
        coupons: {
            total_coupons: coupons.length,
            total_redemptions: couponRedemptions.length,
            active_coupons: activeCoupons.length,
            expired_coupons: expiredCoupons.length,
            top_used_coupon: topCouponEntry ? {
                code: topCouponEntry[0],
                redemptions: topCouponEntry[1]
            } : null,
            redemption_trend_30_days: Object.entries(couponTrendByDay).map(([day, value]) => ({ day, value }))
        }
    };
};

const buildAnalyticsOverview = async (databases, options = {}) => {
    const trafficWindow = normalizeTrafficWindow(options.window);
    const [metrics, logs, automations, transactions, users, accounts] = await Promise.all([
        buildDashboardMetrics(databases),
        listAllDocuments(databases, LOGS_COLLECTION_ID, [
            Query.greaterThanEqual('sent_at', startOfDayIso(29))
        ]).catch(() => []),
        listAllDocuments(databases, AUTOMATIONS_COLLECTION_ID).catch(() => []),
        listAllDocuments(databases, TRANSACTIONS_COLLECTION_ID).catch(() => []),
        listAllDocuments(databases, USERS_COLLECTION_ID).catch(() => []),
        listAllDocuments(databases, IG_ACCOUNTS_COLLECTION_ID).catch(() => [])
    ]);
    const trafficSeries = buildTrafficSeries(logs, trafficWindow);
    const trafficKeys = new Set(trafficSeries.map((entry) => entry.key));
    const filteredLogs = logs.filter((entry) => {
        const sentAt = new Date(entry.sent_at || entry.$createdAt || 0);
        if (Number.isNaN(sentAt.getTime())) return false;
        const key = trafficWindow === '24h'
            ? sentAt.toISOString().slice(0, 13)
            : sentAt.toISOString().slice(0, 10);
        return trafficKeys.has(key);
    });

    const log_status_breakdown = ['success', 'failed', 'skipped'].map((status) => ({
        name: status,
        value: filteredLogs.filter((entry) => String(entry.status || '').toLowerCase() === status).length
    }));

    const automationsByTypeMap = automations.reduce((acc, item) => {
        const key = normalizeAutomationType(item.automation_type);
        acc[key] = Number(acc[key] || 0) + 1;
        return acc;
    }, {});

    const automations_by_type = Object.entries(automationsByTypeMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

    const monthlyRevenueMap = {};
    for (let i = 29; i >= 0; i -= 1) {
        monthlyRevenueMap[startOfDayIso(i).slice(0, 10)] = 0;
    }
    transactions.forEach((transaction) => {
        const key = String(getTransactionCreatedAt(transaction) || '').slice(0, 10);
        if (key && Object.prototype.hasOwnProperty.call(monthlyRevenueMap, key)) {
            monthlyRevenueMap[key] += getTransactionFinalAmount(transaction);
        }
    });

    const linkedAccountsDistributionMap = accounts.reduce((acc, account) => {
        const key = String(account.user_id || '').trim();
        if (!key) return acc;
        acc[key] = Number(acc[key] || 0) + 1;
        return acc;
    }, {});

    return {
        ...metrics,
        log_status_breakdown,
        automations_by_type,
        monthly_revenue: Object.entries(monthlyRevenueMap).map(([day, value]) => ({ day, value })),
        automation_traffic_window: trafficWindow,
        automation_traffic: trafficSeries,
        linked_accounts_distribution: [
            { name: '0 linked', value: users.filter((user) => !linkedAccountsDistributionMap[user.$id]).length },
            { name: '1 linked', value: users.filter((user) => linkedAccountsDistributionMap[user.$id] === 1).length },
            { name: '2 linked', value: users.filter((user) => linkedAccountsDistributionMap[user.$id] === 2).length },
            { name: '3+ linked', value: users.filter((user) => Number(linkedAccountsDistributionMap[user.$id] || 0) >= 3).length }
        ],
        recent_failures: filteredLogs
            .filter((entry) => String(entry.status || '').toLowerCase() === 'failed')
            .sort((a, b) => new Date(b.sent_at || b.$createdAt || 0).getTime() - new Date(a.sent_at || a.$createdAt || 0).getTime())
            .slice(0, 8)
            .map((entry) => ({
                id: entry.$id,
                event_type: entry.event_type || entry.automation_type || 'event',
                reason: String(entry.error_reason || '').trim() || 'Unknown failure reason',
                sent_at: entry.sent_at || entry.$createdAt || null
            }))
    };
};

router.get('/dashboard', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        return ok(res, await buildDashboardMetrics(databases));
    } catch (error) {
        console.error('Admin dashboard error:', error?.message || String(error));
        return fail(res, 500, 'Failed to load dashboard.');
    }
});

router.get('/dashboard/metrics', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        return ok(res, await buildDashboardMetrics(databases));
    } catch (error) {
        console.error('Admin dashboard metrics error:', error?.message || String(error));
        return fail(res, 500, 'Failed to load dashboard metrics.');
    }
});

router.get('/analytics/overview', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        return ok(res, await buildAnalyticsOverview(databases, { window: req.query.window }));
    } catch (error) {
        console.error('Admin analytics overview error:', error?.message || String(error));
        return fail(res, 500, 'Failed to load admin analytics overview.');
    }
});

router.get('/automations', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        const automations = await listAllDocuments(databases, AUTOMATIONS_COLLECTION_ID).catch(() => []);
        const logs = await listAllDocuments(databases, LOGS_COLLECTION_ID, [
            Query.greaterThanEqual('sent_at', startOfDayIso(29))
        ]).catch(() => []);
        const byType = automations.reduce((acc, item) => {
            const key = normalizeAutomationType(item.automation_type);
            acc[key] = Number(acc[key] || 0) + 1;
            return acc;
        }, {});
        const activeCount = automations.filter((item) => Boolean(item.is_active)).length;
        const automationTrend = {};
        for (let i = 29; i >= 0; i -= 1) {
            automationTrend[startOfDayIso(i).slice(0, 10)] = 0;
        }
        logs.forEach((entry) => {
            const key = String(entry.sent_at || entry.$createdAt || '').slice(0, 10);
            if (Object.prototype.hasOwnProperty.call(automationTrend, key)) {
                automationTrend[key] += 1;
            }
        });

        return ok(res, {
            summary: {
                total: automations.length,
                active: activeCount,
                paused: automations.length - activeCount,
                with_templates: automations.filter((item) => String(item.template_id || '').trim()).length
            },
            by_type: Object.entries(byType)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)),
            trend_30_days: Object.entries(automationTrend).map(([day, value]) => ({ day, value })),
            automations: automations
                .slice()
                .sort((a, b) => new Date(b.$updatedAt || b.$createdAt || 0).getTime() - new Date(a.$updatedAt || a.$createdAt || 0).getTime())
                .slice(0, 25)
                .map((item) => ({
                    id: item.$id,
                    title: item.title || item.keyword || 'Untitled automation',
                    account_id: item.account_id || null,
                    automation_type: normalizeAutomationType(item.automation_type),
                    is_active: Boolean(item.is_active),
                    template_id: item.template_id || null,
                    keyword: item.keyword || null,
                    updated_at: item.$updatedAt || item.$createdAt || null
                }))
        });
    } catch (error) {
        console.error('Admin automations error:', error?.message || String(error));
        return fail(res, 500, 'Failed to fetch automations.');
    }
});

router.get('/coupons', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        const [coupons, couponRedemptions, transactions, plans] = await Promise.all([
            listAllDocuments(databases, COUPONS_COLLECTION_ID).catch(() => []),
            listAllDocuments(databases, COUPON_REDEMPTIONS_COLLECTION_ID).catch(() => []),
            listAllDocuments(databases, TRANSACTIONS_COLLECTION_ID).catch(() => []),
            listAllDocuments(databases, PRICING_COLLECTION_ID).catch(() => [])
        ]);

        const couponMap = new Map(coupons.map((coupon) => [String(coupon.$id), coupon]));
        const couponRedemptionCounts = couponRedemptions.reduce((acc, redemption) => {
            const couponId = String(redemption?.coupon_id || '').trim();
            const couponCode = normalizeCouponCode(redemption?.coupon_code || '');
            if (couponId) acc[couponId] = Number(acc[couponId] || 0) + 1;
            if (couponCode) acc[couponCode] = Number(acc[couponCode] || 0) + 1;
            return acc;
        }, {});
        const couponTransactions = transactions.filter((item) => getTransactionCouponCode(item) || getTransactionCouponId(item));
        return ok(res, {
            stats: {
                coupons_total: coupons.length,
                active_coupons: coupons.filter((coupon) => coupon.active !== false).length,
                redemptions_total: couponRedemptions.length > 0 ? couponRedemptions.length : couponTransactions.length,
                revenue_total: couponTransactions.reduce((sum, item) => sum + getTransactionFinalAmount(item), 0)
            },
            available_plans: plans
                .map(normalizePlan)
                .map((plan) => ({
                    id: plan.id,
                    name: plan.name,
                    plan_code: plan.plan_code
                })),
            coupons: coupons
                .slice()
                .sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')))
                .map((coupon) => serializeCoupon({
                    ...coupon,
                    redemption_count: Number(
                        couponRedemptionCounts[String(coupon.$id || '').trim()]
                        || couponRedemptionCounts[normalizeCouponCode(coupon.code || '')]
                        || 0
                    )
                })),
            redemptions: (couponRedemptions.length > 0 ? couponRedemptions : couponTransactions)
                .map((item) => ({
                    id: item.$id,
                    coupon_code: normalizeCouponCode(item.coupon_code || '') || getTransactionCouponCode(item) || couponMap.get(getTransactionCouponId(item))?.code || 'No coupon',
                    plan_id: String(item.plan_id || '').trim() || getTransactionPlanId(item),
                    final_amount: Number(item.final_amount || 0) || getTransactionFinalAmount(item),
                    currency: item.currency || 'INR',
                    status: item.status || 'success',
                    created_at: item.created_at || getTransactionCreatedAt(item)
                }))
                .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
                .slice(0, 30)
        });
    } catch (error) {
        console.error('Admin coupons error:', error?.message || String(error));
        return fail(res, 500, 'Failed to fetch coupon data.');
    }
});

router.post('/coupons', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        const payload = validateCouponPayload(req.body || {});
        if (payload.errors.length > 0) {
            return fail(res, 400, payload.errors[0], { details: payload.errors });
        }

        const existingCoupons = await listAllDocuments(databases, COUPONS_COLLECTION_ID).catch(() => []);
        const existingCodes = new Set(existingCoupons.map((coupon) => normalizeCouponCode(coupon.code || '')));
        const bulkCount = Math.max(1, Math.min(500, payload.bulk_count || 1));
        const codesToCreate = bulkCount > 1
            ? buildBulkCouponCodes(payload.code, bulkCount, existingCodes)
            : [payload.code];

        if (bulkCount === 1 && existingCodes.has(payload.code)) {
            return fail(res, 400, 'A coupon with that code already exists.');
        }

        const createdCoupons = [];
        for (const code of codesToCreate) {
            const documentPayload = buildCouponDocumentPayload({ ...payload, code });
            let created;
            try {
                created = await databases.createDocument(
                    APPWRITE_DATABASE_ID,
                    COUPONS_COLLECTION_ID,
                    ID.unique(),
                    documentPayload
                );
            } catch (error) {
                if (!shouldRetryCouponWithoutScopes(error)) throw error;

                created = await databases.createDocument(
                    APPWRITE_DATABASE_ID,
                    COUPONS_COLLECTION_ID,
                    ID.unique(),
                    {
                        code,
                        type: payload.type,
                        value: payload.value,
                        active: payload.active,
                        expires_at: payload.expires_at
                    }
                );
            }
            createdCoupons.push(created);
        }

        return ok(res, {
            coupon: serializeCoupon(createdCoupons[0]),
            coupons: createdCoupons.map(serializeCoupon),
            created_count: createdCoupons.length
        }, 201);
    } catch (error) {
        console.error('Admin create coupon error:', error?.message || String(error));
        return fail(res, 500, 'Failed to create coupon.');
    }
});

router.patch('/coupons/:couponId', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        const couponId = String(req.params.couponId || '').trim();
        const existing = await databases.getDocument(APPWRITE_DATABASE_ID, COUPONS_COLLECTION_ID, couponId);
        const payload = validateCouponPayload({
            ...existing,
            ...req.body
        });

        if (payload.errors.length > 0) {
            return fail(res, 400, payload.errors[0], { details: payload.errors });
        }

        const duplicate = await databases.listDocuments(APPWRITE_DATABASE_ID, COUPONS_COLLECTION_ID, [
            Query.equal('code', payload.code),
            Query.limit(5)
        ]).catch(() => ({ documents: [] }));
        if (duplicate.documents.some((document) => document.$id !== couponId)) {
            return fail(res, 400, 'A coupon with that code already exists.');
        }

        let updated;
        try {
            updated = await databases.updateDocument(
                APPWRITE_DATABASE_ID,
                COUPONS_COLLECTION_ID,
                couponId,
                buildCouponDocumentPayload(payload, existing)
            );
        } catch (error) {
            if (!shouldRetryCouponWithoutScopes(error)) throw error;

            updated = await databases.updateDocument(APPWRITE_DATABASE_ID, COUPONS_COLLECTION_ID, couponId, {
                code: payload.code,
                type: payload.type,
                value: payload.value,
                active: payload.active,
                expires_at: payload.expires_at,
                usage_limit: payload.usage_limit,
                usage_per_user: payload.usage_per_user
            });
        }

        return ok(res, { coupon: serializeCoupon(updated) });
    } catch (error) {
        console.error('Admin update coupon error:', error?.message || String(error));
        return fail(res, 500, 'Failed to update coupon.');
    }
});

router.get('/email-campaigns', loginRequired, adminRequired, async (req, res) => {
    try {
        const services = getServices();
        const page = parsePositiveInteger(req.query.page, 1);
        const pageSize = parsePositiveInteger(req.query.page_size, 10, { max: 50 });
        const audience = await buildEmailCampaignAudience(services, req.query);
        const campaigns = await readCampaignLedgerPage(services.databases, {
            page,
            pageSize,
            status: 'sent'
        });
        return ok(res, {
            ...audience,
            campaigns: campaigns.items,
            campaigns_pagination: campaigns.pagination
        });
    } catch (error) {
        console.error('Admin email campaigns error:', error?.message || String(error));
        return fail(res, 500, 'Failed to load email campaign audience.');
    }
});

router.post('/email-campaigns/send', loginRequired, adminRequired, async (req, res) => {
    try {
        const services = getServices();
        const subject = String(req.body?.subject || '').trim();
        const content = String(req.body?.content || '').trim();
        const format = String(req.body?.format || 'html').trim().toLowerCase() === 'text' ? 'text' : 'html';
        const scheduledAt = normalizeCampaignDateTime(req.body?.scheduled_at);

        if (!subject) {
            return fail(res, 400, 'Subject is required.');
        }
        if (!content) {
            return fail(res, 400, 'Email content is required.');
        }
        if (scheduledAt && new Date(scheduledAt).getTime() <= Date.now()) {
            return fail(res, 400, 'Scheduled send time must be in the future.');
        }

        const renderedCampaign = wrapAdminCampaignEmail({
            subject,
            content,
            format,
            frontendOrigin: process.env.FRONTEND_ORIGIN || ''
        });

        const audiencePayload = await buildEmailCampaignAudience(services, req.body?.filters || {}, { includeRecipientIds: true });
        const targetIds = Array.isArray(audiencePayload?.recipient_ids) ? audiencePayload.recipient_ids : [];
        if (targetIds.length === 0) {
            return fail(res, 400, 'No matching recipients found for this campaign.');
        }

        const message = await services.messaging.createEmail({
            messageId: ID.unique(),
            subject,
            content: format === 'html' ? renderedCampaign.html : renderedCampaign.text,
            users: targetIds,
            draft: false,
            html: format === 'html',
            ...(scheduledAt ? { scheduledAt } : {})
        });

        try {
            await services.databases.createDocument(
                APPWRITE_DATABASE_ID,
                EMAIL_CAMPAIGNS_COLLECTION_ID,
                ID.unique(),
                {
                    admin_id: String(req.user.$id || '').trim(),
                    appwrite_message_id: String(message.$id || '').trim(),
                    subject,
                    status: 'sent',
                    target_total: targetIds.length,
                    queued_total: targetIds.length,
                    delivered_total: Number(message.deliveredTotal || 0),
                    failed_total: 0,
                    scheduled_at: message.scheduledAt || scheduledAt || null,
                    sent_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    segment_key: String(audiencePayload?.filters?.segment || 'all').trim() || 'all',
                    filters_json: JSON.stringify(audiencePayload?.filters || {}),
                    metrics_json: JSON.stringify({
                        matching_summary: audiencePayload.matching_summary,
                        audience_preview: audiencePayload.audience_preview
                    })
                }
            );
        } catch (ledgerError) {
            console.warn('Campaign ledger write failed:', ledgerError?.message || String(ledgerError));
        }

        await writeAdminAuditLog(services.databases, {
            adminId: req.user.$id,
            action: 'campaign_send',
            payload: {
                subject,
                recipients: targetIds.length,
                scheduled_at: message.scheduledAt || scheduledAt || null,
                appwrite_message_id: message.$id || null
            }
        });

        console.info(
            `Admin campaign send queued by ${String(req.user.$id || '').trim()}: subject="${subject}", recipients=${targetIds.length}, messageId=${String(message.$id || '').trim()}`
        );

        return ok(res, {
            message: {
                id: message.$id,
                subject: message.subject || subject,
                status: String(message.status || 'processing').toLowerCase(),
                scheduled_at: message.scheduledAt || scheduledAt || null,
                delivered_total: Number(message.deliveredTotal || 0)
            },
            matching_summary: audiencePayload.matching_summary,
            audience_preview: audiencePayload.audience_preview.slice(0, 8)
        });
    } catch (error) {
        console.error('Admin email send error:', error?.message || String(error));
        return fail(res, 500, 'Failed to queue the email campaign. Please verify Appwrite email delivery is configured.');
    }
});

router.delete('/email-campaigns/:campaignId', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        const campaignId = String(req.params.campaignId || '').trim();
        if (!campaignId) {
            return fail(res, 400, 'Campaign ID is required.');
        }

        const existingCampaign = await databases.getDocument(
            APPWRITE_DATABASE_ID,
            EMAIL_CAMPAIGNS_COLLECTION_ID,
            campaignId
        );

        await databases.deleteDocument(APPWRITE_DATABASE_ID, EMAIL_CAMPAIGNS_COLLECTION_ID, campaignId);
        await writeAdminAuditLog(databases, {
            adminId: req.user.$id,
            action: 'campaign_delete',
            payload: {
                campaign_id: campaignId,
                subject: existingCampaign?.subject || null,
                appwrite_message_id: existingCampaign?.appwrite_message_id || null
            }
        });

        return ok(res, { deleted: true, campaign_id: campaignId });
    } catch (error) {
        const code = Number(error?.code || error?.response?.code || 0);
        if (code === 404) {
            return fail(res, 404, 'Campaign not found.');
        }
        console.error('Admin email campaign delete error:', error?.message || String(error));
        return fail(res, 500, 'Failed to delete email campaign.');
    }
});

router.get('/settings/watermark', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        return ok(res, { policy: await readWatermarkPolicy(databases) });
    } catch (error) {
        console.error('Admin watermark settings error:', error?.message || String(error));
        return fail(res, 500, 'Failed to load watermark policy.');
    }
});

router.put('/settings/watermark', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        const nextPolicy = await saveWatermarkPolicy(databases, {
            enabled: req.body?.enabled !== false,
            type: String(req.body?.type || DEFAULT_WATERMARK_POLICY.type),
            position: String(req.body?.position || DEFAULT_WATERMARK_POLICY.position),
            opacity: req.body?.opacity,
            updated_by: req.user.$id,
            updated_at: new Date().toISOString()
        });
        return ok(res, {
            policy: {
                enabled: nextPolicy.enabled !== false,
                type: String(nextPolicy.type || DEFAULT_WATERMARK_POLICY.type),
                position: String(nextPolicy.position || DEFAULT_WATERMARK_POLICY.position),
                opacity: Number(nextPolicy.opacity ?? DEFAULT_WATERMARK_POLICY.opacity),
                updated_by: nextPolicy.updated_by || req.user.$id,
                updated_at: nextPolicy.updated_at || new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Admin watermark settings update error:', error?.message || String(error));
        return fail(res, 500, 'Failed to update watermark policy.');
    }
});

router.get('/users', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        const page = parsePositiveInteger(req.query.page, 1);
        const pageSize = parsePositiveInteger(req.query.page_size, 20, { max: 100 });
        const search = String(req.query.search || '').trim();

        const filters = {
            plan: String(req.query.plan || '').trim().toLowerCase(),
            subscription_status: String(req.query.subscription_status || '').trim().toLowerCase(),
            ban_mode: String(req.query.ban_mode || '').trim().toLowerCase(),
            linked_ig_min: Number(req.query.linked_ig_min || 0),
            linked_ig_max: Number(req.query.linked_ig_max || 0)
        };

        const batchSize = Math.max(pageSize * 2, 40);
        const collectedUsers = [];
        let scanned = 0;
        let totalMatches = 0;
        let offset = 0;
        let totalAvailable = 0;
        let hasMore = true;
        let searchPool = null;

        if (search) {
            const searchableUsers = await listAllDocuments(databases, USERS_COLLECTION_ID, [], 200).catch(() => []);
            searchPool = searchableUsers
                .map((document) => ({
                    document,
                    score: scoreUserDocumentSearch(search, document)
                }))
                .filter((entry) => entry.score > 0)
                .sort((left, right) => {
                    if (right.score !== left.score) return right.score - left.score;
                    return new Date(right.document.$createdAt || 0).getTime() - new Date(left.document.$createdAt || 0).getTime();
                })
                .map((entry) => entry.document);
            totalAvailable = searchPool.length;
        }

        while (hasMore) {
            let userBatch = [];

            if (searchPool) {
                userBatch = searchPool.slice(offset, offset + batchSize);
                offset += batchSize;
                hasMore = offset < searchPool.length;
            } else {
                const batch = await databases.listDocuments(APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, [
                    Query.limit(batchSize),
                    Query.offset(offset),
                    Query.orderDesc('$createdAt')
                ]);
                userBatch = batch.documents || [];
                totalAvailable = Number(batch.total || 0);
                offset += userBatch.length;
                hasMore = userBatch.length === batchSize && offset < totalAvailable;
            }

            if (userBatch.length === 0) break;

            const userIds = userBatch.map((user) => String(user.$id || '').trim()).filter(Boolean);
            const [profilesResponse, accountsResponse] = await Promise.all([
                userIds.length > 0
                    ? databases.listDocuments(APPWRITE_DATABASE_ID, PROFILES_COLLECTION_ID, [
                        Query.equal('user_id', userIds),
                        Query.limit(Math.max(userIds.length, 1))
                    ]).catch(() => ({ documents: [] }))
                    : { documents: [] },
                userIds.length > 0
                    ? databases.listDocuments(APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, [
                        Query.equal('user_id', userIds),
                        Query.limit(Math.max(userIds.length * 5, 10))
                    ]).catch(() => ({ documents: [] }))
                    : { documents: [] }
            ]);

            const profileByUserId = new Map((profilesResponse.documents || []).map((profile) => [String(profile.user_id), profile]));
            const linkedCounts = (accountsResponse.documents || []).reduce((acc, account) => {
                const key = String(account.user_id || '').trim();
                if (!key) return acc;
                acc[key] = Number(acc[key] || 0) + 1;
                return acc;
            }, {});

            const filteredBatch = userBatch
                .map((user) => {
                    const profile = profileByUserId.get(String(user.$id)) || null;
                    return {
                        ...user,
                        profile,
                        linked_instagram_accounts: Number(linkedCounts[String(user.$id)] || 0)
                    };
                })
                .filter((user) => {
                    if (filters.plan) {
                        const effectivePlan = String(
                            user.profile?.plan_code
                            || user.profile?.plan_code
                            || ''
                        ).toLowerCase();
                        if (effectivePlan !== filters.plan) return false;
                    }
                    if (filters.subscription_status) {
                        const effectiveStatus = deriveSubscriptionState(
                            user.profile?.plan_code,
                            user.profile?.expiry_date
                        ).derived_status;
                        if (effectiveStatus !== filters.subscription_status) return false;
                    }
                    if (filters.ban_mode && String(user.ban_mode || 'none').toLowerCase() !== filters.ban_mode) {
                        return false;
                    }
                    if (filters.linked_ig_min && user.linked_instagram_accounts < filters.linked_ig_min) return false;
                    if (filters.linked_ig_max && user.linked_instagram_accounts > filters.linked_ig_max) return false;
                    return true;
                });

            totalMatches += filteredBatch.length;
            const pageStart = (page - 1) * pageSize;
            const pageEnd = pageStart + pageSize;

            filteredBatch.forEach((user) => {
                if (scanned >= pageStart && collectedUsers.length < pageSize && scanned < pageEnd) {
                    collectedUsers.push(user);
                }
                scanned += 1;
            });

            if (collectedUsers.length >= pageSize && !hasMore) {
                break;
            }
        }

        if (!searchPool && hasMore === false && totalMatches < scanned) {
            totalMatches = scanned;
        }

        return ok(res, {
            users: collectedUsers,
            pagination: buildOffsetPagination({
                page,
                pageSize,
                total: totalMatches
            }),
            filters: {
                ...filters,
                search
            },
            total_scanned_users: totalAvailable
        });
    } catch (error) {
        console.error('Admin users error:', error?.message || String(error));
        return fail(res, 500, 'Failed to fetch users.');
    }
});

router.get('/users/:userId', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        const userId = String(req.params.userId || '').trim();
        const user = await databases.getDocument(APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, userId);
        const profile = await getProfileForUser(databases, userId);
        const [accountAccessState, effectivePlanResponse, transactionsResponse] = await Promise.all([
            recomputeAccountAccessStateForUser(databases, userId, profile),
            buildEffectivePlanResponse(databases, userId, user),
            databases.listDocuments(APPWRITE_DATABASE_ID, TRANSACTIONS_COLLECTION_ID, [
                Query.equal('userId', userId),
                Query.limit(250),
                Query.orderDesc('$createdAt')
            ]).catch(() => ({ documents: [] }))
        ]);
        const instagramAccounts = accountAccessState.accounts || [];
        const transactions = Array.isArray(transactionsResponse?.documents) ? transactionsResponse.documents : [];
        const successfulTransactions = transactions.filter(isSuccessfulTransaction);
        const subscriptionState = deriveSubscriptionState(profile?.plan_code, profile?.expiry_date);
        const latestSubscribedPlan = successfulTransactions[0]
            ? {
                plan_code: normalizePlanCode(successfulTransactions[0]?.planCode || successfulTransactions[0]?.plan_code || successfulTransactions[0]?.planName || successfulTransactions[0]?.plan_name),
                plan_name: String(successfulTransactions[0]?.planName || successfulTransactions[0]?.plan_name || 'Plan').trim() || 'Plan',
                transaction_at: successfulTransactions[0]?.transactionDate || successfulTransactions[0]?.created_at || successfulTransactions[0]?.$createdAt || null
            }
            : null;
        return ok(res, {
            user,
            profile,
            access_state: buildAccessState(user),
            linked_instagram_accounts: Number(accountAccessState.summary?.total_linked_accounts || 0),
            instagram_accounts: instagramAccounts,
            total_linked_accounts: Number(accountAccessState.summary?.total_linked_accounts || 0),
            max_allowed_accounts: Number(accountAccessState.summary?.max_allowed_accounts || 0),
            active_account_limit: Number(accountAccessState.summary?.active_account_limit || 0),
            total_transactions: successfulTransactions.length,
            latest_subscribed_plan: latestSubscribedPlan,
            subscription_summary: {
                plan_code: subscriptionState.plan_code,
                expiry_date: subscriptionState.expiry_date,
                plan_source: profile?.plan_source || 'system',
                derived_status: subscriptionState.derived_status,
                is_active: subscriptionState.is_active,
                is_expired: subscriptionState.is_expired
            },
            ...effectivePlanResponse
        });
    } catch (error) {
        console.error('Admin user detail error:', error?.message || String(error));
        return fail(res, 500, 'Failed to load user details.');
    }
});

router.patch('/users/:userId/profile', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        const userId = String(req.params.userId || '').trim();
        const incomingPlanSource = req.body?.plan_source;
        const userDocument = await databases.getDocument(APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, userId);
        const existingProfile = await getProfileForUser(databases, userId);
        const action = String(req.body?.action || 'change_assigned_plan').trim().toLowerCase();
        const pricingPlans = await listPricingPlans(databases);
        const currentPlanId = String(existingProfile?.plan_code || 'free').trim() || 'free';
        const currentPlan = pricingPlans.find((plan) => normalizePlanCode(plan.plan_code || plan.id) === normalizePlanCode(currentPlanId))
            || pricingPlans.find((plan) => normalizePlanCode(plan.plan_code || plan.id) === 'free')
            || null;
        const profileConfig = parseProfileConfig(existingProfile);

        let nextPlan = currentPlan;
        let nextPlanId = String(currentPlan?.plan_code || currentPlan?.id || 'free').trim() || 'free';
        let nextExpiryDate = existingProfile?.expiry_date || null;
        let nextPlanSource = 'admin';
        let featureOverrides = profileConfig.feature_overrides;
        let limitOverrides = profileConfig.limit_overrides;

        if (incomingPlanSource !== undefined) {
            if (!isValidPlanSource(incomingPlanSource)) {
                console.warn(`[admin] Ignoring invalid client-supplied plan_source "${incomingPlanSource}" for user ${userId}`);
            } else if (PLAN_SOURCE_DEBUG) {
                console.debug(`[admin] Ignoring client-supplied plan_source "${incomingPlanSource}" for user ${userId}`);
            }
        }

        if (action === 'change_assigned_plan') {
            const requestedPlanId = String(req.body?.plan_code || 'free').trim() || 'free';
            const requestedPlanCode = normalizePlanCode(requestedPlanId);
            nextPlan = requestedPlanCode === 'free'
                ? (pricingPlans.find((plan) => normalizePlanCode(plan.plan_code || plan.id) === 'free') || null)
                : await getPlanByIdentifier(databases, requestedPlanId);
            if (requestedPlanCode !== 'free' && !nextPlan) {
                return fail(res, 400, 'Selected subscription plan was not found.');
            }
            nextPlanId = requestedPlanCode === 'free'
                ? 'free'
                : String(nextPlan?.plan_code || nextPlan?.id || requestedPlanId).trim();
            nextPlanSource = 'admin';
            nextExpiryDate = buildAdminManagedExpiryDate({
                    durationMode: req.body?.duration_mode || 'monthly',
                    customExpiryDate: req.body?.custom_expiry_date || null
                });
            if (nextPlanId !== 'free' && !nextExpiryDate) {
                return fail(res, 400, 'A valid custom expiry date is required.');
            }
            limitOverrides = buildLimitOverridePayload({
                instagram_connections_limit: req.body?.instagram_connections_limit,
                hourly_action_limit: req.body?.hourly_action_limit,
                daily_action_limit: req.body?.daily_action_limit,
                monthly_action_limit: req.body?.monthly_action_limit
            });
        } else if (action === 'edit_custom_limits') {
            limitOverrides = buildLimitOverridePayload({
                instagram_connections_limit: req.body?.instagram_connections_limit,
                hourly_action_limit: req.body?.hourly_action_limit,
                daily_action_limit: req.body?.daily_action_limit,
                monthly_action_limit: req.body?.monthly_action_limit
            });
        } else if (action === 'edit_benefits') {
            const requestedBenefits = req.body?.benefits && typeof req.body.benefits === 'object'
                ? req.body.benefits
                : {};
            featureOverrides = { ...profileConfig.feature_overrides };
            BENEFIT_KEYS.forEach((key) => {
                const field = `benefit_${key}`;
                if (Object.prototype.hasOwnProperty.call(requestedBenefits, key)) {
                    featureOverrides[key] = requestedBenefits[key] === true;
                } else if (Object.prototype.hasOwnProperty.call(requestedBenefits, field)) {
                    featureOverrides[key] = requestedBenefits[field] === true;
                } else if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
                    featureOverrides[key] = req.body[field] === true;
                }
            });
        } else if (action === 'reset_to_assigned_defaults') {
            limitOverrides = {};
            featureOverrides = {};
        } else if (action === 'reset_to_paid_snapshot_or_free') {
            const restoredPlan = await resolveLatestValidTransactionRestore(databases, userId, pricingPlans);
            nextPlan = restoredPlan.plan;
            nextPlanId = restoredPlan.planId;
            nextExpiryDate = restoredPlan.expiryDate;
            nextPlanSource = 'admin';
            limitOverrides = {};
            featureOverrides = {};
        } else {
            return fail(res, 400, 'Unsupported profile action.');
        }

        const payload = buildPlanProfilePayload({
            currentProfile: existingProfile,
            plan: nextPlan,
            planId: nextPlanId,
            planSource: nextPlanSource,
            subscriptionStatus: nextPlanId === 'free' ? 'inactive' : 'active',
            subscriptionExpires: nextExpiryDate,
            featureOverrides,
            limitOverrides,
            noWatermarkEnabled: req.body?.no_watermark,
            resetReminderState: action === 'change_assigned_plan' || action === 'reset_to_paid_snapshot_or_free',
            credits: existingProfile ? undefined : 0
        });
        if (req.body?.kill_switch_enabled !== undefined) {
            payload.kill_switch_enabled = req.body.kill_switch_enabled !== false;
        }

        const previousProfileSnapshot = buildProfileRollbackPayload(existingProfile);
        const previousUserKillSwitch = userDocument?.kill_switch_enabled;
        const previousCleanupProtected = userDocument?.cleanup_protected === true;
        let profile;
        let user;
        let instagram_accounts;
        let accountAccessState;
        const userUpdate = {};
        if (req.body?.kill_switch_enabled !== undefined) {
            userUpdate.kill_switch_enabled = req.body.kill_switch_enabled !== false;
        }
        if (req.body?.cleanup_protected !== undefined) {
            userUpdate.cleanup_protected = req.body.cleanup_protected === true;
        }

        try {
            if (existingProfile) {
                profile = await databases.updateDocument(APPWRITE_DATABASE_ID, PROFILES_COLLECTION_ID, existingProfile.$id, payload);
            } else {
                profile = await databases.createDocument(APPWRITE_DATABASE_ID, PROFILES_COLLECTION_ID, userId, {
                    user_id: userId,
                    credits: 0,
                    ...payload
                });
            }

            user = Object.keys(userUpdate).length > 0
                ? await databases.updateDocument(APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, userId, userUpdate)
                : await databases.getDocument(APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, userId);
            accountAccessState = await recomputeAccountAccessStateForUser(databases, userId, profile);
            instagram_accounts = accountAccessState.accounts;
            await updateAutomationPlanValidationForUser(databases, userId).catch(() => null);
        } catch (error) {
            if (profile?.$id && existingProfile?.$id && previousProfileSnapshot) {
                await restoreProfileDocument(databases, existingProfile.$id, previousProfileSnapshot).catch(() => null);
            } else if (profile?.$id && !existingProfile?.$id) {
                await databases.deleteDocument(APPWRITE_DATABASE_ID, PROFILES_COLLECTION_ID, profile.$id).catch(() => null);
            }
            if (Object.prototype.hasOwnProperty.call(userUpdate, 'kill_switch_enabled')
                || Object.prototype.hasOwnProperty.call(userUpdate, 'cleanup_protected')) {
                const rollbackPatch = {};
                if (Object.prototype.hasOwnProperty.call(userUpdate, 'kill_switch_enabled')) {
                    rollbackPatch.kill_switch_enabled = previousUserKillSwitch !== false;
                }
                if (Object.prototype.hasOwnProperty.call(userUpdate, 'cleanup_protected')) {
                    rollbackPatch.cleanup_protected = previousCleanupProtected;
                }
                await databases.updateDocument(APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, userId, rollbackPatch).catch(() => null);
            }
            throw error;
        }

        await writeAdminAuditLog(databases, {
            adminId: req.user.$id,
            action: 'user_profile_plan_update',
            targetUserId: userId,
            payload: {
                action,
                plan_code: payload.plan_code,
                expiry_date: payload.expiry_date,
                plan_source: payload.plan_source,
                kill_switch_enabled: userUpdate.kill_switch_enabled,
                cleanup_protected: userUpdate.cleanup_protected
            }
        });
        await touchUserActivity(userId, {
            databases,
            force: true,
            clearCleanupState: true
        }).catch(() => null);
        const updatedUserDocument = await databases.getDocument(APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, userId);

        return ok(res, {
            profile,
            user: updatedUserDocument,
            instagram_accounts,
            total_linked_accounts: Number(accountAccessState?.summary?.total_linked_accounts || 0),
            max_allowed_accounts: Number(accountAccessState?.summary?.max_allowed_accounts || 0),
            active_account_limit: Number(accountAccessState?.summary?.active_account_limit || 0),
            ...(await buildEffectivePlanResponse(databases, userId, updatedUserDocument))
        });
    } catch (error) {
        console.error('Admin profile update error:', error?.message || String(error));
        return fail(res, 500, 'Failed to update profile.');
    }
});

router.post('/users/:userId/ban', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        const userId = String(req.params.userId || '').trim();
        const mode = normalizeBanMode(req.body?.mode);
        const reason = String(req.body?.reason || '').trim() || null;
        const update = {
            ban_mode: mode,
            ban_reason: reason,
            banned_at: mode === 'none' ? null : new Date().toISOString(),
            banned_by: mode === 'none' ? null : req.user.$id,
            kill_switch_enabled: req.body?.kill_switch_enabled !== undefined
                ? req.body.kill_switch_enabled !== false
                : mode === 'none'
        };
        const user = await databases.updateDocument(APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, userId, update);
        const profile = await getProfileForUser(databases, userId);
        if (profile?.$id) {
            await databases.updateDocument(APPWRITE_DATABASE_ID, PROFILES_COLLECTION_ID, profile.$id, {
                kill_switch_enabled: update.kill_switch_enabled
            }).catch(() => null);
        }
        await writeAdminAuditLog(databases, {
            adminId: req.user.$id,
            action: 'user_ban_update',
            targetUserId: userId,
            payload: {
                mode,
                reason,
                kill_switch_enabled: update.kill_switch_enabled
            }
        });
        return ok(res, { user, access_state: buildAccessState(user) });
    } catch (error) {
        console.error('Admin ban update error:', error?.message || String(error));
        return fail(res, 500, 'Failed to update ban status.');
    }
});

router.post('/users/:userId/reset-plan', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        const userId = String(req.params.userId || '').trim();
        const profile = await getProfileForUser(databases, userId);
        const pricingPlans = await listPricingPlans(databases);
        const action = String(req.body?.action || 'reset_to_paid_snapshot_or_free').trim().toLowerCase();
        const freePlan = pricingPlans.find((plan) => normalizePlanCode(plan.plan_code || plan.id) === 'free')
            || { plan_code: 'free', id: 'free', name: 'Free Plan' };
        let nextPlan = freePlan;
        let nextPlanId = 'free';
        let nextExpiryDate = null;
        let nextPlanSource = 'system';
        let limitOverrides = {};
        let featureOverrides = {};

        if (action === 'reset_to_assigned_defaults') {
            const currentPlanId = String(profile?.plan_code || 'free').trim() || 'free';
            nextPlan = pricingPlans.find((plan) => normalizePlanCode(plan.plan_code || plan.id) === normalizePlanCode(currentPlanId))
                || freePlan;
            nextPlanId = String(nextPlan?.plan_code || nextPlan?.id || 'free').trim() || 'free';
            nextExpiryDate = profile?.expiry_date || null;
            nextPlanSource = 'admin';
        } else {
            const latestTransaction = await getLatestTransactionForUserReset(databases, userId);
            const now = new Date();
            const latestTransactionPlanId = getResetTransactionPlanCode(latestTransaction) || 'free';
            const matchedTransactionPlan = pricingPlans.find((plan) => normalizePlanCode(plan.plan_code || plan.id) === latestTransactionPlanId) || null;
            const latestTransactionExpiryDetails = resolveResetTransactionExpiry(latestTransaction, matchedTransactionPlan);
            const latestTransactionExpiry = latestTransactionExpiryDetails.expiryDate;
            const expiry = latestTransactionExpiry ? new Date(latestTransactionExpiry) : null;
            const hasActiveLatestTransaction = Boolean(expiry && expiry > now);

            if (latestTransaction && hasActiveLatestTransaction) {
                nextPlan = matchedTransactionPlan
                    || {
                        plan_code: latestTransactionPlanId,
                        id: latestTransactionPlanId,
                        name: String(latestTransaction?.plan_name || latestTransaction?.planName || latestTransactionPlanId).trim() || 'Plan'
                    };
                nextPlanId = latestTransactionPlanId;
                nextExpiryDate = latestTransactionExpiry;
                nextPlanSource = 'admin';
            } else {
                nextPlan = freePlan;
                nextPlanId = 'free';
                nextExpiryDate = null;
                nextPlanSource = 'system';
            }
        }

        if (profile) {
            const previousProfileSnapshot = buildProfileRollbackPayload(profile);
            try {
                const updatedProfile = await databases.updateDocument(APPWRITE_DATABASE_ID, PROFILES_COLLECTION_ID, profile.$id, {
                    ...buildPlanProfilePayload({
                        currentProfile: profile,
                        plan: nextPlan,
                        planId: nextPlanId,
                        planSource: nextPlanSource,
                        subscriptionStatus: nextPlanId === 'free' ? 'inactive' : 'active',
                        subscriptionExpires: nextExpiryDate,
                        featureOverrides,
                        limitOverrides,
                        resetReminderState: true
                    })
                });
                await recomputeAccountAccessForUser(databases, userId, updatedProfile);
                await updateAutomationPlanValidationForUser(databases, userId).catch(() => null);
            } catch (error) {
                if (previousProfileSnapshot) {
                    await restoreProfileDocument(databases, profile.$id, previousProfileSnapshot).catch(() => null);
                }
                throw error;
            }
        } else if (action === 'reset_to_paid_snapshot_or_free') {
            const createdProfile = await databases.createDocument(APPWRITE_DATABASE_ID, PROFILES_COLLECTION_ID, userId, {
                user_id: userId,
                credits: 0,
                ...buildPlanProfilePayload({
                    currentProfile: { user_id: userId, credits: 0 },
                    plan: nextPlan,
                    planId: nextPlanId,
                    planSource: nextPlanSource,
                    subscriptionStatus: nextPlanId === 'free' ? 'inactive' : 'active',
                    subscriptionExpires: nextExpiryDate,
                    featureOverrides,
                    limitOverrides,
                    resetReminderState: true,
                    credits: 0
                })
            });
            await recomputeAccountAccessForUser(databases, userId, createdProfile);
            await updateAutomationPlanValidationForUser(databases, userId).catch(() => null);
        }
        await writeAdminAuditLog(databases, {
            adminId: req.user.$id,
            action: 'user_plan_reset',
            targetUserId: userId,
            payload: {
                action,
                next_plan_id: nextPlanId,
                next_expiry_date: nextExpiryDate,
                next_plan_source: nextPlanSource
            }
        });
        await touchUserActivity(userId, {
            databases,
            force: true,
            clearCleanupState: true
        }).catch(() => null);
        const updatedUserDocument = await databases.getDocument(APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, userId);
        return ok(res, {
            message: action === 'reset_to_assigned_defaults'
                ? 'Assigned plan defaults restored successfully.'
                : 'Plan reset successfully.',
            ...(await buildEffectivePlanResponse(databases, userId, updatedUserDocument))
        });
    } catch (error) {
        console.error('Admin reset plan error:', error?.message || String(error));
        return fail(res, 500, 'Failed to reset plan.');
    }
});

router.patch('/users/:userId/instagram-accounts/:accountId', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        const userId = String(req.params.userId || '').trim();
        const accountId = String(req.params.accountId || '').trim();
        const account = await databases.getDocument(APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, accountId);

        if (String(account?.user_id || '').trim() !== userId) {
            return fail(res, 404, 'Instagram account not found.');
        }

        const nextStatus = String(req.body?.status || '').trim().toLowerCase();
        if (!['active', 'inactive'].includes(nextStatus)) {
            return fail(res, 400, 'A valid Instagram account status is required.');
        }

        await databases.updateDocument(APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, accountId, {
            admin_status: nextStatus
        });
        const profile = await getProfileForUser(databases, userId);
        const accountAccessState = await recomputeAccountAccessStateForUser(databases, userId, profile);
        const instagram_accounts = accountAccessState.accounts;

        await writeAdminAuditLog(databases, {
            adminId: req.user.$id,
            action: 'instagram_account_access_update',
            targetUserId: userId,
            payload: {
                account_id: accountId,
                admin_status: nextStatus
            }
        });

        return ok(res, {
            instagram_accounts,
            total_linked_accounts: Number(accountAccessState.summary?.total_linked_accounts || 0),
            max_allowed_accounts: Number(accountAccessState.summary?.max_allowed_accounts || 0),
            active_account_limit: Number(accountAccessState.summary?.active_account_limit || 0)
        });
    } catch (error) {
        console.error('Admin instagram access update error:', error?.message || String(error));
        return fail(res, 500, 'Failed to update Instagram account access.');
    }
});

router.post('/users/:userId/instagram-accounts/:accountId/delete', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        const userId = String(req.params.userId || '').trim();
        const accountId = String(req.params.accountId || '').trim();
        const account = await databases.getDocument(APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, accountId);

        if (String(account?.user_id || '').trim() !== userId) {
            return fail(res, 404, 'Instagram account not found.');
        }

        const functions = new Functions(getAppwriteClient({ useApiKey: true }));
        const execution = await functions.createExecution(
            FUNCTION_REMOVE_INSTAGRAM,
            JSON.stringify({ action: 'delete', account_doc_id: accountId }),
            false
        );

        if (execution.status === 'failed') {
            throw new Error(`Function execution failed: ${execution.response || execution.errors || 'Unknown failure'}`);
        }

        await writeAdminAuditLog(databases, {
            adminId: req.user.$id,
            action: 'instagram_account_delete',
            targetUserId: userId,
            payload: {
                account_id: accountId,
                username: String(account?.username || '').trim() || null
            }
        });

        return ok(res, { message: 'Instagram account deleted successfully.' });
    } catch (error) {
        console.error('Admin instagram delete error:', error?.message || String(error));
        return fail(res, 500, 'Failed to delete Instagram account.');
    }
});

router.delete('/users/:userId', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases, users } = getServices();
        const userId = String(req.params.userId || '').trim();

        if (!userId) {
            return fail(res, 400, 'User ID is required.');
        }

        if (String(req.user?.$id || '') === userId) {
            return fail(res, 400, 'You cannot delete the currently signed-in admin account from the admin panel.');
        }

        await cleanupUserOwnedData(databases, userId, { retainFinancialRecords: false });
        try {
            if (typeof users.deleteSessions === 'function') {
                await users.deleteSessions(userId);
            }
        } catch (sessionCleanupErr) {
            console.warn(`Admin delete session invalidation failed for user ${userId}: ${sessionCleanupErr.message}`);
        }
        await users.delete(userId);

        return ok(res, { message: 'User deleted successfully.' });
    } catch (error) {
        console.error('Admin user delete error:', error?.message || String(error));
        if (error?.code === 404) {
            return fail(res, 404, 'User not found.');
        }
        return fail(res, 500, 'Failed to delete user.');
    }
});

router.get('/pricing', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        const response = await databases.listDocuments(APPWRITE_DATABASE_ID, PRICING_COLLECTION_ID, [
            Query.limit(100),
            Query.orderAsc('display_order')
        ]);
        return ok(res, { plans: response.documents.map(normalizePlan) });
    } catch (error) {
        console.error('Admin pricing list error:', error?.message || String(error));
        return fail(res, 500, 'Failed to load pricing.');
    }
});

router.patch('/pricing/:planId', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        const planId = String(req.params.planId || '').trim();
        const requestedBenefits = req.body?.benefits && typeof req.body.benefits === 'object'
            ? req.body.benefits
            : {};
        const payload = {
            name: String(req.body?.name || 'Plan'),
            plan_code: String(req.body?.plan_code || '').trim(),
            price_monthly_inr: Number(req.body?.price_monthly_inr || 0),
            price_monthly_usd: Number(req.body?.price_monthly_usd || 0),
            price_yearly_inr: Number(req.body?.price_yearly_inr || 0),
            price_yearly_usd: Number(req.body?.price_yearly_usd || 0),
            price_yearly_monthly_inr: Number(req.body?.price_yearly_monthly_inr || 0),
            price_yearly_monthly_usd: Number(req.body?.price_yearly_monthly_usd || 0),
            yearly_bonus: '',
            is_popular: Boolean(req.body?.is_popular),
            is_custom: Boolean(req.body?.is_custom),
            display_order: Number(req.body?.display_order || 0),
            button_text: String(req.body?.button_text || 'Choose Plan'),
            instagram_connections_limit: Number(req.body?.instagram_connections_limit || 0),
            instagram_link_limit: Number(req.body?.instagram_link_limit || req.body?.instagram_connections_limit || 0),
            actions_per_hour_limit: Number(req.body?.actions_per_hour_limit || 0),
            actions_per_day_limit: Number(req.body?.actions_per_day_limit || 0),
            actions_per_month_limit: Number(req.body?.actions_per_month_limit || 0),
            features: JSON.stringify(Array.isArray(req.body?.features) ? req.body.features : parseFeatures(req.body?.features)),
            comparison_json: JSON.stringify(Array.isArray(req.body?.comparison) ? req.body.comparison : [])
        };
        BENEFIT_KEYS.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(requestedBenefits, key)) {
                payload[benefitFieldForKey(key)] = requestedBenefits[key] === true;
            } else if (req.body?.entitlements && typeof req.body.entitlements === 'object' && Object.prototype.hasOwnProperty.call(req.body.entitlements, key)) {
                payload[benefitFieldForKey(key)] = req.body.entitlements[key] === true;
            }
        });
        const updated = await databases.updateDocument(APPWRITE_DATABASE_ID, PRICING_COLLECTION_ID, planId, payload);
        const affectedProfiles = await databases.listDocuments(APPWRITE_DATABASE_ID, PROFILES_COLLECTION_ID, [
            Query.equal('plan_code', payload.plan_code),
            Query.limit(500)
        ]).catch(() => ({ documents: [] }));
        for (const profile of affectedProfiles.documents || []) {
            const refreshedProfile = await databases.updateDocument(
                APPWRITE_DATABASE_ID,
                PROFILES_COLLECTION_ID,
                profile.$id,
                buildPlanProfilePayload({
                    currentProfile: profile,
                    plan: updated,
                    planId: payload.plan_code,
                    planSource: profile.plan_source || null,
                    subscriptionStatus: normalizePlanCode(profile.plan_code || 'free') === 'free' ? 'inactive' : 'active',
                    subscriptionExpires: profile.expiry_date,
                    preserveUsage: true
                })
            ).catch(() => null);
            if (refreshedProfile?.user_id) {
                await recomputeAccountAccessForUser(databases, refreshedProfile.user_id, refreshedProfile).catch(() => null);
                await updateAutomationPlanValidationForUser(databases, refreshedProfile.user_id).catch(() => null);
            }
        }
        return ok(res, { plan: normalizePlan(updated) });
    } catch (error) {
        console.error('Admin pricing update error:', error?.message || String(error));
        return fail(res, 500, 'Failed to update pricing.');
    }
});

router.post('/impersonation-token', loginRequired, adminRequired, async (req, res) => {
    try {
        const { databases } = getServices();
        const targetUserId = String(req.body?.user_id || '').trim();
        if (!targetUserId) {
            return fail(res, 400, 'Target user ID is required.');
        }

        const targetUser = await databases.getDocument(APPWRITE_DATABASE_ID, USERS_COLLECTION_ID, targetUserId);
        const token = buildSignedAdminAccessToken({
            adminId: req.user.$id,
            targetUserId
        });
        const backendBaseUrl = `${req.protocol}://${req.get('host')}`;
        const frontendBaseUrl = String(process.env.FRONTEND_ORIGIN || process.env.FRONTEND_URL || '').trim();
        const redirectUrl = `${frontendBaseUrl.replace(/\/$/, '')}/dashboard`;
        const launchUrl = `${backendBaseUrl}/api/admin/impersonation-login?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(redirectUrl)}`;

        await writeAdminAuditLog(databases, {
            adminId: req.user.$id,
            action: 'impersonation_token_issued',
            targetUserId,
            payload: {
                target_email: targetUser.email || null,
                redirect_url: redirectUrl
            }
        });

        return ok(res, {
            launch_url: launchUrl,
            expires_in_ms: ADMIN_IMPERSONATION_TTL_MS,
            target_user: {
                id: targetUser.$id,
                email: targetUser.email || null,
                name: targetUser.name || null
            }
        });
    } catch (error) {
        console.error('Admin impersonation token error:', error?.message || String(error));
        return fail(res, 500, 'Failed to prepare secure dashboard access.');
    }
});

router.get('/impersonation-login', async (req, res) => {
    try {
        const token = String(req.query?.token || '').trim();
        const redirectUrl = String(req.query?.redirect || '').trim();
        const payload = consumeSignedAdminAccessToken(token);
        const frontendBaseUrl = String(process.env.FRONTEND_ORIGIN || process.env.FRONTEND_URL || '').trim();
        const safeRedirectUrl = redirectUrl.startsWith(frontendBaseUrl)
            ? redirectUrl
            : `${frontendBaseUrl.replace(/\/$/, '')}/dashboard`;

        const client = getAppwriteClient({ useApiKey: true });
        const users = new Users(client);
        const databases = new Databases(client);
        const session = await users.createSession(payload.target_user_id);
        const sessionSecret = session?.secret || null;

        if (!sessionSecret) {
            throw new Error('Failed to create frontend session.');
        }

        setSessionCookie(res, sessionSecret, 'frontend');

        await writeAdminAuditLog(databases, {
            adminId: payload.admin_id,
            action: 'impersonation_login_completed',
            targetUserId: payload.target_user_id,
            payload: {
                redirect_url: safeRedirectUrl
            }
        });

        return res.redirect(safeRedirectUrl);
    } catch (error) {
        console.error('Admin impersonation login error:', error?.message || String(error));
        return res.status(403).send('Secure dashboard access link is invalid or expired.');
    }
});

module.exports = router;

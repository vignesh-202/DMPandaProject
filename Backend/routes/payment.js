const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { Databases, Query, ID } = require('node-appwrite');
const { loginRequired } = require('../middleware/auth');
const {
    getAppwriteClient,
    APPWRITE_DATABASE_ID,
    USERS_COLLECTION_ID,
    PRICING_COLLECTION_ID,
    COUPONS_COLLECTION_ID,
    COUPON_REDEMPTIONS_COLLECTION_ID,
    TRANSACTIONS_COLLECTION_ID,
    PROFILES_COLLECTION_ID,
    PAYMENT_ATTEMPTS_COLLECTION_ID
} = require('../utils/appwrite');
const { buildTransactionReceipt } = require('../utils/transactionReceipt');
const {
    normalizePlanCode,
    normalizePlanDocument,
    listPricingPlans,
    getPlanByIdentifier,
    resolvePlanEntitlements,
    resolvePlanLimits,
    resolveUserPlanContext,
    encodeProfileLimit,
    buildProfileConfigPayload,
    parseProfileConfig,
    normalizeBillingCycle,
    resolvePlanDurationDays,
    calculateSubscriptionExpiry,
    buildPlanProfilePayload,
    buildPaidPlanSnapshot
} = require('../utils/planConfig');
const { loadUserAccessState } = require('../utils/accessControl');
const { recomputeAccountAccessForUser } = require('../utils/accountAccess');
const { touchUserActivity } = require('../utils/userActivity');

const router = express.Router();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || RAZORPAY_KEY_SECRET;
const razorpay = (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET)
    ? new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
    : null;

const PRICING_CACHE_TTL_MS = 60 * 1000;

const pricingCache = new Map();
const pricingInflightRequests = new Map();

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

const normalizeCouponCode = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, '');
const normalizeCurrency = (value) => (String(value || '').trim().toUpperCase() === 'INR' ? 'INR' : 'USD');

const getRequestCountryCode = (req) => {
    const candidates = [
        req.headers['x-country-code'],
        req.headers['x-vercel-ip-country'],
        req.headers['cf-ipcountry'],
        req.headers['x-appwrite-country-code'],
        req.headers['x-country'],
        req.query?.country
    ];
    const match = candidates
        .map((value) => String(value || '').trim().toUpperCase())
        .find((value) => /^[A-Z]{2}$/.test(value));
    return match || null;
};

const resolveRequestCurrency = (req, requestedCurrency) => {
    const countryCode = getRequestCountryCode(req);
    const defaultCurrency = countryCode === 'IN' ? 'INR' : 'USD';
    const requested = requestedCurrency ? normalizeCurrency(requestedCurrency) : defaultCurrency;
    return {
        countryCode,
        currency: requested,
        defaultCurrency,
        allowedCurrencies: countryCode === 'IN' ? ['INR', 'USD'] : ['USD', 'INR']
    };
};

const sortPlans = (plans) => plans.sort((a, b) => {
    if (a.display_order !== b.display_order) return a.display_order - b.display_order;
    return a.name.localeCompare(b.name);
});

const resolvePlanPrice = (plan, billingCycle, currency) => {
    const cycle = normalizeBillingCycle(billingCycle);
    const normalizedCurrency = normalizeCurrency(currency);
    if (normalizedCurrency === 'INR') {
        return cycle === 'yearly' ? Number(plan.price_yearly_inr || 0) : Number(plan.price_monthly_inr || 0);
    }
    return cycle === 'yearly' ? Number(plan.price_yearly_usd || 0) : Number(plan.price_monthly_usd || 0);
};

const resolveYearlyMonthlyDisplayPrice = (plan, currency) => {
    const normalizedCurrency = normalizeCurrency(currency);
    return normalizedCurrency === 'INR'
        ? Number(plan.price_yearly_monthly_inr || 0)
        : Number(plan.price_yearly_monthly_usd || 0);
};

const addDaysIso = (days) => {
    const next = new Date();
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString();
};

const toDateInputValue = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const normalizeDateFilter = (value) => {
    const normalized = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
};

const getValidityDays = (billingCycle) => normalizeBillingCycle(billingCycle) === 'yearly'
    ? resolvePlanDurationDays('yearly')
    : resolvePlanDurationDays('monthly');

const pickTransactionValue = (transaction, ...keys) => {
    for (const key of keys) {
        if (transaction?.[key] !== undefined && transaction?.[key] !== null && transaction?.[key] !== '') {
            return transaction[key];
        }
    }
    return null;
};

const parseGatewaySurcharge = (notes) => {
    const normalized = String(notes || '');
    const match = normalized.match(/gateway surcharge\s+([\d,]+(?:\.\d+)?)/i);
    if (!match) return 0;
    return Number(String(match[1] || '').replace(/,/g, '')) || 0;
};

const resolveTransactionPlan = (transaction, pricingMap, fallbackPlanName) => {
    const planId = String(pickTransactionValue(transaction, 'plan_id', 'planId') || '').trim();
    const planCode = normalizePlanCode(pickTransactionValue(transaction, 'plan_code', 'planCode'));
    const planName = normalizePlanCode(fallbackPlanName);

    if (planId && pricingMap.has(planId)) return pricingMap.get(planId);

    for (const plan of pricingMap.values()) {
        if (planCode && normalizePlanCode(plan.plan_code) === planCode) return plan;
        if (planName && normalizePlanCode(plan.name) === planName) return plan;
    }

    return null;
};

const getPlanLimitSnapshot = (plan) => {
    const limits = resolvePlanLimits(plan);
    return {
        hourly_action_limit: Number(limits.hourly_action_limit || 0),
        daily_action_limit: Number(limits.daily_action_limit || 0),
        monthly_action_limit: encodeProfileLimit(limits.monthly_action_limit),
        no_watermark: limits.no_watermark === true
    };
};

const getDatabases = () => {
    const client = getAppwriteClient({ useApiKey: true });
    return new Databases(client);
};

const normalizeRazorpayPaymentStatus = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (['captured', 'paid'].includes(normalized)) return normalized;
    if (normalized === 'authorized') return normalized;
    if (['failed', 'refunded', 'voided'].includes(normalized)) return normalized;
    return normalized || 'unknown';
};

const getWebhookRawBody = (req) => {
    if (Buffer.isBuffer(req.body)) {
        return req.body;
    }
    if (typeof req.body === 'string') {
        return Buffer.from(req.body, 'utf8');
    }
    return Buffer.from(JSON.stringify(req.body || {}), 'utf8');
};

const verifyRazorpayWebhookSignature = (rawBody, signature) => {
    const safeSecret = String(RAZORPAY_WEBHOOK_SECRET || '').trim();
    const safeSignature = String(signature || '').trim();
    if (!safeSecret || !safeSignature || !rawBody) return false;

    const expectedSignature = crypto
        .createHmac('sha256', safeSecret)
        .update(rawBody)
        .digest('hex');

    const providedBuffer = Buffer.from(safeSignature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    if (providedBuffer.length !== expectedBuffer.length) {
        return false;
    }
    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

const describeError = (error) => {
    const parts = [];
    const pushPart = (value) => {
        const normalized = String(value || '').trim();
        if (!normalized || parts.includes(normalized)) return;
        parts.push(normalized);
    };

    pushPart(error?.message);
    pushPart(error?.description);
    pushPart(error?.error?.description);
    pushPart(error?.response?.message);
    pushPart(error?.response?.data?.error);
    pushPart(error?.response?.data?.description);
    pushPart(error?.response?.data?.error?.description);

    if (parts.length === 0) {
        try {
            pushPart(JSON.stringify(error));
        } catch (_) {
            pushPart(String(error));
        }
    }

    return parts.join(' | ') || 'Unknown error';
};

const getPricingCacheKey = ({ countryCode, currency }) => {
    const normalizedCountry = String(countryCode || 'unknown').trim().toUpperCase() || 'UNKNOWN';
    const normalizedCurrency = normalizeCurrency(currency || 'USD');
    return `${normalizedCountry}:${normalizedCurrency}`;
};

const getCachedPricingPayload = async (currencyPolicy) => {
    const cacheKey = getPricingCacheKey(currencyPolicy);
    const now = Date.now();
    const cached = pricingCache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
        return { payload: cached.payload, cacheStatus: 'hit' };
    }

    if (pricingInflightRequests.has(cacheKey)) {
        const payload = await pricingInflightRequests.get(cacheKey);
        return { payload, cacheStatus: 'shared' };
    }

    const request = (async () => {
        const databases = getDatabases();
        const plans = await listPricingPlans(databases);
        const payload = {
            plans,
            country_code: currencyPolicy.countryCode,
            default_currency: currencyPolicy.defaultCurrency,
            allowed_currencies: currencyPolicy.allowedCurrencies
        };
        pricingCache.set(cacheKey, {
            payload,
            expiresAt: now + PRICING_CACHE_TTL_MS
        });
        return payload;
    })();

    pricingInflightRequests.set(cacheKey, request);

    try {
        const payload = await request;
        return { payload, cacheStatus: 'miss' };
    } catch (error) {
        if (cached?.payload) {
            return { payload: cached.payload, cacheStatus: 'stale' };
        }
        throw error;
    } finally {
        pricingInflightRequests.delete(cacheKey);
    }
};

const buildTransactionPayload = (transaction, pricingMap) => {
    const rawPlanName = String(pickTransactionValue(transaction, 'plan_name', 'planName') || 'Plan');
    const plan = resolveTransactionPlan(transaction, pricingMap, rawPlanName);
    const billingCycle = normalizeBillingCycle(pickTransactionValue(transaction, 'billing_cycle', 'billingCycle'));
    const currency = normalizeCurrency(pickTransactionValue(transaction, 'currency') || 'INR');
    const notes = String(pickTransactionValue(transaction, 'notes') || '').trim();
    const baseAmount = Number(pickTransactionValue(transaction, 'base_amount', 'baseAmount', 'amount') || 0);
    const discountAmount = Number(pickTransactionValue(transaction, 'discount_amount', 'discountAmount') || 0);
    const approvedPlanTotal = Math.max(baseAmount - discountAmount, 0);
    const recordedFinalAmount = Number(pickTransactionValue(transaction, 'final_amount', 'finalAmount', 'amount') || 0);
    const gatewaySurcharge = parseGatewaySurcharge(notes);
    const totalDeducted = gatewaySurcharge > 0 && Math.abs(recordedFinalAmount - approvedPlanTotal) < 0.01
        ? approvedPlanTotal + gatewaySurcharge
        : recordedFinalAmount;

    return {
        document_id: String(pickTransactionValue(transaction, '$id') || ''),
        id: String(pickTransactionValue(transaction, 'transactionId', 'gatewayPaymentId', 'razorpay_payment_id', '$id') || ''),
        created_at: pickTransactionValue(transaction, 'transactionDate', 'created_at', '$createdAt') || null,
        status: String(pickTransactionValue(transaction, 'status') || 'success'),
        plan_name: plan?.name || rawPlanName,
        plan_code: plan?.plan_code || pickTransactionValue(transaction, 'plan_code', 'planCode') || null,
        billing_cycle: billingCycle,
        validity_days: getValidityDays(billingCycle),
        currency,
        base_amount: baseAmount,
        discount_amount: discountAmount,
        approved_plan_total: approvedPlanTotal,
        gateway_surcharge: gatewaySurcharge,
        final_amount: totalDeducted,
        coupon_code: pickTransactionValue(transaction, 'coupon_code', 'couponCode') || null,
        payment_provider: String(pickTransactionValue(transaction, 'payment_provider', 'paymentProvider') || 'razorpay').toUpperCase(),
        razorpay_order_id: pickTransactionValue(transaction, 'razorpay_order_id', 'gatewayOrderId') || null,
        razorpay_payment_id: pickTransactionValue(transaction, 'razorpay_payment_id', 'gatewayPaymentId', 'transactionId') || null,
        notes
    };
};

const getDocumentIfExists = async (databases, collectionId, documentId) => {
    try {
        return await retryAppwriteOperation(() => databases.getDocument(APPWRITE_DATABASE_ID, collectionId, documentId));
    } catch (error) {
        const code = Number(error?.code || error?.response?.code || 0);
        if (code === 404) return null;
        throw error;
    }
};

const buildTransactionDocumentData = ({
    userId,
    plan,
    pricing,
    appliedCoupon,
    razorpay_order_id,
    razorpay_payment_id,
    notes = '',
    paymentAttemptId = null
}) => ({
    transactionId: String(razorpay_payment_id || '').trim(),
    amount: Number(pricing.final_amount || 0),
    currency: pricing.currency,
    transactionDate: new Date().toISOString(),
    status: 'success',
    userId: String(userId || '').trim(),
    planCode: String(plan.plan_code || plan.id || '').trim(),
    planName: String(plan.name || 'Plan').trim(),
    billingCycle: pricing.billing_cycle,
    baseAmount: Number(pricing.base_amount || 0),
    discountAmount: Number(pricing.discount || 0),
    finalAmount: Number(pricing.final_amount || 0),
    paymentProvider: 'razorpay',
    gatewayOrderId: razorpay_order_id || null,
    gatewayPaymentId: razorpay_payment_id || null,
    couponId: appliedCoupon?.$id || '',
    couponCode: appliedCoupon?.code || '',
    paymentAttemptId: paymentAttemptId || null,
    notes: String(notes || '').trim(),
    switchType: 'purchase'
});

const normalizePaymentAttemptStatus = (value, fallback = 'created') => {
    const normalized = String(value || '').trim().toLowerCase();
    if (['created', 'paid', 'expired', 'cancelled', 'failed', 'cleared'].includes(normalized)) {
        return normalized;
    }
    return fallback;
};

const buildPaymentAttemptData = ({
    userId,
    plan,
    pricing,
    appliedCoupon,
    status = 'created',
    gatewayOrderId,
    gatewayPaymentId = null,
    gatewayReceipt = null,
    meta = null,
    createdAt = null,
    verifiedAt = null
}) => ({
    user_id: String(userId || '').trim(),
    plan_code: String(plan?.plan_code || plan?.id || '').trim(),
    plan_name: String(plan?.name || 'Plan').trim() || 'Plan',
    billing_cycle: normalizeBillingCycle(pricing?.billing_cycle || 'monthly'),
    currency: String(pricing?.currency || 'INR').trim().toUpperCase() || 'INR',
    base_amount: Number(pricing?.base_amount || 0),
    discount_amount: Number(pricing?.discount || 0),
    final_amount: Number(pricing?.final_amount || 0),
    coupon_id: appliedCoupon?.$id || null,
    coupon_code: appliedCoupon?.code || null,
    status: normalizePaymentAttemptStatus(status),
    gateway_order_id: String(gatewayOrderId || '').trim(),
    gateway_payment_id: gatewayPaymentId ? String(gatewayPaymentId).trim() : null,
    gateway_receipt: gatewayReceipt ? String(gatewayReceipt).trim() : null,
    created_at: createdAt || new Date().toISOString(),
    verified_at: verifiedAt || null,
    meta_json: meta ? JSON.stringify(meta) : null
});

const getPaymentAttemptIfExists = async (databases, documentId) => {
    const safeDocumentId = String(documentId || '').trim();
    if (!safeDocumentId) return null;
    try {
        return await retryAppwriteOperation(() => databases.getDocument(APPWRITE_DATABASE_ID, PAYMENT_ATTEMPTS_COLLECTION_ID, safeDocumentId));
    } catch (error) {
        const code = Number(error?.code || error?.response?.code || 0);
        if (code === 404) return null;
        throw error;
    }
};

const listPaymentAttempts = async (databases, queries = [], limit = 25) => {
    const response = await retryAppwriteOperation(() => databases.listDocuments(APPWRITE_DATABASE_ID, PAYMENT_ATTEMPTS_COLLECTION_ID, [
        Query.limit(limit),
        ...queries
    ]));
    return response.documents || [];
};

const createPendingPaymentAttempt = async ({
    databases,
    userId,
    plan,
    pricing,
    appliedCoupon,
    meta = null
}) => {
    const placeholderGatewayOrderId = `pending_${ID.unique()}`;
    const attempt = await retryAppwriteOperation(() => databases.createDocument(
        APPWRITE_DATABASE_ID,
        PAYMENT_ATTEMPTS_COLLECTION_ID,
        ID.unique(),
        buildPaymentAttemptData({
            userId,
            plan,
            pricing,
            appliedCoupon,
            gatewayOrderId: placeholderGatewayOrderId,
            meta
        })
    ));
    return attempt;
};

const updatePaymentAttempt = async (databases, attemptId, patch = {}) => {
    const safeAttemptId = String(attemptId || '').trim();
    if (!safeAttemptId) return null;
    return retryAppwriteOperation(() => databases.updateDocument(APPWRITE_DATABASE_ID, PAYMENT_ATTEMPTS_COLLECTION_ID, safeAttemptId, patch));
};

const parsePaymentAttemptMeta = (attempt) => {
    try {
        const parsed = attempt?.meta_json ? JSON.parse(attempt.meta_json) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const buildPricingFromPaymentAttempt = (attempt) => {
    const meta = parsePaymentAttemptMeta(attempt);
    const billing_cycle = normalizeBillingCycle(
        attempt?.billing_cycle
        || meta.requested_billing_cycle
        || 'monthly'
    );
    const currency = normalizeCurrency(
        attempt?.currency
        || meta.requested_currency
        || 'INR'
    );
    return {
        billing_cycle,
        currency,
        base_amount: Number(attempt?.base_amount || 0),
        discount: Number(attempt?.discount_amount || 0),
        final_amount: Number(attempt?.final_amount || 0),
        yearly_monthly_display_price: Number(attempt?.base_amount || 0),
        validity_days: getValidityDays(billing_cycle)
    };
};

const buildCouponSnapshotFromAttempt = (attempt) => {
    const couponId = String(attempt?.coupon_id || '').trim();
    const couponCode = String(attempt?.coupon_code || '').trim();
    if (!couponId && !couponCode) return null;
    return {
        $id: couponId || null,
        code: couponCode || null
    };
};

const resolveAttemptPlanPurchase = async (databases, paymentAttempt) => {
    const planIdentifier = String(paymentAttempt?.plan_code || '').trim();
    const plan = await getPlanByIdentifier(databases, planIdentifier);
    if (!plan) {
        const error = new Error('Pricing plan for payment attempt was not found.');
        error.statusCode = 409;
        throw error;
    }
    return {
        plan,
        pricing: buildPricingFromPaymentAttempt(paymentAttempt),
        appliedCoupon: buildCouponSnapshotFromAttempt(paymentAttempt)
    };
};

const patchExistingTransaction = async (databases, transaction, patch = {}) => {
    const safeTransactionId = String(transaction?.$id || '').trim();
    if (!safeTransactionId) return transaction;
    const nextPatch = Object.entries(patch).reduce((acc, [key, value]) => {
        if (value !== undefined && transaction?.[key] !== value) {
            acc[key] = value;
        }
        return acc;
    }, {});
    if (Object.keys(nextPatch).length === 0) {
        return transaction;
    }
    return retryAppwriteOperation(() => databases.updateDocument(
        APPWRITE_DATABASE_ID,
        TRANSACTIONS_COLLECTION_ID,
        safeTransactionId,
        nextPatch
    ));
};

const upsertSuccessfulTransaction = async ({
    databases,
    userId,
    plan,
    pricing,
    appliedCoupon,
    razorpay_order_id = null,
    razorpay_payment_id = null,
    notes = '',
    paymentAttemptId = null
}) => {
    let transaction = razorpay_payment_id
        ? await findTransactionDocument(databases, userId, razorpay_payment_id)
        : null;
    if (!transaction && razorpay_order_id) {
        transaction = await findTransactionDocument(databases, userId, razorpay_order_id);
    }

    const payload = buildTransactionDocumentData({
        userId,
        plan,
        pricing,
        appliedCoupon,
        razorpay_order_id,
        razorpay_payment_id,
        notes,
        paymentAttemptId
    });

    if (transaction) {
        return patchExistingTransaction(databases, transaction, payload);
    }

    return retryAppwriteOperation(() => databases.createDocument(
        APPWRITE_DATABASE_ID,
        TRANSACTIONS_COLLECTION_ID,
        ID.unique(),
        payload
    ));
};

const getCapturedPaymentForOrder = async (orderId) => {
    const safeOrderId = String(orderId || '').trim();
    if (!razorpay || !safeOrderId || typeof razorpay.orders?.fetchPayments !== 'function') {
        return null;
    }
    const response = await razorpay.orders.fetchPayments(safeOrderId);
    const payments = Array.isArray(response?.items) ? response.items : [];
    const ranked = payments
        .slice()
        .sort((left, right) => Number(right?.created_at || 0) - Number(left?.created_at || 0));
    return ranked.find((entry) => normalizeRazorpayPaymentStatus(entry?.status) === 'captured')
        || ranked.find((entry) => normalizeRazorpayPaymentStatus(entry?.status) === 'authorized')
        || ranked[0]
        || null;
};

const fetchGatewayPaymentEntity = async ({ razorpayPaymentId = null, razorpayOrderId = null, paymentEntity = null } = {}) => {
    if (paymentEntity?.id) {
        return paymentEntity;
    }

    const safePaymentId = String(razorpayPaymentId || '').trim();
    if (razorpay && safePaymentId && typeof razorpay.payments?.fetch === 'function') {
        return razorpay.payments.fetch(safePaymentId);
    }

    return getCapturedPaymentForOrder(razorpayOrderId);
};

const findPaymentAttemptForVerification = async (databases, {
    paymentAttemptId = null,
    gatewayOrderId = null,
    gatewayPaymentId = null
} = {}) => {
    const direct = await getPaymentAttemptIfExists(databases, paymentAttemptId);
    if (direct) return direct;

    if (gatewayOrderId) {
        const byOrder = await listPaymentAttempts(databases, [
            Query.equal('gateway_order_id', String(gatewayOrderId).trim())
        ], 1);
        if (byOrder[0]) return byOrder[0];
    }

    if (gatewayPaymentId) {
        const byPayment = await listPaymentAttempts(databases, [
            Query.equal('gateway_payment_id', String(gatewayPaymentId).trim())
        ], 1);
        if (byPayment[0]) return byPayment[0];
    }

    return null;
};

const clearSupersededPaymentAttempts = async ({
    databases,
    userId,
    planCode,
    billingCycle,
    excludeAttemptId = null,
    createdBefore = null
}) => {
    const attempts = await listPaymentAttempts(databases, [
        Query.equal('user_id', String(userId || '').trim()),
        Query.equal('plan_code', String(planCode || '').trim()),
        Query.equal('billing_cycle', normalizeBillingCycle(billingCycle || 'monthly')),
        Query.equal('status', 'created')
    ], 100).catch(() => []);

    const excludeId = String(excludeAttemptId || '').trim();
    const createdBeforeTs = createdBefore ? new Date(createdBefore).getTime() : null;
    await Promise.allSettled(
        attempts
            .filter((attempt) => {
                if (String(attempt?.$id || '').trim() === excludeId) return false;
                if (!createdBeforeTs) return true;
                const attemptCreated = new Date(attempt?.created_at || attempt?.$createdAt || 0).getTime();
                return !Number.isNaN(attemptCreated) && attemptCreated <= createdBeforeTs;
            })
            .map((attempt) => updatePaymentAttempt(databases, attempt.$id, {
                status: 'cancelled'
            }).catch(() => null))
    );
};

const ensureUserProfileDocument = async (
    databases,
    userId,
    plan,
    subscriptionExpires,
    options = {}
) => {
    let profileId = String(userId || '').trim();
    let existingProfile = await getDocumentIfExists(databases, PROFILES_COLLECTION_ID, profileId);

    if (!existingProfile) {
        const profileList = await retryAppwriteOperation(() => databases.listDocuments(APPWRITE_DATABASE_ID, PROFILES_COLLECTION_ID, [
            Query.equal('user_id', String(userId || '').trim()),
            Query.limit(1)
        ]));
        existingProfile = profileList.documents[0] || null;
        profileId = existingProfile?.$id || profileId;
    }

    const payload = buildPlanProfilePayload({
        currentProfile: existingProfile,
        plan,
        planId: plan?.plan_code || plan?.id || 'free',
        billingCycle: options.billingCycle || 'monthly',
        subscriptionStatus: 'active',
        subscriptionExpires,
        paidPlanSnapshot: options.paidPlanSnapshot || null,
        resetReminderState: true,
        credits: existingProfile ? undefined : 0
    });

    if (!existingProfile) {
        return retryAppwriteOperation(() => databases.createDocument(APPWRITE_DATABASE_ID, PROFILES_COLLECTION_ID, profileId, {
            user_id: String(userId || '').trim(),
            ...payload
        }));
    }

    return retryAppwriteOperation(() => databases.updateDocument(APPWRITE_DATABASE_ID, PROFILES_COLLECTION_ID, profileId, payload));
};

const updateUserSubscriptionMemory = async (
    databases,
    userId,
    plan,
    subscriptionExpires
) => retryAppwriteOperation(() => databases.updateDocument(
    APPWRITE_DATABASE_ID,
    USERS_COLLECTION_ID,
    String(userId || '').trim(),
    {
        plan_id: String(plan?.plan_code || plan?.id || 'free').trim() || 'free',
        plan_expires_at: subscriptionExpires || null
    }
));

const finalizePlanPurchase = async ({
    databases,
    userId,
    plan,
    pricing,
    appliedCoupon,
    razorpay_order_id = null,
    razorpay_payment_id = null,
    notes = '',
    paymentAttemptId = null
}) => {
    const subscriptionPlanId = plan.plan_code || plan.id;
    const subscriptionExpires = calculateSubscriptionExpiry({
        billingCycle: pricing.billing_cycle,
        durationDays: pricing.validity_days
    });
    const planLimits = getPlanLimitSnapshot(plan);
    const paidPlanSnapshot = buildPaidPlanSnapshot({
        plan,
        billingCycle: pricing.billing_cycle,
        expires: subscriptionExpires,
        status: 'active',
        limits: {
            instagram_connections_limit: Number(resolvePlanLimits(plan).instagram_connections_limit || 0),
            hourly_action_limit: Number(planLimits.hourly_action_limit || 0),
            daily_action_limit: Number(planLimits.daily_action_limit || 0),
            monthly_action_limit: planLimits.monthly_action_limit == null
                ? null
                : Number(planLimits.monthly_action_limit || 0)
        }
    });

    const transaction = await upsertSuccessfulTransaction({
        databases,
        userId,
        plan,
        pricing,
        appliedCoupon,
        razorpay_order_id,
        razorpay_payment_id,
        notes,
        paymentAttemptId
    });

    await retryAppwriteOperation(() => updateUserSubscriptionMemory(databases, userId, plan, subscriptionExpires));
    await ensureUserProfileDocument(
        databases,
        userId,
        plan,
        subscriptionExpires,
        {
            billingCycle: pricing.billing_cycle,
            paidPlanSnapshot
        }
    );
    const runtimeContext = await resolveUserPlanContext(databases, userId);
    await recomputeAccountAccessForUser(databases, userId, runtimeContext.profile);
    await touchUserActivity(userId, {
        databases,
        force: true,
        clearCleanupState: true
    }).catch(() => null);

    if (paymentAttemptId) {
        await updatePaymentAttempt(databases, paymentAttemptId, {
            status: 'paid',
            gateway_order_id: razorpay_order_id || null,
            gateway_payment_id: razorpay_payment_id || null,
            verified_at: new Date().toISOString()
        });
        await clearSupersededPaymentAttempts({
            databases,
            userId,
            planCode: plan.plan_code || plan.id,
            billingCycle: pricing.billing_cycle,
            excludeAttemptId: paymentAttemptId,
            createdBefore: transaction?.transactionDate || transaction?.created_at || new Date().toISOString()
        });
    }

    await recordCouponRedemptionIfNeeded({
        databases,
        userId,
        planId: plan.id,
        billingCycle: pricing.billing_cycle,
        pricing,
        appliedCoupon,
        razorpay_order_id,
        razorpay_payment_id,
        paymentAttemptId
    });

    return {
        message: pricing.final_amount > 0
            ? 'Payment verified successfully.'
            : 'Plan activated successfully.',
        plan: buildUserPlanPayload(plan, {
            expires_at: subscriptionExpires,
            billing_cycle: pricing.billing_cycle,
            feature_overrides_json: buildProfileConfigPayload({
                paidPlanSnapshot
            }),
            ...planLimits
        }, 'active', subscriptionPlanId, null, 'self')
    };
};

const findTransactionDocument = async (databases, userId, identifier) => {
    const normalizedIdentifier = String(identifier || '').trim();
    if (!normalizedIdentifier) return null;

    const directMatch = await getDocumentIfExists(
        databases,
        TRANSACTIONS_COLLECTION_ID,
        normalizedIdentifier
    );
    if (directMatch && String(directMatch.userId || directMatch.user_id || '') === String(userId)) {
        return directMatch;
    }

    const lookupFields = ['gatewayPaymentId', 'gatewayOrderId'];
    for (const field of lookupFields) {
        const response = await retryAppwriteOperation(() => databases.listDocuments(APPWRITE_DATABASE_ID, TRANSACTIONS_COLLECTION_ID, [
            Query.equal('userId', String(userId)),
            Query.equal(field, normalizedIdentifier),
            Query.limit(1)
        ]));
        if (response.documents[0]) {
            return response.documents[0];
        }
    }

    return null;
};

const serializeCoupon = (coupon) => {
    if (!coupon) return null;
    return {
        id: String(coupon.$id || ''),
        code: String(coupon.code || ''),
        type: String(coupon.type || ''),
        value: Number(coupon.value || 0),
        usage_limit: Number(coupon.usage_limit || 0),
        usage_per_user: Number(coupon.usage_per_user || 0)
    };
};

const getRedemptionCount = async (databases, queries) => {
    try {
        const response = await databases.listDocuments(APPWRITE_DATABASE_ID, COUPON_REDEMPTIONS_COLLECTION_ID, [
            ...queries,
            Query.limit(1)
        ]);
        return Number(response.total || 0);
    } catch (_) {
        return 0;
    }
};

const validateCoupon = async ({ databases, couponCode, userId, planId, billingCycle = 'monthly' }) => {
    const normalizedCode = normalizeCouponCode(couponCode);
    if (!normalizedCode) return { valid: false, reason: 'missing' };
    try {
        const coupons = await databases.listDocuments(APPWRITE_DATABASE_ID, COUPONS_COLLECTION_ID, [
            Query.equal('code', normalizedCode),
            Query.limit(1)
        ]);
        const coupon = coupons.documents[0];
        if (!coupon) return { valid: false, reason: 'invalid' };
        if (coupon.active === false) return { valid: false, reason: 'inactive' };
        if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
            return { valid: false, reason: 'expired' };
        }
        const allowedPlans = Array.isArray(coupon.plan_ids) ? coupon.plan_ids.map(String) : [];
        if (allowedPlans.length && !allowedPlans.includes(String(planId))) {
            return { valid: false, reason: 'plan_not_eligible' };
        }
        const allowedBillingCycles = Array.isArray(coupon.billing_cycle_targets)
            ? coupon.billing_cycle_targets.map((value) => normalizeBillingCycle(value))
            : [];
        if (allowedBillingCycles.length > 0 && !allowedBillingCycles.includes(normalizeBillingCycle(billingCycle))) {
            return { valid: false, reason: 'billing_cycle_not_eligible' };
        }
        const allowedUsers = Array.isArray(coupon.user_ids) ? coupon.user_ids.map(String) : [];
        if (allowedUsers.length && !allowedUsers.includes(String(userId))) {
            return { valid: false, reason: 'user_not_eligible' };
        }

        const usageLimit = Math.max(0, Number(coupon.usage_limit || 0));
        const usagePerUser = Math.max(0, Number(coupon.usage_per_user || 0));
        if (usageLimit > 0) {
            const totalRedemptions = await getRedemptionCount(databases, [
                Query.equal('coupon_id', String(coupon.$id || '').trim())
            ]);
            if (totalRedemptions >= usageLimit) {
                return { valid: false, reason: 'usage_limit_reached' };
            }
        }

        if (usagePerUser > 0) {
            const userRedemptions = await getRedemptionCount(databases, [
                Query.equal('coupon_id', String(coupon.$id || '').trim()),
                Query.equal('user_id', String(userId || '').trim())
            ]);
            if (userRedemptions >= usagePerUser) {
                return { valid: false, reason: 'user_usage_limit_reached' };
            }
        }

        return { valid: true, coupon };
    } catch {
        return { valid: false, reason: 'invalid' };
    }
};

const recordCouponRedemptionIfNeeded = async ({
    databases,
    userId,
    planId,
    billingCycle,
    pricing,
    appliedCoupon,
    razorpay_order_id,
    razorpay_payment_id,
    paymentAttemptId = null
}) => {
    if (!appliedCoupon?.$id) return null;

    if (razorpay_payment_id) {
        const existing = await databases.listDocuments(APPWRITE_DATABASE_ID, COUPON_REDEMPTIONS_COLLECTION_ID, [
            Query.equal('razorpay_payment_id', String(razorpay_payment_id)),
            Query.limit(1)
        ]).catch(() => ({ documents: [] }));
        if (existing.documents?.[0]) {
            return existing.documents[0];
        }
    }

    const redemption = await databases.createDocument(
        APPWRITE_DATABASE_ID,
        COUPON_REDEMPTIONS_COLLECTION_ID,
        ID.unique(),
        {
            user_id: String(userId || '').trim(),
            coupon_id: String(appliedCoupon.$id || '').trim(),
            coupon_code: String(appliedCoupon.code || '').trim(),
            plan_id: String(planId || '').trim(),
            billing_cycle: normalizeBillingCycle(billingCycle),
            currency: String(pricing.currency || '').trim() || 'INR',
            base_amount: Number(pricing.base_amount || 0),
            discount_amount: Number(pricing.discount || 0),
            final_amount: Number(pricing.final_amount || 0),
            razorpay_order_id: razorpay_order_id || null,
            razorpay_payment_id: razorpay_payment_id || null,
            status: 'success',
            created_at: new Date().toISOString(),
            payment_attempt_id: paymentAttemptId || null
        }
    ).catch(() => null);

    if (redemption) {
        const nextRedemptionCount = Math.max(0, Number(appliedCoupon.redemption_count || 0)) + 1;
        await databases.updateDocument(
            APPWRITE_DATABASE_ID,
            COUPONS_COLLECTION_ID,
            String(appliedCoupon.$id || '').trim(),
            {
                redemption_count: nextRedemptionCount
            }
        ).catch(() => null);
    }

    return redemption;
};

const buildPricingQuote = ({ plan, billingCycle, currency, coupon }) => {
    const normalizedPlan = normalizePlanDocument(plan);
    const cycle = normalizeBillingCycle(billingCycle);
    const normalizedCurrency = normalizeCurrency(currency);
    const base_amount = resolvePlanPrice(normalizedPlan, cycle, normalizedCurrency);
    const yearly_monthly_display_price = cycle === 'yearly'
        ? resolveYearlyMonthlyDisplayPrice(normalizedPlan, normalizedCurrency)
        : base_amount;
    let discount = 0;
    if (coupon) {
        if (String(coupon.type || '').toLowerCase() === 'percent') {
            discount = Math.round((base_amount * Number(coupon.value || 0)) / 100);
        } else {
            discount = Number(coupon.value || 0);
        }
    }
    const final_amount = Math.max(0, base_amount - discount);
    return {
        billing_cycle: cycle,
        currency: normalizedCurrency,
        base_amount,
        discount,
        final_amount,
        yearly_monthly_display_price,
        validity_days: getValidityDays(cycle)
    };
};

const buildUserPlanPayload = (plan, profile, subscriptionStatus, subscriptionPlanId, accessState = null, planSource = null) => {
    const normalizedPlan = normalizePlanDocument(plan || {});
    const entitlements = resolvePlanEntitlements(normalizedPlan, profile);
    const limits = resolvePlanLimits(normalizedPlan, profile);
    const profileConfig = parseProfileConfig(profile);
    const planName = String(profile?.plan_name || normalizedPlan.name || 'Free Plan').trim() || 'Free Plan';
    const derivedFeatures = normalizedPlan.features && normalizedPlan.features.length > 0
        ? normalizedPlan.features
        : Object.entries(entitlements || {})
            .filter(([, enabled]) => enabled === true)
            .map(([key]) => String(key || '')
                .split(/[_-]+/)
                .filter(Boolean)
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' '));
    return {
        plan_id: subscriptionPlanId || normalizedPlan.plan_code || normalizedPlan.id || 'free',
        assigned_plan_id: profile?.plan_code || subscriptionPlanId || normalizedPlan.plan_code || normalizedPlan.id || 'free',
        plan_source: String(planSource || 'self').trim() || 'self',
        self_plan_id: profile?.self_plan_id || undefined,
        self_plan_expires_at: profile?.self_plan_expires_at || undefined,
        status: String(subscriptionStatus || 'inactive'),
        expires: profile?.expires_at || null,
        billing_cycle: profile?.billing_cycle || null,
        access_state: accessState,
        entitlements,
        custom_feature_overrides: profileConfig.feature_overrides,
        custom_limit_overrides: profileConfig.limit_overrides,
        paid_plan_snapshot: (() => {
            try {
                return profile?.paid_plan_snapshot_json
                    ? JSON.parse(profile.paid_plan_snapshot_json)
                    : profileConfig.paid_plan_snapshot;
            } catch {
                return profileConfig.paid_plan_snapshot;
            }
        })(),
        details: {
            name: planName,
            features: derivedFeatures,
            comparison: normalizedPlan.comparison,
            price_monthly_inr: normalizedPlan.price_monthly_inr,
            price_monthly_usd: normalizedPlan.price_monthly_usd,
            price_yearly_inr: normalizedPlan.price_yearly_inr,
            price_yearly_usd: normalizedPlan.price_yearly_usd,
            price_yearly_monthly_inr: normalizedPlan.price_yearly_monthly_inr,
            price_yearly_monthly_usd: normalizedPlan.price_yearly_monthly_usd,
            yearly_bonus: normalizedPlan.yearly_bonus
        },
        limits: {
            instagram_connections_limit: Number(limits.instagram_connections_limit || 0),
            instagram_link_limit: Number(limits.instagram_link_limit || limits.instagram_connections_limit || 0),
            hourly_action_limit: Number(limits.hourly_action_limit || 0),
            daily_action_limit: Number(limits.daily_action_limit || 0),
            monthly_action_limit: limits.monthly_action_limit == null ? null : Number(limits.monthly_action_limit)
        }
    };
};

router.post('/coupons/validate', loginRequired, async (req, res) => {
    try {
        const databases = getDatabases();
        const { plan_id, billing_cycle = 'monthly', currency, coupon_code } = req.body || {};
        const plan = await getPlanByIdentifier(databases, plan_id);
        if (!plan) {
            return res.status(404).json({ valid: false, error: 'Plan not found' });
        }
        const currencyPolicy = resolveRequestCurrency(req, currency);
        if (!coupon_code) {
            return res.json({
                valid: false,
                reason: 'missing',
                pricing: buildPricingQuote({ plan, billingCycle: billing_cycle, currency: currencyPolicy.currency }),
                plan
            });
        }
        const result = await validateCoupon({
            databases,
            couponCode: coupon_code,
            userId: req.user.$id,
            planId: plan.id,
            billingCycle: billing_cycle
        });
        if (!result.valid) {
            return res.json({
                valid: false,
                reason: result.reason,
                pricing: buildPricingQuote({ plan, billingCycle: billing_cycle, currency: currencyPolicy.currency }),
                plan
            });
        }
        return res.json({
            valid: true,
            coupon: serializeCoupon(result.coupon),
            pricing: buildPricingQuote({
                plan,
                billingCycle: billing_cycle,
                currency: currencyPolicy.currency,
                coupon: result.coupon
            }),
            plan
        });
    } catch (error) {
        console.error('Coupon validation failed:', error?.message || String(error));
        return res.status(500).json({ valid: false, error: 'Failed to validate coupon.' });
    }
});

router.post('/create-order', loginRequired, async (req, res) => {
    try {
        const { plan_id, coupon_code } = req.body || {};
        const billingCycle = normalizeBillingCycle(req.body?.billing_cycle);
        const currencyPolicy = resolveRequestCurrency(req, req.body?.currency);
        if (!plan_id) return res.status(400).json({ error: 'plan_id is required' });

        const databases = getDatabases();
        const plan = await getPlanByIdentifier(databases, plan_id);
        if (!plan) return res.status(404).json({ error: 'Plan not found' });
        if (plan.plan_code === 'free') {
            return res.status(400).json({ error: 'Selected plan does not require payment.', reason: 'free_plan' });
        }

        let appliedCoupon = null;
        if (coupon_code) {
            const result = await validateCoupon({
                databases,
                couponCode: coupon_code,
                userId: req.user.$id,
                planId: plan.id,
                billingCycle
            });
            if (!result.valid) {
                return res.status(400).json({ error: 'Invalid coupon code.', reason: result.reason });
            }
            appliedCoupon = result.coupon;
        }

        const pricing = buildPricingQuote({
            plan,
            billingCycle,
            currency: currencyPolicy.currency,
            coupon: appliedCoupon
        });

        if (pricing.final_amount <= 0) {
            return res.json({
                no_payment_required: true,
                pricing: {
                    ...pricing,
                    coupon: serializeCoupon(appliedCoupon)
                },
                plan,
                allowed_currencies: currencyPolicy.allowedCurrencies,
                default_currency: currencyPolicy.defaultCurrency
            });
        }

        if (!razorpay) {
            return res.status(500).json({ error: 'Payment gateway is not configured.' });
        }

        const paymentAttempt = await createPendingPaymentAttempt({
            databases,
            userId: req.user.$id,
            plan,
            pricing,
            appliedCoupon,
            meta: {
                requested_currency: currencyPolicy.currency,
                requested_billing_cycle: billingCycle
            }
        });

        let order;
        try {
            order = await razorpay.orders.create({
                amount: pricing.final_amount * 100,
                currency: pricing.currency,
                receipt: `dmp_${req.user.$id}_${Date.now()}`,
                payment_capture: 1,
                notes: {
                    payment_attempt_id: paymentAttempt.$id,
                    user_id: req.user.$id,
                    plan_code: String(plan.plan_code || plan.id || '').trim(),
                    billing_cycle: pricing.billing_cycle,
                    coupon_code: appliedCoupon?.code || ''
                }
            });
        } catch (error) {
            await updatePaymentAttempt(databases, paymentAttempt.$id, {
                status: 'cancelled'
            }).catch(() => null);
            throw error;
        }

        await updatePaymentAttempt(databases, paymentAttempt.$id, {
            gateway_order_id: order.id,
            gateway_receipt: order.receipt || null,
            meta_json: JSON.stringify({
                requested_currency: currencyPolicy.currency,
                requested_billing_cycle: billingCycle,
                razorpay_order_status: order.status || null
            })
        });

        return res.json({
            order,
            key: RAZORPAY_KEY_ID || null,
            payment_attempt_id: paymentAttempt.$id,
            gateway_order_id: order.id,
            pricing: {
                ...pricing,
                coupon: serializeCoupon(appliedCoupon)
            },
            plan,
            allowed_currencies: currencyPolicy.allowedCurrencies,
            default_currency: currencyPolicy.defaultCurrency
        });
    } catch (error) {
        console.error('Razorpay create order error:', describeError(error));
        return res.status(500).json({ error: 'Failed to create payment order.' });
    }
});

router.post('/verify-payment', loginRequired, async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            plan_id,
            coupon_code,
            payment_attempt_id
        } = req.body || {};
        const billingCycle = normalizeBillingCycle(req.body?.billing_cycle);
        const currencyPolicy = resolveRequestCurrency(req, req.body?.currency);
        const databases = getDatabases();

        const paymentAttempt = await findPaymentAttemptForVerification(databases, {
            paymentAttemptId: payment_attempt_id,
            gatewayOrderId: razorpay_order_id,
            gatewayPaymentId: razorpay_payment_id
        });
        if (paymentAttempt && String(paymentAttempt.user_id || '').trim() !== String(req.user.$id || '').trim()) {
            return res.status(403).json({ error: 'Payment attempt does not belong to this user.' });
        }

        let plan;
        let pricing;
        let appliedCoupon = null;
        if (paymentAttempt) {
            ({ plan, pricing, appliedCoupon } = await resolveAttemptPlanPurchase(databases, paymentAttempt));
            if (plan_id && normalizePlanCode(plan_id) !== normalizePlanCode(plan.plan_code || plan.id)) {
                return res.status(409).json({ error: 'Payment attempt plan does not match verification request.' });
            }
        } else {
            if (!plan_id) {
                return res.status(400).json({ error: 'Missing payment details' });
            }
            plan = await getPlanByIdentifier(databases, plan_id);
            if (!plan) {
                return res.status(404).json({ error: 'Plan not found' });
            }

            if (coupon_code) {
                const result = await validateCoupon({
                    databases,
                    couponCode: coupon_code,
                    userId: req.user.$id,
                    planId: plan.id,
                    billingCycle
                });
                if (!result.valid) {
                    return res.status(400).json({ error: 'Invalid coupon code.', reason: result.reason });
                }
                appliedCoupon = result.coupon;
            }

            pricing = buildPricingQuote({
                plan,
                billingCycle,
                currency: currencyPolicy.currency,
                coupon: appliedCoupon
            });
        }

        if (pricing.final_amount <= 0) {
            return res.json(await finalizePlanPurchase({
                databases,
                userId: req.user.$id,
                plan,
                pricing,
                appliedCoupon,
                paymentAttemptId: payment_attempt_id || null,
                notes: appliedCoupon?.code
                    ? `Coupon redemption completed without gateway charge (${appliedCoupon.code}).`
                    : 'Coupon redemption completed without gateway charge.'
            }));
        }

        if (!RAZORPAY_KEY_SECRET) {
            return res.status(500).json({ error: 'Payment gateway is not configured.' });
        }
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: 'Missing payment details' });
        }

        const generatedSignature = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ error: 'Payment verification failed' });
        }

        return res.json(await finalizePlanPurchase({
            databases,
            userId: req.user.$id,
            plan,
            pricing,
            appliedCoupon,
            razorpay_order_id,
            razorpay_payment_id,
            paymentAttemptId: paymentAttempt?.$id || payment_attempt_id || null
        }));
    } catch (error) {
        console.error('Razorpay verify error:', describeError(error));
        return res.status(500).json({ error: 'Failed to verify payment.' });
    }
});

router.post('/razorpay/webhook', async (req, res) => {
    try {
        if (!razorpay || !RAZORPAY_WEBHOOK_SECRET) {
            return res.status(500).json({ error: 'Payment webhook is not configured.' });
        }

        const rawBody = getWebhookRawBody(req);
        const signature = req.headers['x-razorpay-signature'];
        if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
            return res.status(400).json({ error: 'Invalid Razorpay webhook signature.' });
        }

        const payload = JSON.parse(rawBody.toString('utf8') || '{}');
        const eventName = String(payload?.event || '').trim().toLowerCase();
        const relevantEvents = new Set(['payment.captured', 'order.paid']);
        if (!relevantEvents.has(eventName)) {
            return res.status(200).json({ ok: true, ignored: true, event: eventName || 'unknown' });
        }

        const webhookPayment = payload?.payload?.payment?.entity || null;
        const webhookOrder = payload?.payload?.order?.entity || null;
        let razorpayPaymentId = String(webhookPayment?.id || '').trim();
        let razorpayOrderId = String(webhookPayment?.order_id || webhookOrder?.id || '').trim();

        const gatewayPayment = await fetchGatewayPaymentEntity({
            razorpayPaymentId,
            razorpayOrderId,
            paymentEntity: webhookPayment
        });
        const paymentStatus = normalizeRazorpayPaymentStatus(gatewayPayment?.status || webhookPayment?.status || webhookOrder?.status);
        if (!['captured', 'paid'].includes(paymentStatus)) {
            return res.status(200).json({ ok: true, ignored: true, status: paymentStatus });
        }

        razorpayPaymentId = String(gatewayPayment?.id || razorpayPaymentId).trim();
        razorpayOrderId = String(gatewayPayment?.order_id || razorpayOrderId).trim();

        const databases = getDatabases();
        const paymentAttempt = await findPaymentAttemptForVerification(databases, {
            gatewayOrderId: razorpayOrderId,
            gatewayPaymentId: razorpayPaymentId
        });

        if (!paymentAttempt) {
            return res.status(202).json({ ok: true, ignored: true, reason: 'payment_attempt_not_found' });
        }

        const { plan, pricing, appliedCoupon } = await resolveAttemptPlanPurchase(databases, paymentAttempt);
        if (Number(pricing.final_amount || 0) <= 0) {
            return res.status(200).json({ ok: true, ignored: true, reason: 'no_charge_attempt' });
        }

        const gatewayAmount = Number(gatewayPayment?.amount || webhookPayment?.amount || 0) / 100;
        const gatewayCurrency = normalizeCurrency(gatewayPayment?.currency || webhookPayment?.currency || pricing.currency);
        if (gatewayAmount > 0 && Math.abs(gatewayAmount - Number(pricing.final_amount || 0)) > 0.01) {
            return res.status(409).json({ error: 'Webhook payment amount does not match the payment attempt.' });
        }
        if (gatewayCurrency !== normalizeCurrency(pricing.currency)) {
            return res.status(409).json({ error: 'Webhook payment currency does not match the payment attempt.' });
        }

        const response = await finalizePlanPurchase({
            databases,
            userId: paymentAttempt.user_id,
            plan,
            pricing,
            appliedCoupon,
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: razorpayPaymentId,
            paymentAttemptId: paymentAttempt.$id,
            notes: `Razorpay webhook (${eventName})`
        });

        return res.status(200).json({
            ok: true,
            event: eventName,
            payment_attempt_id: paymentAttempt.$id,
            plan_id: response?.plan?.plan_id || null
        });
    } catch (error) {
        console.error('Razorpay webhook error:', describeError(error));
        return res.status(500).json({ error: 'Failed to process Razorpay webhook.' });
    }
});

router.get('/my-plan', loginRequired, async (req, res) => {
    try {
        const databases = getDatabases();
        const {
            profile,
            subscriptionPlanId,
            subscriptionStatus,
            planSource,
            selfPlanId,
            selfPlanExpiresAt
        } = await retryAppwriteOperation(() => resolveUserPlanContext(databases, req.user.$id, req.user));
        const { accessState } = await loadUserAccessState(databases, req.user.$id, {
            userDocument: req.userDocument || null
        });
        return res.json(buildUserPlanPayload(null, {
            ...(profile || {}),
            self_plan_id: selfPlanId,
            self_plan_expires_at: selfPlanExpiresAt
        }, subscriptionStatus, subscriptionPlanId, accessState, planSource));
    } catch (error) {
        console.error('Get my plan error:', error?.message || String(error));
        return res.status(500).json({ error: 'Failed to fetch plan details.' });
    }
});

router.get('/transactions', loginRequired, async (req, res) => {
    try {
        const databases = getDatabases();
        const [pricingPlans, transactionsResult] = await Promise.all([
            listPricingPlans(databases),
            databases.listDocuments(APPWRITE_DATABASE_ID, TRANSACTIONS_COLLECTION_ID, [
                Query.equal('userId', req.user.$id),
                Query.limit(250)
            ])
        ]);
        const pricingMap = new Map(pricingPlans.map((plan) => [plan.id, plan]));
        const sortedDocuments = transactionsResult.documents
            .slice()
            .sort((a, b) => new Date(b.transactionDate || b.created_at || b.$createdAt).getTime() - new Date(a.transactionDate || a.created_at || a.$createdAt).getTime());

        const earliestTransactionDate = sortedDocuments.length > 0
            ? toDateInputValue(sortedDocuments[sortedDocuments.length - 1].transactionDate || sortedDocuments[sortedDocuments.length - 1].created_at || sortedDocuments[sortedDocuments.length - 1].$createdAt)
            : null;
        const todayDate = toDateInputValue(new Date());

        let selectedFrom = normalizeDateFilter(req.query?.from);
        let selectedTo = normalizeDateFilter(req.query?.to);

        if (earliestTransactionDate && (!selectedFrom || selectedFrom < earliestTransactionDate)) {
            selectedFrom = earliestTransactionDate;
        }
        if (todayDate && (!selectedTo || selectedTo > todayDate)) {
            selectedTo = todayDate;
        }
        if (selectedFrom && selectedTo && selectedFrom > selectedTo) {
            selectedFrom = selectedTo;
        }

        const filteredTransactions = sortedDocuments
            .filter((transaction) => {
                const transactionDate = toDateInputValue(transaction.transactionDate || transaction.created_at || transaction.$createdAt);
                if (!transactionDate) return true;
                if (selectedFrom && transactionDate < selectedFrom) return false;
                if (selectedTo && transactionDate > selectedTo) return false;
                return true;
            })
            .map((transaction) => buildTransactionPayload(transaction, pricingMap));

        return res.json({
            transactions: filteredTransactions,
            date_bounds: {
                min_from: earliestTransactionDate,
                max_to: todayDate
            },
            selected_from: selectedFrom,
            selected_to: selectedTo
        });
    } catch (error) {
        console.error('Transactions fetch error:', error?.message || String(error));
        return res.status(500).json({ error: 'Failed to load transactions.' });
    }
});

router.get('/transactions/:transactionId/pdf', loginRequired, async (req, res) => {
    try {
        const databases = getDatabases();
        const [pricingPlans, transaction] = await Promise.all([
            listPricingPlans(databases),
            findTransactionDocument(
                databases,
                req.user.$id,
                req.params.transactionId
            )
        ]);

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found.' });
        }

        const pricingMap = new Map(pricingPlans.map((plan) => [plan.id, plan]));
        const payload = buildTransactionPayload(transaction, pricingMap);
        const fileName = `dmpanda-transaction-${payload.id}.pdf`;
        const receipt = buildTransactionReceipt({
            transaction: payload,
            user: req.user
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=\"${fileName}\"`);

        receipt.pipe(res);
        receipt.end();
    } catch (error) {
        console.error('Transaction PDF error:', error?.message || String(error));
        return res.status(500).json({ error: 'Failed to generate transaction receipt.' });
    }
});

router.get('/pricing', async (req, res) => {
    try {
        const currencyPolicy = resolveRequestCurrency(req, req.query?.currency);
        const { payload, cacheStatus } = await getCachedPricingPayload(currencyPolicy);
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.setHeader('X-Pricing-Cache', cacheStatus);
        return res.json(payload);
    } catch (error) {
        console.error('Pricing fetch error:', error?.message || String(error));
        return res.status(500).json({ error: 'Failed to fetch pricing plans.' });
    }
});

module.exports = router;

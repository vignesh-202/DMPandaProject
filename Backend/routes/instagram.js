const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const { loginRequired } = require('../middleware/auth');
const {
    getAppwriteClient,
    Functions,
    IG_ACCOUNTS_COLLECTION_ID,
    AUTOMATIONS_COLLECTION_ID,
    REPLY_TEMPLATES_COLLECTION_ID,
    INBOX_MENUS_COLLECTION_ID,
    CONVO_STARTERS_COLLECTION_ID,
    SUPER_PROFILES_COLLECTION_ID,
    COMMENT_MODERATION_COLLECTION_ID,
    KEYWORDS_COLLECTION_ID,
    KEYWORD_INDEX_COLLECTION_ID,
    LOGS_COLLECTION_ID,
    CHAT_STATES_COLLECTION_ID,
    PROFILES_COLLECTION_ID,
    AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID,
    FUNCTION_REMOVE_INSTAGRAM
} = require('../utils/appwrite');
const {
    getGoogleServiceAccount,
    loadSpreadsheetMetadata,
    sendWebhookPayload
} = require('../utils/emailCollectors');
const {
    resolveUserPlanContext,
    normalizeFeatureKey
} = require('../utils/planConfig');
const { Databases, Query, ID, Permission, Role, ExecutionMethod } = require('node-appwrite');
const { buildAccessDeniedPayload } = require('../utils/accessControl');
const {
    isLinkedAccountActive,
    normalizeAccountAccess,
    recomputeAccountAccessForUser
} = require('../utils/accountAccess');

// Environment variables
const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID;
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
const INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URL || process.env.INSTAGRAM_REDIRECT_URI;

// ==============================================================================
// AUTOMATION VALIDATION + TEMPLATE LINKING
// ==============================================================================
const AUTOMATION_TITLE_MIN = 2;
const AUTOMATION_TITLE_MAX = 25;
const TEXT_MIN = 2;
const TEXT_MAX = 1000;
const BUTTON_TEXT_MAX = 640;
const BUTTON_TITLE_MIN = 2;
const BUTTON_TITLE_MAX = 40;
const QUICK_REPLY_TITLE_MIN = 2;
const QUICK_REPLY_TITLE_MAX = 20;
const QUICK_REPLY_PAYLOAD_MIN = 2;
const QUICK_REPLY_PAYLOAD_MAX = 950;
const QUICK_REPLIES_TEXT_MAX = 950;
const CAROUSEL_TITLE_MIN = 2;
const CAROUSEL_TITLE_MAX = 80;
const CAROUSEL_SUBTITLE_MAX = 80;
const CAROUSEL_ELEMENTS_MAX = 10;
const CAROUSEL_BUTTON_TITLE_MIN = 2;
const CAROUSEL_BUTTON_TITLE_MAX = 20;
const BUTTONS_MAX = 3;
const QUICK_REPLIES_MAX = 13;
const MEDIA_URL_MAX = 500;
const FOLLOWERS_ONLY_MESSAGE_DEFAULT = 'Please follow this account first, then send your message again.';
const FOLLOWERS_ONLY_MESSAGE_MAX = 300;
const FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT = '👤 Follow Account';
const FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT = "✅ I've Followed";
const COLLECT_EMAIL_PROMPT_DEFAULT = '📧 Could you share your best email so we can send the details and updates ✨';
const COLLECT_EMAIL_FAIL_RETRY_DEFAULT = '⚠️ That email looks invalid. Please send a valid email like name@example.com.';
const COLLECT_EMAIL_SUCCESS_DEFAULT = 'Perfect, thank you! Your email has been saved ✅';

const VALID_TEMPLATE_TYPES = new Set([
    'template_text',
    'template_carousel',
    'template_buttons',
    'template_media',
    'template_share_post',
    'template_quick_replies',
    'template_media_attachment',
    'template_url'
]);

const byteLen = (s) => Buffer.byteLength(String(s || ''), 'utf8');
const parseMaybeJson = (v, fallback) => {
    if (v === null || v === undefined) return fallback;
    if (typeof v === 'string') {
        try { return JSON.parse(v); } catch (_) { return fallback; }
    }
    return v;
};

const normalizeTitle = (value) => String(value || '').trim().toLowerCase();

const KEYWORD_MAX_PER_AUTOMATION = 5;
const KEYWORD_TYPES = new Set(['dm', 'global', 'post', 'reel', 'story', 'live', 'comment']);
const GATED_AUTOMATION_FEATURES = {
    suggest_more_enabled: 'suggest_more',
    collect_email_enabled: 'collect_email',
    seen_typing_enabled: 'seen_typing'
};

const normalizeKeywordToken = (value) => String(value || '').trim().toUpperCase();
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

const PLAN_FEATURE_ALIASES = {
    suggest_more: ['suggest_more'],
    collect_email: ['collect_email', 'email_collector', 'webhook_integrations'],
    seen_typing: ['seen_typing']
};

const loadUserPlanAccess = async (databases, userId) => {
    const planContext = await resolveUserPlanContext(databases, userId);
    return {
        entitlements: planContext.entitlements || {},
        limits: planContext.limits || {},
        plan: planContext.plan || null
    };
};

const hasPlanEntitlement = (entitlements, featureKey) => {
    const aliases = PLAN_FEATURE_ALIASES[featureKey] || [featureKey];
    return aliases.some((candidate) => entitlements?.[normalizeFeatureKey(candidate)] === true);
};

const collectLockedAutomationFeatures = (payload) => {
    const source = payload && typeof payload === 'object' ? payload : {};
    return Object.entries(GATED_AUTOMATION_FEATURES)
        .filter(([field]) => source[field] === true)
        .map(([, featureKey]) => featureKey);
};

const enforceAutomationFeatureAccess = async (databases, userId, payload, options = {}) => {
    const requestedFeatures = new Set(collectLockedAutomationFeatures(payload));
    if (options.requireFeature) {
        requestedFeatures.add(String(options.requireFeature).trim());
    }

    if (requestedFeatures.size === 0) return null;

    const { entitlements } = await loadUserPlanAccess(databases, userId);
    const lockedFeatures = Array.from(requestedFeatures).filter((featureKey) => !hasPlanEntitlement(entitlements, featureKey));
    if (lockedFeatures.length === 0) return null;

    const featureLabels = {
        suggest_more: 'Suggest More',
        collect_email: 'Collect Email',
        seen_typing: 'Seen + Typing Reaction'
    };

    return {
        error: `${lockedFeatures.map((feature) => featureLabels[feature] || feature).join(', ')} is not included in your current plan.`,
        field: 'subscription',
        locked_features: lockedFeatures
    };
};

const enforceInstagramConnectionLimit = async (databases, userId, nextAccountId = '') => {
    const { limits } = await loadUserPlanAccess(databases, userId);
    const connectionLimit = Number(limits?.instagram_link_limit || limits?.instagram_connections_limit || 0);
    if (connectionLimit <= 0) {
        return {
            error: 'Your current plan does not include Instagram connections.',
            field: 'subscription',
            limit: 0,
            current_count: 0
        };
    }

    const accounts = await listOwnedIgAccounts(databases, userId);
    const normalizedNextAccountId = String(nextAccountId || '').trim();
    const alreadyConnected = accounts.documents.some((account) => matchesIgAccountIdentifier(account, normalizedNextAccountId));
    const currentCount = accounts.documents.length;

    if (!alreadyConnected && currentCount >= connectionLimit) {
        return {
            error: `Your current plan allows ${connectionLimit} Instagram connection${connectionLimit === 1 ? '' : 's'} only.`,
            field: 'subscription',
            limit: connectionLimit,
            current_count: currentCount
        };
    }

    return null;
};

const buildInstagramAccountAccessError = (account) => {
    const normalized = normalizeAccountAccess(account);
    return {
        error: 'This Instagram account is not accessible in your current plan.',
        code: normalized.access_reason || 'account_access_blocked',
        access_state: normalized
    };
};

const AUTOMATION_LOCKED_PREFIXES = [
    '/instagram/automations',
    '/instagram/reply-templates',
    '/instagram/inbox-menu',
    '/instagram/convo-starters',
    '/instagram/mentions-config',
    '/instagram/suggest-more',
    '/instagram/comment-moderation'
];

const requiresAutomationAccess = (path) => AUTOMATION_LOCKED_PREFIXES.some((prefix) => String(path || '').startsWith(prefix));

router.use(async (req, res, next) => {
    if (!req.user || !requiresAutomationAccess(req.path)) {
        return next();
    }

    if (req.accessState?.automation_locked) {
        return res.status(403).json(buildAccessDeniedPayload(
            req.accessState,
            req.accessState.ban_message || 'Automation access is restricted for this account.'
        ));
    }

    return next();
});

const getKeywordInfo = (automation) => {
    const rawKeywords = parseMaybeJson(automation.keywords, []);
    let input = [];
    if (Array.isArray(rawKeywords) && rawKeywords.length > 0) {
        input = rawKeywords;
    } else if (Array.isArray(automation.keyword)) {
        input = automation.keyword;
    } else {
        const kw = String(automation.keyword || '').trim();
        input = kw ? kw.split(',') : [];
    }

    const normalized = input
        .map(k => normalizeKeywordToken(k))
        .filter(Boolean);

    const normalizedSet = new Set(normalized);
    const hasDuplicates = normalizedSet.size !== normalized.length;
    return { keywords: Array.from(normalizedSet), hasDuplicates };
};

const normalizeKeywordArray = (automation) => getKeywordInfo(automation).keywords;

const computeKeywordHash = (keywordNormalized) =>
    crypto.createHash('sha256').update(keywordNormalized).digest('hex');

const collectionAttributeCache = new Map();
const transientWarningTimestamps = new Map();
const COMMENT_MODERATION_AUTOMATION_TYPES = {
    hide: 'moderation_hide',
    delete: 'moderation_delete'
};

const isMissingCollectionError = (error) => {
    const message = String(error?.message || '');
    return message.includes('Collection with the requested ID could not be found.') || Number(error?.code) === 404;
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

const logWarnWithThrottle = (key, message, throttleMs = 60_000) => {
    const now = Date.now();
    const lastSeenAt = transientWarningTimestamps.get(key) || 0;
    if ((now - lastSeenAt) < throttleMs) return;
    transientWarningTimestamps.set(key, now);
    console.warn(message);
};

const listConfigAutomationDocuments = async (databases, {
    userId,
    accountIds,
    automationType,
    limit = 10
}) => {
    const uniqueAccountIds = Array.from(new Set(
        (Array.isArray(accountIds) ? accountIds : [accountIds])
            .map((value) => String(value || '').trim())
            .filter(Boolean)
    ));
    const queries = [
        Query.equal('user_id', String(userId)),
        Query.equal('automation_type', String(automationType)),
        Query.limit(limit),
        Query.orderDesc('$updatedAt')
    ];

    if (uniqueAccountIds.length === 1) {
        queries.splice(2, 0, Query.equal('account_id', uniqueAccountIds[0]));
    } else if (uniqueAccountIds.length > 1) {
        queries.splice(2, 0, Query.equal('account_id', uniqueAccountIds));
    }

    const result = await databases.listDocuments(
        process.env.APPWRITE_DATABASE_ID,
        AUTOMATIONS_COLLECTION_ID,
        queries
    );

    return {
        ...result,
        _collectionId: AUTOMATIONS_COLLECTION_ID
    };
};

const listMentionsDocuments = async (databases, {
    userId,
    accountIds,
    limit = 10
}) => listConfigAutomationDocuments(databases, {
    userId,
    accountIds,
    automationType: 'mentions',
    limit
});

const listSuggestMoreDocuments = async (databases, {
    userId,
    accountIds,
    limit = 10
}) => listConfigAutomationDocuments(databases, {
    userId,
    accountIds,
    automationType: 'suggest_more',
    limit
});

const COLLECTOR_DESTINATION_TYPES = new Set(['sheet', 'webhook']);

const normalizeCollectorDestinationType = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return COLLECTOR_DESTINATION_TYPES.has(normalized) ? normalized : '';
};

const parseDestinationJson = (value) => {
    const parsed = parseMaybeJson(value, {});
    return parsed && typeof parsed === 'object' ? parsed : {};
};

const getCollectorDestinationDefaults = () => {
    const serviceAccount = getGoogleServiceAccount();
    return {
        destination_type: '',
        sheet_link: '',
        webhook_url: '',
        destination_id: '',
        destination_json: {},
        verified: false,
        verified_at: null,
        service_account_email: serviceAccount?.client_email || ''
    };
};

const normalizeCollectorDestinationResponse = (document) => {
    if (!document) return getCollectorDestinationDefaults();
    const destinationJson = parseDestinationJson(document.destination_json);
    return {
        $id: document.$id,
        automation_id: String(document.automation_id || '').trim(),
        destination_type: normalizeCollectorDestinationType(document.destination_type),
        sheet_link: String(document.sheet_link || '').trim(),
        webhook_url: String(document.webhook_url || '').trim(),
        destination_id: String(document.destination_id || '').trim(),
        destination_json: destinationJson,
        verified: destinationJson.verified === true,
        verified_at: destinationJson.verified_at || null,
        service_account_email: String(
            destinationJson.service_account_email || getCollectorDestinationDefaults().service_account_email || ''
        ).trim()
    };
};

const loadCollectorDestinationDocument = async (databases, automation) => {
    try {
        const collectionInfo = await getCollectionAttributeInfo(databases, AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID);
        const queries = [Query.limit(1)];
        if (collectionInfo.keys.has('automation_id')) {
            queries.unshift(Query.equal('automation_id', String(automation?.$id || '').trim()));
        }
        if (collectionInfo.keys.has('account_id')) {
            queries.unshift(Query.equal('account_id', String(automation?.account_id || '').trim()));
        }
        if (collectionInfo.keys.has('user_id')) {
            queries.unshift(Query.equal('user_id', String(automation?.user_id || '').trim()));
        }

        const result = await retryAppwriteOperation(() => databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID,
            queries
        ));
        return result.documents?.[0] || null;
    } catch (error) {
        if (isMissingCollectionError(error)) {
            return null;
        }
        throw error;
    }
};

const getOwnedAutomationDocument = async (databases, userId, automationId) => {
    const automation = await databases.getDocument(
        process.env.APPWRITE_DATABASE_ID,
        AUTOMATIONS_COLLECTION_ID,
        automationId
    );
    if (automation.user_id !== userId) {
        const error = new Error('Unauthorized');
        error.statusCode = 403;
        throw error;
    }
    return automation;
};

const buildCollectorVerifySamplePayload = (automation) => ({
    event: 'automation_email_collector.verify',
    sample: true,
    automation_id: String(automation?.$id || '').trim(),
    automation_title: String(automation?.title || '').trim(),
    automation_type: String(automation?.automation_type || 'dm').trim() || 'dm',
    account_id: String(automation?.account_id || '').trim(),
    sender_id: 'sample_sender',
    sender_profile_url: 'https://www.instagram.com/sample_sender/',
    receiver_name: String(automation?.receiver_name || '').trim(),
    email: 'sample@gmail.com',
    normalized_email: 'sample@gmail.com',
    received_at: new Date().toISOString()
});

const persistCollectorDestinationDocument = async (databases, automation, payload, existingDocument = null) => {
    const collectionInfo = await getCollectionAttributeInfo(databases, AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID);
    const sanitizedPayload = sanitizePayloadForCollection(payload, collectionInfo);

    if (existingDocument?.$id) {
        return databases.updateDocument(
            process.env.APPWRITE_DATABASE_ID,
            AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID,
            existingDocument.$id,
            sanitizedPayload
        );
    }

    return databases.createDocument(
        process.env.APPWRITE_DATABASE_ID,
        AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID,
        ID.unique(),
        sanitizedPayload,
        [Permission.read(Role.user(String(automation?.user_id || '').trim()))]
    );
};

const ensureLiveAutomationCapacity = async (databases, {
    userId,
    accountId,
    automationType,
    triggerType,
    excludeId = null
}) => {
    if (String(automationType || '').trim().toLowerCase() !== 'live') {
        return null;
    }

    const result = await databases.listDocuments(
        process.env.APPWRITE_DATABASE_ID,
        AUTOMATIONS_COLLECTION_ID,
        [
            Query.equal('user_id', String(userId)),
            Query.equal('account_id', String(accountId)),
            Query.equal('automation_type', 'live'),
            Query.limit(100)
        ]
    );

    const documents = (result.documents || []).filter((doc) => doc.$id !== excludeId);
    const normalizedTriggerType = String(triggerType || 'keywords').trim().toLowerCase();
    const allCommentsCount = documents.filter((doc) => String(doc?.trigger_type || 'keywords').trim().toLowerCase() === 'all_comments').length;
    const keywordCount = documents.filter((doc) => String(doc?.trigger_type || 'keywords').trim().toLowerCase() !== 'all_comments').length;

    if (normalizedTriggerType === 'all_comments' && allCommentsCount >= 1) {
        return 'Only one live all-comments automation can be active per account.';
    }

    if (normalizedTriggerType !== 'all_comments' && keywordCount >= 5) {
        return 'Only five live keyword automations are allowed per account.';
    }

    return null;
};

const getCollectionAttributeInfo = async (databases, collectionId) => {
    if (collectionAttributeCache.has(collectionId)) return collectionAttributeCache.get(collectionId);
    const res = await databases.listAttributes(
        process.env.APPWRITE_DATABASE_ID,
        collectionId,
        [Query.limit(100)]
    );
    const attributes = Array.isArray(res?.attributes) ? res.attributes : [];
    const keys = new Set(attributes.map((attr) => attr.key));
    const required = new Set(
        attributes
            .filter((attr) => attr.required)
            .map((attr) => attr.key)
    );
    const info = { keys, required };
    collectionAttributeCache.set(collectionId, info);
    return info;
};

const sanitizePayloadForCollection = (payload, info) => {
    const out = {};
    for (const [key, value] of Object.entries(payload || {})) {
        if (info.keys.has(key) && value !== undefined) out[key] = value;
    }
    return out;
};

const extractUnknownAttributeName = (error) => {
    const message = String(error?.message || '');
    const match = message.match(/Unknown attribute:\s*"([^"]+)"/i);
    return match?.[1] ? String(match[1]).trim() : '';
};

const createDocumentWithUnknownAttributeRetry = async ({
    databases,
    databaseId,
    collectionId,
    documentId,
    payload,
    permissions
}) => {
    const nextPayload = { ...(payload || {}) };
    const removedAttributes = new Set();

    while (true) {
        try {
            return await databases.createDocument(
                databaseId,
                collectionId,
                documentId,
                nextPayload,
                permissions
            );
        } catch (error) {
            const unknownAttribute = extractUnknownAttributeName(error);
            if (!unknownAttribute || removedAttributes.has(unknownAttribute) || !(unknownAttribute in nextPayload)) {
                throw error;
            }
            delete nextPayload[unknownAttribute];
            removedAttributes.add(unknownAttribute);
            console.warn(`Retrying create without unsupported attribute "${unknownAttribute}" on ${collectionId}`);
        }
    }
};

const listAllDocuments = async (databases, collectionId, queries) => {
    const docs = [];
    let cursor = null;
    while (true) {
        const pageQueries = [...queries, Query.orderAsc('$id'), Query.limit(100)];
        if (cursor) pageQueries.push(Query.cursorAfter(cursor));
        const page = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, collectionId, pageQueries);
        docs.push(...page.documents);
        if (page.documents.length < 100) break;
        cursor = page.documents[page.documents.length - 1].$id;
    }
    return docs;
};

const getIgProfessionalAccountId = (account) =>
    String(account?.ig_user_id || account?.account_id || '');

const isOwnedIgAccount = (account, appUserId) =>
    account?.user_id === appUserId;

const matchesIgAccountIdentifier = (account, identifier) => {
    const id = String(identifier || '');
    if (!id) return false;
    return account?.$id === id
        || getIgProfessionalAccountId(account) === id
        || String(account?.ig_user_id || '') === id
        || String(account?.account_id || '') === id;
};

const listOwnedIgAccounts = async (databases, appUserId, extraQueries = []) => {
    const databaseId = process.env.APPWRITE_DATABASE_ID;
    return retryAppwriteOperation(() => databases.listDocuments(
        databaseId,
        IG_ACCOUNTS_COLLECTION_ID,
        [Query.equal('user_id', appUserId), ...extraQueries]
    ));
};

const serializeIgAccount = (account) => {
    const access = normalizeAccountAccess(account);
    return {
        id: account.$id,
        ig_user_id: getIgProfessionalAccountId(account),
        username: account.username,
        name: account.name || '',
        profile_picture_url: account.profile_picture_url,
        status: account.status || 'active',
        linked_at: account.linked_at,
        token_expires_at: account.token_expires_at,
        admin_disabled: access.admin_disabled,
        plan_locked: access.plan_locked,
        access_override_enabled: access.access_override_enabled,
        effective_access: access.effective_access,
        access_state: access.access_state,
        access_reason: access.access_reason
    };
};

const fetchInstagramProfileSnapshot = async (accessToken) => {
    const response = await axios.get('https://graph.instagram.com/v24.0/me', {
        params: {
            fields: 'user_id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website',
            access_token: accessToken
        }
    });
    return response.data || {};
};

const ACCOUNT_INSIGHT_DEFINITIONS = [
    { key: 'reach', label: 'Reach', supportsPeriod: true },
    { key: 'views', label: 'Views', supportsPeriod: true },
    { key: 'accounts_engaged', label: 'Accounts Engaged', supportsPeriod: true },
    { key: 'profile_links_taps', label: 'Profile Link Taps', supportsPeriod: true },
    { key: 'follower_count', label: 'Followers', supportsPeriod: false },
    { key: 'online_followers', label: 'Online Followers', supportsPeriod: false, audience: true }
];

const MEDIA_INSIGHT_DEFINITIONS = [
    { key: 'likes', label: 'Likes' },
    { key: 'comments', label: 'Comments' },
    { key: 'saved', label: 'Saved' },
    { key: 'shares', label: 'Shares' },
    { key: 'reach', label: 'Reach' },
    { key: 'views', label: 'Views' },
    { key: 'total_interactions', label: 'Total Interactions' },
    { key: 'replies', label: 'Replies' },
    { key: 'follows', label: 'Follows' },
    { key: 'profile_visits', label: 'Profile Visits' },
    { key: 'navigation', label: 'Navigation' }
];

const SUPPORTED_ACCOUNT_PERIODS = new Set(['day', 'week', 'days_28']);

const normalizeInsightsPeriod = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return SUPPORTED_ACCOUNT_PERIODS.has(normalized) ? normalized : 'days_28';
};

const coerceNumericInsightValue = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
    return null;
};

const buildInsightSeries = (values) => {
    const entries = Array.isArray(values) ? values : [];
    return entries
        .map((entry) => ({
            end_time: entry?.end_time || null,
            value: coerceNumericInsightValue(entry?.value)
        }))
        .filter((entry) => entry.value != null);
};

const fetchInstagramInsightMetric = async ({
    path = '/me',
    metric,
    accessToken,
    period = null
}) => {
    const response = await axios.get(`https://graph.instagram.com/v24.0${path}/insights`, {
        params: {
            metric,
            ...(period ? { period } : {}),
            access_token: accessToken
        }
    });
    return response.data?.data?.[0] || null;
};

const fetchRecentInstagramMedia = async (accessToken, limit = 8) => {
    const response = await axios.get('https://graph.instagram.com/v24.0/me/media', {
        params: {
            fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp',
            access_token: accessToken,
            limit: Math.max(1, Math.min(limit, 12))
        }
    });
    return Array.isArray(response.data?.data) ? response.data.data : [];
};

const fetchRichInstagramInsights = async ({
    accessToken,
    period = 'days_28'
}) => {
    const normalizedPeriod = normalizeInsightsPeriod(period);
    const profileSnapshot = await fetchInstagramProfileSnapshot(accessToken);
    const unsupported_metrics = [];
    const account_metrics = {};
    const account_timeseries = {};
    const audience = {};

    for (const definition of ACCOUNT_INSIGHT_DEFINITIONS) {
        try {
            const rawMetric = await fetchInstagramInsightMetric({
                metric: definition.key,
                period: definition.supportsPeriod ? normalizedPeriod : 'day',
                accessToken
            });
            if (!rawMetric) {
                unsupported_metrics.push(definition.key);
                continue;
            }
            const rawValues = Array.isArray(rawMetric.values) ? rawMetric.values : [];
            const numericSeries = buildInsightSeries(rawValues);
            const rawLatest = rawValues[0]?.value;
            const latestValue = coerceNumericInsightValue(rawLatest);

            if (definition.audience && rawLatest && typeof rawLatest === 'object') {
                audience[definition.key] = rawLatest;
            } else if (latestValue != null) {
                account_metrics[definition.key] = {
                    label: definition.label,
                    value: latestValue,
                    period: definition.supportsPeriod ? normalizedPeriod : 'day'
                };
            }

            if (numericSeries.length > 0) {
                account_timeseries[definition.key] = {
                    label: definition.label,
                    series: numericSeries,
                    period: definition.supportsPeriod ? normalizedPeriod : 'day'
                };
            }
        } catch (_) {
            unsupported_metrics.push(definition.key);
        }
    }

    const recentMedia = await fetchRecentInstagramMedia(accessToken, 8).catch(() => []);
    const media_items = await Promise.all(recentMedia.slice(0, 6).map(async (item) => {
        const metrics = {};
        const mediaUnsupportedMetrics = [];

        if (String(item?.media_type || '').toUpperCase() === 'CAROUSEL_ALBUM') {
            return {
                ...item,
                metrics,
                unsupported_metrics: MEDIA_INSIGHT_DEFINITIONS.map((entry) => entry.key),
                score: 0
            };
        }

        for (const definition of MEDIA_INSIGHT_DEFINITIONS) {
            try {
                const rawMetric = await fetchInstagramInsightMetric({
                    path: `/${item.id}`,
                    metric: definition.key,
                    accessToken
                });
                const rawValue = rawMetric?.values?.[0]?.value;
                const value = coerceNumericInsightValue(rawValue);
                if (value == null) {
                    mediaUnsupportedMetrics.push(definition.key);
                    continue;
                }
                metrics[definition.key] = {
                    label: definition.label,
                    value
                };
            } catch (_) {
                mediaUnsupportedMetrics.push(definition.key);
            }
        }

        const score = Number(
            metrics.total_interactions?.value
            || metrics.views?.value
            || metrics.reach?.value
            || 0
        );

        return {
            ...item,
            metrics,
            unsupported_metrics: mediaUnsupportedMetrics,
            score
        };
    }));

    media_items.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

    return {
        period: normalizedPeriod,
        summary: {
            followers: Number(profileSnapshot.followers_count || 0),
            following: Number(profileSnapshot.follows_count || 0),
            media_count: Number(profileSnapshot.media_count || 0),
            username: profileSnapshot.username || '',
            name: profileSnapshot.name || '',
            biography: profileSnapshot.biography || '',
            website: profileSnapshot.website || '',
            profile_picture_url: profileSnapshot.profile_picture_url || ''
        },
        account_metrics,
        account_timeseries,
        audience,
        media_items,
        unsupported_metrics
    };
};

const fetchInstagramAccountInsights = async ({ accessToken, period = 'day' }) => {
    const candidateMetrics = ['reach', 'views', 'accounts_engaged', 'profile_links_taps', 'follower_count'];
    const insights = {};

    for (const metric of candidateMetrics) {
        try {
            const response = await axios.get('https://graph.instagram.com/v24.0/me/insights', {
                params: {
                    metric,
                    period: normalizeInsightsPeriod(period),
                    access_token: accessToken
                }
            });
            insights[metric] = response.data?.data?.[0] || null;
        } catch (_) {
            insights[metric] = null;
        }
    }

    return insights;
};

const migrateLegacyReplyTemplatesForAccount = (databases, userId, targetAccountId) => {
    setImmediate(async () => {
        try {
            const legacyTemplates = await databases.listDocuments(
                process.env.APPWRITE_DATABASE_ID,
                REPLY_TEMPLATES_COLLECTION_ID,
                [Query.equal('user_id', String(userId)), Query.limit(100)]
            );

            const legacyWithoutAccount = legacyTemplates.documents.filter((doc) => !doc.account_id);
            if (legacyWithoutAccount.length === 0) return;

            await Promise.allSettled(
                legacyWithoutAccount.map((doc) => databases.updateDocument(
                    process.env.APPWRITE_DATABASE_ID,
                    REPLY_TEMPLATES_COLLECTION_ID,
                    doc.$id,
                    { account_id: String(targetAccountId) }
                ))
            );
        } catch (error) {
            console.warn(`Reply template legacy migration skipped: ${error.message}`);
        }
    });
};

const resolveReplyTemplateAccount = async (databases, userId, templateDoc, requestedAccountId) => {
    const accounts = await listOwnedIgAccounts(databases, userId);
    const requestedAccount = requestedAccountId
        ? accounts.documents.find((account) => matchesIgAccountIdentifier(account, requestedAccountId))
        : null;

    if (requestedAccountId && !requestedAccount) {
        return { status: 404, error: 'Account not found' };
    }

    let resolvedAccountId = String(templateDoc.account_id || '').trim();
    const storedAccount = resolvedAccountId
        ? accounts.documents.find((account) => matchesIgAccountIdentifier(account, resolvedAccountId))
        : null;

    let shouldPersist = false;
    if (!resolvedAccountId) {
        const fallbackAccount = requestedAccount || accounts.documents[0];
        if (!fallbackAccount) {
            return { status: 400, error: 'account_id is required' };
        }
        resolvedAccountId = getIgProfessionalAccountId(fallbackAccount);
        shouldPersist = true;
    } else if (!storedAccount) {
        const fallbackAccount = requestedAccount || accounts.documents[0];
        if (!fallbackAccount) {
            return { status: 403, error: 'Unauthorized' };
        }
        resolvedAccountId = getIgProfessionalAccountId(fallbackAccount);
        shouldPersist = true;
    }

    if (requestedAccount && getIgProfessionalAccountId(requestedAccount) !== resolvedAccountId) {
        return { status: 403, error: 'Unauthorized' };
    }

    if (shouldPersist && templateDoc.$id) {
        try {
            await databases.updateDocument(
                process.env.APPWRITE_DATABASE_ID,
                REPLY_TEMPLATES_COLLECTION_ID,
                templateDoc.$id,
                { account_id: resolvedAccountId }
            );
        } catch (error) {
            console.warn(`Reply template account sync skipped for ${templateDoc.$id}: ${error.message}`);
        }
    }

    templateDoc.account_id = resolvedAccountId;
    return { accountId: resolvedAccountId, accounts };
};

const ensureKeywordConstraints = async (databases, { accountId, automationId, automationType, keywords }) => {
    for (const keywordNormalized of keywords) {
        if (automationType === 'global') {
            const matches = await databases.listDocuments(
                process.env.APPWRITE_DATABASE_ID,
                KEYWORDS_COLLECTION_ID,
                [
                    Query.equal('account_id', accountId),
                    Query.equal('keyword_normalized', keywordNormalized),
                    Query.limit(5)
                ]
            );
            const conflict = matches.documents.find(doc => doc.automation_id !== automationId);
            if (conflict) {
                return `Keyword "${keywordNormalized}" is already used in another automation.`;
            }
        } else {
            const [typeMatches, globalMatches] = await Promise.all([
                databases.listDocuments(
                    process.env.APPWRITE_DATABASE_ID,
                    KEYWORDS_COLLECTION_ID,
                    [
                        Query.equal('account_id', accountId),
                        Query.equal('automation_type', automationType),
                        Query.equal('keyword_normalized', keywordNormalized),
                        Query.limit(5)
                    ]
                ),
                databases.listDocuments(
                    process.env.APPWRITE_DATABASE_ID,
                    KEYWORDS_COLLECTION_ID,
                    [
                        Query.equal('account_id', accountId),
                        Query.equal('automation_type', 'global'),
                        Query.equal('keyword_normalized', keywordNormalized),
                        Query.limit(5)
                    ]
                )
            ]);

            const combined = [...typeMatches.documents, ...globalMatches.documents];
            const conflict = combined.find(doc => doc.automation_id !== automationId);
            if (conflict) {
                return `Keyword "${keywordNormalized}" is already used in another automation.`;
            }
        }
    }
    return null;
};

const findKeywordConflicts = async (databases, { accountId, automationId, keywords }) => {
    const conflicts = [];
    const normalizedAccountId = String(accountId || '').trim();
    if (!normalizedAccountId) return conflicts;

    for (const keywordNormalized of (Array.isArray(keywords) ? keywords : []).map((value) => normalizeKeywordToken(value)).filter(Boolean)) {
        const matches = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            KEYWORDS_COLLECTION_ID,
            [
                Query.equal('account_id', normalizedAccountId),
                Query.equal('keyword_normalized', keywordNormalized),
                Query.limit(25)
            ]
        );

        const conflict = (matches.documents || []).find((doc) => {
            const docAutomationType = String(doc?.automation_type || '').trim().toLowerCase();
            if (!KEYWORD_TYPES.has(docAutomationType)) return false;
            return String(doc?.automation_id || '').trim() !== String(automationId || '').trim();
        });

        if (conflict) conflicts.push(keywordNormalized);
    }

    return Array.from(new Set(conflicts));
};

const extractModerationKeywordsFromRules = (rules) => {
    const keywords = new Set();
    (Array.isArray(rules) ? rules : []).forEach((rule) => {
        const list = Array.isArray(rule?.keywords) ? rule.keywords : [];
        list.forEach((keyword) => {
            const normalized = normalizeKeywordToken(keyword);
            if (normalized) keywords.add(normalized);
        });
    });
    return Array.from(keywords);
};

const listCommentModerationDocuments = async (databases, { userId, accountIds }) => {
    const docs = [];
    const uniqueAccountIds = Array.from(new Set((accountIds || []).map((value) => String(value || '').trim()).filter(Boolean)));

    for (const accountId of uniqueAccountIds) {
        const result = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            COMMENT_MODERATION_COLLECTION_ID,
            [Query.equal('user_id', userId), Query.equal('account_id', accountId), Query.limit(10)]
        );
        docs.push(...(result.documents || []));
    }

    return docs;
};

const buildCommentModerationRulesFromKeywordDocuments = (documents) => {
    const rulesByAction = {
        hide: new Set(),
        delete: new Set()
    };

    (Array.isArray(documents) ? documents : []).forEach((doc) => {
        const automationType = String(doc?.automation_type || '').trim().toLowerCase();
        const action = automationType === COMMENT_MODERATION_AUTOMATION_TYPES.delete
            ? 'delete'
            : automationType === COMMENT_MODERATION_AUTOMATION_TYPES.hide
                ? 'hide'
                : null;
        if (!action) return;

        const keyword = normalizeKeywordToken(doc?.keyword_normalized || doc?.keyword);
        if (keyword) {
            rulesByAction[action].add(keyword);
        }
    });

    return ['hide', 'delete']
        .map((action) => ({
            action,
            keywords: Array.from(rulesByAction[action])
        }))
        .filter((rule) => rule.keywords.length > 0);
};

const listCommentModerationKeywordDocuments = async (databases, { accountId }) => (
    listAllDocuments(databases, KEYWORDS_COLLECTION_ID, [
        Query.equal('account_id', String(accountId)),
        Query.equal('automation_type', Object.values(COMMENT_MODERATION_AUTOMATION_TYPES))
    ])
);

const findModerationKeywordConflicts = async (databases, { userId, accountIds, keywords }) => {
    const moderationDocs = await listCommentModerationDocuments(databases, { userId, accountIds });
    const moderationKeywords = new Set();
    const uniqueAccountIds = Array.from(new Set((accountIds || []).map((value) => String(value || '').trim()).filter(Boolean)));

    moderationDocs.forEach((doc) => {
        const rules = parseMaybeJson(doc.rules, []);
        extractModerationKeywordsFromRules(rules).forEach((keyword) => moderationKeywords.add(keyword));
    });

    for (const accountId of uniqueAccountIds) {
        const keywordDocs = await listCommentModerationKeywordDocuments(databases, { accountId });
        buildCommentModerationRulesFromKeywordDocuments(keywordDocs)
            .forEach((rule) => rule.keywords.forEach((keyword) => moderationKeywords.add(keyword)));
    }

    return Array.from(new Set(
        (keywords || [])
            .map((keyword) => normalizeKeywordToken(keyword))
            .filter((keyword) => moderationKeywords.has(keyword))
    ));
};

const findAutomationKeywordConflictsForModeration = async (databases, { accountId, keywords }) => {
    const conflicts = [];

    for (const keyword of (keywords || []).map((value) => normalizeKeywordToken(value)).filter(Boolean)) {
        const result = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            KEYWORDS_COLLECTION_ID,
            [
                Query.equal('account_id', String(accountId)),
                Query.equal('keyword_normalized', keyword),
                Query.limit(5)
            ]
        );
        const conflict = (result.documents || []).find((doc) => !Object.values(COMMENT_MODERATION_AUTOMATION_TYPES)
            .includes(String(doc?.automation_type || '').trim().toLowerCase()));
        if (conflict) conflicts.push(keyword);
    }

    return Array.from(new Set(conflicts));
};

const syncCommentModerationKeywordRecords = async (databases, { accountId, rules }) => {
    const normalizedRules = (Array.isArray(rules) ? rules : [])
        .map((rule) => ({
            action: rule?.action === 'delete' ? 'delete' : 'hide',
            keywords: Array.from(new Set(
                (Array.isArray(rule?.keywords) ? rule.keywords : [])
                    .map((keyword) => normalizeKeywordToken(keyword))
                    .filter(Boolean)
            ))
        }))
        .filter((rule) => rule.keywords.length > 0);

    const deleteExisting = async (collectionId) => {
        const existing = await listAllDocuments(databases, collectionId, [
            Query.equal('account_id', String(accountId)),
            Query.equal('automation_type', Object.values(COMMENT_MODERATION_AUTOMATION_TYPES))
        ]);

        for (const doc of existing) {
            await databases.deleteDocument(process.env.APPWRITE_DATABASE_ID, collectionId, doc.$id);
        }
    };

    await deleteExisting(KEYWORDS_COLLECTION_ID);
    await deleteExisting(KEYWORD_INDEX_COLLECTION_ID);

    if (normalizedRules.length === 0) return;

    const keywordCollectionInfo = await getCollectionAttributeInfo(databases, KEYWORDS_COLLECTION_ID);
    const keywordIndexCollectionInfo = await getCollectionAttributeInfo(databases, KEYWORD_INDEX_COLLECTION_ID);

    for (const rule of normalizedRules) {
        const automationType = COMMENT_MODERATION_AUTOMATION_TYPES[rule.action];
        const automationId = `comment_moderation_${rule.action}:${accountId}`;

        for (const keywordNormalized of rule.keywords) {
            const keywordSafe = String(keywordNormalized || '').slice(0, 255);
            const keywordHash = computeKeywordHash(keywordNormalized);

            const keywordPayload = {
                automation_id: automationId,
                account_id: String(accountId),
                automation_type: automationType,
                type: automationType,
                keyword: keywordSafe,
                keyword_normalized: keywordSafe,
                keyword_hash: keywordHash,
                match_type: 'exact',
                is_active: true
            };
            if (keywordCollectionInfo.required.has('keywords')) {
                keywordPayload.keywords = JSON.stringify([keywordSafe]);
            }

            await databases.createDocument(
                process.env.APPWRITE_DATABASE_ID,
                KEYWORDS_COLLECTION_ID,
                ID.unique(),
                sanitizePayloadForCollection(keywordPayload, keywordCollectionInfo)
            );

            const keywordIndexPayload = {
                account_id: String(accountId),
                automation_id: automationId,
                automation_type: automationType,
                keyword_hash: keywordHash,
                keyword: keywordSafe,
                keyword_normalized: keywordSafe,
                type: automationType,
                match_type: 'exact',
                is_active: true
            };
            if (keywordIndexCollectionInfo.required.has('keywords')) {
                keywordIndexPayload.keywords = JSON.stringify([keywordSafe]);
            }

            await databases.createDocument(
                process.env.APPWRITE_DATABASE_ID,
                KEYWORD_INDEX_COLLECTION_ID,
                ID.unique(),
                sanitizePayloadForCollection(keywordIndexPayload, keywordIndexCollectionInfo)
            );
        }
    }
};

const syncKeywordRecords = async (databases, { accountId, automationId, automationType, keywords, matchType }) => {
    try {
        const isDuplicateDocError = (err) => {
            const msg = String(err?.message || '').toLowerCase();
            return msg.includes('already exists') || msg.includes('document with the requested id already exists') || err?.code === 409;
        };

        const normalizedKeywords = (keywords || [])
            .map(k => normalizeKeywordToken(k))
            .filter(Boolean);

        const deleteExisting = async (collectionId) => {
            const existing = await listAllDocuments(databases, collectionId, [
                Query.equal('automation_id', automationId)
            ]);
            for (const doc of existing) {
                await databases.deleteDocument(process.env.APPWRITE_DATABASE_ID, collectionId, doc.$id);
            }
        };

        await deleteExisting(KEYWORDS_COLLECTION_ID);
        await deleteExisting(KEYWORD_INDEX_COLLECTION_ID);

        if (!normalizedKeywords || normalizedKeywords.length === 0) return;

        const keywordCollectionInfo = await getCollectionAttributeInfo(databases, KEYWORDS_COLLECTION_ID);
        const keywordIndexCollectionInfo = await getCollectionAttributeInfo(databases, KEYWORD_INDEX_COLLECTION_ID);

        for (const keywordNormalized of normalizedKeywords) {
            const keywordValue = String(keywordNormalized || '').trim();
            if (!keywordValue) continue;
            const keywordSafe = keywordValue.slice(0, 255);
            const keywordHash = computeKeywordHash(keywordNormalized);

            const keywordPayload = {
                automation_id: automationId,
                account_id: accountId,
                automation_type: automationType,
                type: automationType,
                keyword: keywordSafe,
                keyword_normalized: keywordSafe,
                keyword_hash: keywordHash,
                match_type: matchType || 'exact',
                is_active: true,
            };
            // Backward compatibility for legacy schemas that may still require "keywords".
            if (keywordCollectionInfo.required.has('keywords')) {
                keywordPayload.keywords = JSON.stringify([keywordSafe]);
            }

            try {
                await databases.createDocument(
                    process.env.APPWRITE_DATABASE_ID,
                    KEYWORDS_COLLECTION_ID,
                    ID.unique(),
                    sanitizePayloadForCollection(keywordPayload, keywordCollectionInfo)
                );
            } catch (err) {
                if (isDuplicateDocError(err)) {
                    throw new Error(`Keyword "${keywordSafe}" is already used in another automation.`);
                }
                throw err;
            }

            const keywordIndexPayload = {
                account_id: accountId,
                keyword_hash: keywordHash,
                automation_id: automationId,
                automation_type: automationType,
                // Backward compatibility in case keyword_index carries legacy keyword fields.
                keyword: keywordSafe,
                keyword_normalized: keywordSafe,
                type: automationType,
                match_type: matchType || 'exact',
                is_active: true,
            };
            if (keywordIndexCollectionInfo.required.has('keywords')) {
                keywordIndexPayload.keywords = JSON.stringify([keywordSafe]);
            }
            try {
                await databases.createDocument(
                    process.env.APPWRITE_DATABASE_ID,
                    KEYWORD_INDEX_COLLECTION_ID,
                    ID.unique(),
                    sanitizePayloadForCollection(keywordIndexPayload, keywordIndexCollectionInfo)
                );
            } catch (err) {
                if (isDuplicateDocError(err)) {
                    throw new Error(`Keyword "${keywordSafe}" is already indexed for another automation.`);
                }
                throw err;
            }
        }
    } catch (err) {
        throw new Error(err?.message || 'Failed to sync keywords');
    }
};

const validateAutomationPayload = (automation) => {
    const errors = [];
    const title = String(automation.title || '').trim();
    if (byteLen(title) < AUTOMATION_TITLE_MIN || byteLen(title) > AUTOMATION_TITLE_MAX) {
        errors.push(`title must be ${AUTOMATION_TITLE_MIN}-${AUTOMATION_TITLE_MAX} UTF-8 bytes`);
    }

    const templateType = automation.template_type;
    if (!templateType || !VALID_TEMPLATE_TYPES.has(templateType)) {
        errors.push('template_type is invalid or missing');
        return errors;
    }
    const hasTemplateReference = !!String(automation.template_id || '').trim();
    if (hasTemplateReference) {
        return errors;
    }

    const templateContent = String(automation.template_content || '');
    const buttons = parseMaybeJson(automation.buttons, []);
    const replies = parseMaybeJson(automation.replies, []);
    const elements = parseMaybeJson(automation.template_elements, []);
    const mediaUrl = String(automation.media_url || '');
    const mediaId = String(automation.media_id || '');

    if (templateType === 'template_text') {
        const len = byteLen(templateContent);
        if (len < TEXT_MIN || len > TEXT_MAX) errors.push(`template_content must be ${TEXT_MIN}-${TEXT_MAX} UTF-8 bytes`);
    }

    if (templateType === 'template_buttons') {
        const len = byteLen(templateContent);
        if (len < TEXT_MIN || len > BUTTON_TEXT_MAX) errors.push(`template_content must be ${TEXT_MIN}-${BUTTON_TEXT_MAX} UTF-8 bytes`);
        if (!Array.isArray(buttons) || buttons.length === 0 || buttons.length > BUTTONS_MAX) {
            errors.push(`buttons must have 1-${BUTTONS_MAX} items`);
        } else {
            buttons.forEach((btn, i) => {
                const t = String(btn?.title || '');
                const tl = byteLen(t);
                if (tl < BUTTON_TITLE_MIN || tl > BUTTON_TITLE_MAX) errors.push(`buttons[${i}].title must be ${BUTTON_TITLE_MIN}-${BUTTON_TITLE_MAX} UTF-8 bytes`);
                if (!btn?.url || byteLen(btn.url) > MEDIA_URL_MAX) errors.push(`buttons[${i}].url is required and must be <= ${MEDIA_URL_MAX} UTF-8 bytes`);
            });
        }
    }

    if (templateType === 'template_quick_replies') {
        const len = byteLen(templateContent);
        if (len < TEXT_MIN || len > QUICK_REPLIES_TEXT_MAX) errors.push(`template_content must be ${TEXT_MIN}-${QUICK_REPLIES_TEXT_MAX} UTF-8 bytes`);
        if (!Array.isArray(replies) || replies.length === 0 || replies.length > QUICK_REPLIES_MAX) {
            errors.push(`replies must have 1-${QUICK_REPLIES_MAX} items`);
        } else {
            replies.forEach((r, i) => {
                const t = String(r?.title || '');
                const tl = byteLen(t);
                if (tl < QUICK_REPLY_TITLE_MIN || tl > QUICK_REPLY_TITLE_MAX) errors.push(`replies[${i}].title must be ${QUICK_REPLY_TITLE_MIN}-${QUICK_REPLY_TITLE_MAX} UTF-8 bytes`);
                const p = String(r?.payload || '');
                const pl = byteLen(p);
                if (pl < QUICK_REPLY_PAYLOAD_MIN || pl > QUICK_REPLY_PAYLOAD_MAX) errors.push(`replies[${i}].payload must be ${QUICK_REPLY_PAYLOAD_MIN}-${QUICK_REPLY_PAYLOAD_MAX} UTF-8 bytes`);
            });
        }
    }

    if (templateType === 'template_media') {
        const ml = byteLen(mediaUrl);
        if (ml < 1 || ml > MEDIA_URL_MAX) errors.push(`media_url is required and must be <= ${MEDIA_URL_MAX} UTF-8 bytes`);
        if (Array.isArray(buttons) && buttons.length > 0) {
            if (buttons.length > BUTTONS_MAX) errors.push(`buttons must have <= ${BUTTONS_MAX} items`);
            buttons.forEach((btn, i) => {
                const t = String(btn?.title || '');
                const tl = byteLen(t);
                if (tl < BUTTON_TITLE_MIN || tl > BUTTON_TITLE_MAX) errors.push(`buttons[${i}].title must be ${BUTTON_TITLE_MIN}-${BUTTON_TITLE_MAX} UTF-8 bytes`);
                if (!btn?.url || byteLen(btn.url) > MEDIA_URL_MAX) errors.push(`buttons[${i}].url is required and must be <= ${MEDIA_URL_MAX} UTF-8 bytes`);
            });
        }
    }

    if (templateType === 'template_carousel') {
        if (!Array.isArray(elements) || elements.length === 0 || elements.length > CAROUSEL_ELEMENTS_MAX) {
            errors.push(`template_elements must have 1-${CAROUSEL_ELEMENTS_MAX} items`);
        } else {
            elements.forEach((el, i) => {
                const t = String(el?.title || '');
                const tl = byteLen(t);
                if (tl < CAROUSEL_TITLE_MIN || tl > CAROUSEL_TITLE_MAX) errors.push(`template_elements[${i}].title must be ${CAROUSEL_TITLE_MIN}-${CAROUSEL_TITLE_MAX} UTF-8 bytes`);
                const st = String(el?.subtitle || '');
                if (st && byteLen(st) > CAROUSEL_SUBTITLE_MAX) errors.push(`template_elements[${i}].subtitle must be <= ${CAROUSEL_SUBTITLE_MAX} UTF-8 bytes`);
                const img = String(el?.image_url || '');
                if (!img || byteLen(img) > MEDIA_URL_MAX) errors.push(`template_elements[${i}].image_url is required and must be <= ${MEDIA_URL_MAX} UTF-8 bytes`);
                if (Array.isArray(el?.buttons) && el.buttons.length > 0) {
                    el.buttons.forEach((b, bi) => {
                        const bt = String(b?.title || '');
                        const btl = byteLen(bt);
                        if (btl < CAROUSEL_BUTTON_TITLE_MIN || btl > CAROUSEL_BUTTON_TITLE_MAX) errors.push(`template_elements[${i}].buttons[${bi}].title must be ${CAROUSEL_BUTTON_TITLE_MIN}-${CAROUSEL_BUTTON_TITLE_MAX} UTF-8 bytes`);
                        if (!b?.url || byteLen(b.url) > MEDIA_URL_MAX) errors.push(`template_elements[${i}].buttons[${bi}].url is required and must be <= ${MEDIA_URL_MAX} UTF-8 bytes`);
                    });
                }
            });
        }
    }

    if (templateType === 'template_share_post') {
        if (!automation.use_latest_post && !mediaId) {
            errors.push('media_id is required unless use_latest_post is true');
        }
    }

    if (templateType === 'template_url') {
        if (!templateContent || byteLen(templateContent) > MEDIA_URL_MAX) {
            errors.push(`template_content is required and must be <= ${MEDIA_URL_MAX} UTF-8 bytes`);
        }
    }

    if (templateType === 'template_media_attachment') {
        const urlCandidate = mediaUrl || templateContent;
        if (!urlCandidate || byteLen(urlCandidate) > MEDIA_URL_MAX) {
            errors.push(`media_url or template_content is required and must be <= ${MEDIA_URL_MAX} UTF-8 bytes`);
        }
    }

    const automationType = automation.automation_type || automation.type || 'dm';
    if (KEYWORD_TYPES.has(automationType)) {
        const { keywords } = getKeywordInfo(automation);
        const hasKeyword = Array.isArray(keywords) && keywords.length > 0;
        if ((automationType === 'dm' || automationType === 'global') && !hasKeyword) {
            errors.push('keyword is required for this automation type');
        }
        if (hasKeyword) {
            if (keywords.length > KEYWORD_MAX_PER_AUTOMATION) {
                errors.push(`keywords must be <= ${KEYWORD_MAX_PER_AUTOMATION}`);
            }
        }
    }

    const followersOnly = automation.followers_only === true;
    const followersOnlyMessage = String(automation.followers_only_message || '').trim();
    if (followersOnly && !followersOnlyMessage) {
        errors.push('followers_only_message is required when followers_only is enabled');
    }
    if (followersOnlyMessage && byteLen(followersOnlyMessage) > FOLLOWERS_ONLY_MESSAGE_MAX) {
        errors.push(`followers_only_message must be <= ${FOLLOWERS_ONLY_MESSAGE_MAX} UTF-8 bytes`);
    }

    const followersPrimaryButtonText = String(automation.followers_only_primary_button_text || '').trim();
    const followersSecondaryButtonText = String(automation.followers_only_secondary_button_text || '').trim();
    if (followersPrimaryButtonText && byteLen(followersPrimaryButtonText) > BUTTON_TITLE_MAX) {
        errors.push(`followers_only_primary_button_text must be <= ${BUTTON_TITLE_MAX} UTF-8 bytes`);
    }
    if (followersSecondaryButtonText && byteLen(followersSecondaryButtonText) > BUTTON_TITLE_MAX) {
        errors.push(`followers_only_secondary_button_text must be <= ${BUTTON_TITLE_MAX} UTF-8 bytes`);
    }

    const collectEmailPromptMessage = String(automation.collect_email_prompt_message || '').trim();
    const collectEmailFailRetryMessage = String(automation.collect_email_fail_retry_message || '').trim();
    const collectEmailSuccessReplyMessage = String(automation.collect_email_success_reply_message || '').trim();
    if (collectEmailPromptMessage && byteLen(collectEmailPromptMessage) > TEXT_MAX) {
        errors.push(`collect_email_prompt_message must be <= ${TEXT_MAX} UTF-8 bytes`);
    }
    if (collectEmailFailRetryMessage && byteLen(collectEmailFailRetryMessage) > TEXT_MAX) {
        errors.push(`collect_email_fail_retry_message must be <= ${TEXT_MAX} UTF-8 bytes`);
    }
    if (collectEmailSuccessReplyMessage && byteLen(collectEmailSuccessReplyMessage) > TEXT_MAX) {
        errors.push(`collect_email_success_reply_message must be <= ${TEXT_MAX} UTF-8 bytes`);
    }

    return errors;
};

const AUTOMATION_PAGE_LIMIT = 100;

const listAllAutomations = async (databases, queries) => {
    const docs = [];
    let cursor = null;
    while (true) {
        const pageQueries = [
            ...queries,
            Query.orderAsc('$id'),
            Query.limit(AUTOMATION_PAGE_LIMIT)
        ];
        if (cursor) pageQueries.push(Query.cursorAfter(cursor));

        const page = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            AUTOMATIONS_COLLECTION_ID,
            pageQueries
        );

        docs.push(...page.documents);
        if (page.documents.length < AUTOMATION_PAGE_LIMIT) break;
        cursor = page.documents[page.documents.length - 1].$id;
    }
    return docs;
};

const toSafeString = (value, maxLen = null) => {
    if (value === null || value === undefined) return '';
    const out = typeof value === 'string' ? value : String(value);
    if (typeof maxLen === 'number' && maxLen >= 0) return out.slice(0, maxLen);
    return out;
};

const serializeStoredJsonField = (value) => {
    if (value === null || value === undefined || value === '') return null;
    return typeof value === 'string' ? value : JSON.stringify(value);
};

const buildAutomationDocumentData = ({
    userId,
    accountId,
    automationType,
    payload,
    existingDocument = null
}) => {
    const source = existingDocument ? { ...existingDocument, ...payload } : { ...payload };
    const keywordInfo = getKeywordInfo({
        keyword: source.keyword,
        keywords: source.keywords
    });
    const keywordArray = KEYWORD_TYPES.has(automationType) ? keywordInfo.keywords : [];
    const title = toSafeString(source.title, 255);
    const titleNormalized = normalizeTitle(title);
    const followersOnly = source.followers_only === true;

    return {
        keywordArray,
        titleNormalized,
        docData: {
            user_id: existingDocument?.user_id || userId,
            account_id: existingDocument?.account_id || accountId,
            automation_type: automationType,
            title,
            title_normalized: titleNormalized,
            is_active: source.is_active !== undefined ? source.is_active : true,
            keyword: keywordArray.join(','),
            keywords: JSON.stringify(keywordArray),
            keyword_match_type: toSafeString(source.keyword_match_type || 'exact', 50),
            trigger_type: toSafeString(source.trigger_type || 'keywords', 50),
            template_type: toSafeString(source.template_type || 'template_text', 50),
            template_content: toSafeString(source.template_content, 3000),
            template_id: source.template_id ? toSafeString(source.template_id, 255) : null,
            buttons: serializeStoredJsonField(source.buttons),
            template_elements: serializeStoredJsonField(source.template_elements),
            replies: serializeStoredJsonField(source.replies),
            media_url: toSafeString(source.media_url, MEDIA_URL_MAX),
            media_id: source.media_id ? toSafeString(source.media_id, 100) : null,
            use_latest_post: source.use_latest_post === true,
            latest_post_type: toSafeString(source.latest_post_type || 'post', 50),
            followers_only: followersOnly,
            followers_only_message: toSafeString(
                followersOnly
                    ? (source.followers_only_message || FOLLOWERS_ONLY_MESSAGE_DEFAULT)
                    : (source.followers_only_message || ''),
                FOLLOWERS_ONLY_MESSAGE_MAX
            ),
            suggest_more_enabled: source.suggest_more_enabled === true,
            private_reply_enabled: source.private_reply_enabled !== false,
            share_to_admin_enabled: ['post', 'reel'].includes(String(automationType || '').trim().toLowerCase())
                ? source.share_to_admin_enabled === true
                : false,
            once_per_user_24h: source.once_per_user_24h === true,
            story_scope: automationType === 'story' ? 'shown' : toSafeString(source.story_scope || 'shown', 50),
            collect_email_enabled: source.collect_email_enabled === true,
            collect_email_only_gmail: source.collect_email_only_gmail === true,
            followers_only_primary_button_text: toSafeString(
                source.followers_only_primary_button_text || FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT,
                BUTTON_TITLE_MAX
            ),
            followers_only_secondary_button_text: toSafeString(
                source.followers_only_secondary_button_text || FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT,
                BUTTON_TITLE_MAX
            ),
            collect_email_prompt_message: toSafeString(
                source.collect_email_prompt_message || COLLECT_EMAIL_PROMPT_DEFAULT,
                TEXT_MAX
            ),
            collect_email_fail_retry_message: toSafeString(
                source.collect_email_fail_retry_message || COLLECT_EMAIL_FAIL_RETRY_DEFAULT,
                TEXT_MAX
            ),
            collect_email_success_reply_message: toSafeString(
                source.collect_email_success_reply_message || COLLECT_EMAIL_SUCCESS_DEFAULT,
                TEXT_MAX
            ),
            seen_typing_enabled: source.seen_typing_enabled === true,
            exclude_existing_customers: source.exclude_existing_customers === true,
            send_to: toSafeString(source.send_to || 'everyone', 50),
            delay_seconds: Number(source.delay_seconds || 0),
            comment_reply: toSafeString(source.comment_reply ?? source.comment_reply_text, 1000),
            linked_media_id: source.linked_media_id ? toSafeString(source.linked_media_id, 255) : null,
            linked_media_url: toSafeString(source.linked_media_url, MEDIA_URL_MAX),
        }
    };
};

const getTitleScopedAutomationTypes = (automationType) => {
    const normalized = String(automationType || '').toLowerCase();
    if (normalized === 'dm' || normalized === 'global') return ['dm', 'global'];
    return [normalized || 'dm'];
};

const hasDuplicateAutomationTitle = async (databases, { userId, accountId, automationType, titleNormalized, excludeId }) => {
    if (!titleNormalized) return false;
    const scopedTypes = getTitleScopedAutomationTypes(automationType);
    try {
        const queries = [
            Query.equal('user_id', userId),
            Query.equal('account_id', accountId),
            Query.equal('automation_type', scopedTypes),
            Query.equal('title_normalized', titleNormalized),
            Query.limit(5)
        ];
        const result = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, queries);
        const match = result.documents.find(d => d.$id !== excludeId);
        if (match) return true;
    } catch (_) { }

    // Fallback if normalized field not populated yet
    try {
        const fallback = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            AUTOMATIONS_COLLECTION_ID,
            [Query.equal('user_id', userId), Query.equal('account_id', accountId), Query.equal('automation_type', scopedTypes), Query.limit(200)]
        );
        return fallback.documents.some(d => d.$id !== excludeId && normalizeTitle(d.title) === titleNormalized);
    } catch (_) {
        return false;
    }
};

const hasDuplicateTemplateName = async (databases, { userId, accountId, nameNormalized, excludeId }) => {
    if (!nameNormalized) return false;
    try {
        const queries = [
            Query.equal('user_id', userId),
            Query.equal('account_id', accountId),
            Query.equal('name_normalized', nameNormalized),
            Query.limit(5)
        ];
        const result = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, REPLY_TEMPLATES_COLLECTION_ID, queries);
        const match = result.documents.find(d => d.$id !== excludeId);
        if (match) return true;
    } catch (_) { }

    // Fallback if normalized field not populated yet
    try {
        const fallback = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            REPLY_TEMPLATES_COLLECTION_ID,
            [Query.equal('user_id', userId), Query.equal('account_id', accountId), Query.limit(200)]
        );
        return fallback.documents.some(d => d.$id !== excludeId && normalizeTitle(d.name) === nameNormalized);
    } catch (_) {
        return false;
    }
};

const groupAutomationsByTemplate = (automations) => {
    const map = new Map();
    for (const doc of automations) {
        const templateId = doc.template_id || null;
        if (!templateId) continue;
        if (!map.has(templateId)) map.set(templateId, []);
        map.get(templateId).push({
            automation_id: doc.$id,
            title: doc.title || 'Untitled',
            automation_type: doc.automation_type || 'dm'
        });
    }
    return map;
};

const getAutomationsByTemplateSafe = async (databases, queries, contextLabel = 'template lookup') => {
    try {
        const automations = await listAllAutomations(databases, queries);
        return groupAutomationsByTemplate(automations);
    } catch (error) {
        console.warn(`Automation lookup skipped during ${contextLabel}: ${error.message}`);
        return new Map();
    }
};



// ==============================================================================
// INSTAGRAM OAUTH INTEGRATION
// ==============================================================================

// Get Instagram Auth URL
router.get('/auth/instagram', (req, res) => {
    if (!INSTAGRAM_APP_ID) {
        return res.status(500).json({ error: 'Instagram integration is not configured.' });
    }

    const scopes = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_insights';
    const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${INSTAGRAM_APP_ID}&redirect_uri=${INSTAGRAM_REDIRECT_URI}&response_type=code&scope=${scopes}`;

    res.json({ url: authUrl });
});

// Instagram Callback
router.post('/auth/instagram-callback', loginRequired, async (req, res) => {
    const { code } = req.body;
    const user = req.user;

    if (!code) return res.status(400).json({ error: 'Authorization code is required' });
    if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET) {
        return res.status(500).json({ error: 'Instagram integration is not configured.' });
    }

    try {
        // Step 1: Exchange code for short-lived access token
        const formData = new URLSearchParams();
        formData.append('client_id', INSTAGRAM_APP_ID);
        formData.append('client_secret', INSTAGRAM_APP_SECRET);
        formData.append('grant_type', 'authorization_code');
        formData.append('redirect_uri', INSTAGRAM_REDIRECT_URI);
        formData.append('code', code);

        const tokenResponse = await axios.post('https://api.instagram.com/oauth/access_token', formData);
        const tokenData = tokenResponse.data;

        let shortLivedToken, appScopedId, igUserId, permissions;

        // Handle both response formats
        if (tokenData.data && Array.isArray(tokenData.data) && tokenData.data.length > 0) {
            const firstItem = tokenData.data[0];
            shortLivedToken = firstItem.access_token;
            appScopedId = firstItem.id?.toString() || null;
            igUserId = firstItem.user_id?.toString();
            permissions = firstItem.permissions || '';
        } else {
            // Standard response: { access_token, user_id, id?, permissions? }
            shortLivedToken = tokenData.access_token;
            appScopedId = tokenData.id?.toString() || null;
            igUserId = tokenData.user_id?.toString();
            permissions = tokenData.permissions || '';
        }

        if (!shortLivedToken) {
            return res.status(400).json({ error: 'Failed to retrieve access token.' });
        }

        const permissionsText = (() => {
            if (Array.isArray(permissions)) {
                return permissions.map((p) => String(p || '').trim()).filter(Boolean).join(',').slice(0, 1024);
            }
            if (typeof permissions === 'string') {
                return permissions.slice(0, 1024);
            }
            if (permissions && typeof permissions === 'object') {
                try {
                    return JSON.stringify(permissions).slice(0, 1024);
                } catch (_) {
                    return '';
                }
            }
            return '';
        })();

        // Step 2: Exchange short-lived for long-lived
        const longLivedResponse = await axios.get('https://graph.instagram.com/access_token', {
            params: {
                grant_type: 'ig_exchange_token',
                client_secret: INSTAGRAM_APP_SECRET,
                access_token: shortLivedToken
            }
        });

        const longLivedData = longLivedResponse.data;
        const longLivedToken = longLivedData.access_token;
        const expiresIn = longLivedData.expires_in || 5184000; // 60 days default

        const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        // Step 3: Fetch Instagram user profile
        const profileResponse = await axios.get('https://graph.instagram.com/me', {
            params: {
                fields: 'id,user_id,username,profile_picture_url',
                access_token: longLivedToken
            }
        });

        const profileData = profileResponse.data;
        // Strict mapping from /me response:
        // - user_id -> ig_user_id/account_id
        // - id -> ig_scoped_id
        const igProfessionalAccountId = (profileData.user_id?.toString() || igUserId || '').toString();
        const igUsername = profileData.username || 'Unknown';
        const profilePicUrl = profileData.profile_picture_url || '';
        const resolvedScopedId = (profileData.id?.toString() || appScopedId || '').toString();

        if (!igProfessionalAccountId) {
            return res.status(400).json({ error: 'Failed to resolve Instagram user_id from Meta response.' });
        }

        // Step 4: Check for duplicates and Save
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const existingAccounts = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            [Query.equal('account_id', igProfessionalAccountId)]
        );

        if (existingAccounts.total > 0) {
            const existingAccount = existingAccounts.documents[0];
            if (!isOwnedIgAccount(existingAccount, user.$id)) {
                return res.status(409).json({ error: `This Instagram account (@${igUsername}) is already linked to another user.` });
            } else {
                // Update
                await databases.updateDocument(
                    process.env.APPWRITE_DATABASE_ID,
                    IG_ACCOUNTS_COLLECTION_ID,
                    existingAccount.$id,
                    {
                        // user_id = app user id (owner)
                        user_id: user.$id,
                        // ig_user_id = Meta token response "user_id"
                        ig_user_id: igProfessionalAccountId,
                        account_id: igProfessionalAccountId,
                        // ig_scoped_id = Meta token response "id" (app-scoped id)
                        ig_scoped_id: resolvedScopedId || existingAccount.ig_scoped_id || '',
                        username: igUsername,
                        profile_picture_url: profilePicUrl,
                        access_token: longLivedToken,
                        token_expires_at: tokenExpiresAt,
                        permissions: permissionsText,
                        status: 'active',
                        is_active: true,
                        linked_at: new Date().toISOString(),
                    }
                );
                const refreshedProfileContext = await resolveUserPlanContext(databases, user.$id);
                await recomputeAccountAccessForUser(databases, user.$id, refreshedProfileContext.profile);
                return res.json({ message: `Instagram account @${igUsername} updated successfully.` });
            }
        } else {
            const connectionLimitError = await enforceInstagramConnectionLimit(
                databases,
                user.$id,
                igProfessionalAccountId
            );
            if (connectionLimitError) {
                return res.status(403).json(connectionLimitError);
            }

            // Create
            await databases.createDocument(
                process.env.APPWRITE_DATABASE_ID,
                IG_ACCOUNTS_COLLECTION_ID,
                ID.unique(),
                {
                    // user_id = app user id (owner)
                    user_id: user.$id,
                    // ig_user_id = Meta token response "user_id"
                    ig_user_id: igProfessionalAccountId,
                    account_id: igProfessionalAccountId,
                    // ig_scoped_id = Meta token response "id" (app-scoped id)
                    ig_scoped_id: resolvedScopedId,
                    username: igUsername,
                    profile_picture_url: profilePicUrl,
                    access_token: longLivedToken,
                    token_expires_at: tokenExpiresAt,
                    permissions: permissionsText,
                    linked_at: new Date().toISOString(),
                    admin_disabled: false,
                    plan_locked: false,
                    access_override_enabled: false,
                    effective_access: true,
                    access_state: 'active',
                    access_reason: null
                },
                [
                    Permission.read(Role.user(user.$id))
                ]
            );
            const refreshedProfileContext = await resolveUserPlanContext(databases, user.$id);
            await recomputeAccountAccessForUser(databases, user.$id, refreshedProfileContext.profile);
            return res.json({ message: `Instagram account @${igUsername} linked successfully.` });
        }

    } catch (err) {
        console.error(`Instagram Auth Error: ${err.message}`, err.response?.data);
        res.status(500).json({ error: 'Failed to process Instagram login.' });
    }
});

// Get Linked Accounts
router.get('/account/ig-accounts', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const profileContext = await resolveUserPlanContext(databases, req.user.$id);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const recomputedAccounts = await recomputeAccountAccessForUser(
            databases,
            req.user.$id,
            profileContext.profile,
            accounts.documents || []
        );

        const safeAccounts = recomputedAccounts.map(serializeIgAccount);

        res.json({ ig_accounts: safeAccounts });
    } catch (err) {
        console.error(`Fetch IG Accounts Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch Instagram accounts.' });
    }
});

// Unlink Account
const unlinkIgAccountHandler = async (req, res) => {
    try {
        const { accountId } = req.params;
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        // Verify ownership
        const account = await databases.getDocument(
            process.env.APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            accountId
        );

        if (!isOwnedIgAccount(account, req.user.$id)) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        const functions = new Functions(serverClient);
        const execution = await functions.createExecution(
            FUNCTION_REMOVE_INSTAGRAM,
            JSON.stringify({ action: 'delete', account_doc_id: accountId }),
            false // async
        );

        if (execution.status === 'failed') {
            throw new Error("Function execution failed: " + execution.response);
        }

        res.json({ message: 'Instagram account and associated data deletion initiated.' });

    } catch (err) {
        if (err.code === 404) return res.status(404).json({ error: 'Account not found.' });
        console.error(`Unlink IG Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to unlink account.' });
    }
};

router.delete('/account/ig-accounts/:accountId', loginRequired, unlinkIgAccountHandler);

// Relink without OAuth when a valid token already exists.
router.post('/account/ig-accounts/relink/:accountId', loginRequired, async (req, res) => {
    try {
        const { accountId } = req.params;
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const account = await databases.getDocument(
            process.env.APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            accountId
        );

        if (!isOwnedIgAccount(account, req.user.$id)) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        if (!account.access_token) {
            return res.status(400).json({ error: 'No token available for relink.' });
        }

        const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
        if (!expiresAt || Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
            return res.status(400).json({ error: 'Token expired. OAuth login required.' });
        }

        await databases.updateDocument(
            process.env.APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            accountId,
            {
                status: 'active',
                is_active: true,
                linked_at: new Date().toISOString()
            }
        );
        const profileContext = await resolveUserPlanContext(databases, req.user.$id);
        await recomputeAccountAccessForUser(databases, req.user.$id, profileContext.profile);

        return res.json({ message: 'Instagram account relinked successfully.' });
    } catch (err) {
        if (err.code === 404) return res.status(404).json({ error: 'Account not found.' });
        console.error(`Relink IG Error: ${err.message}`);
        return res.status(500).json({ error: 'Failed to relink account.' });
    }
});

// Get Stats
router.get('/instagram/stats', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const profileContext = await resolveUserPlanContext(databases, req.user.$id);
        const recomputedAccounts = await recomputeAccountAccessForUser(
            databases,
            req.user.$id,
            profileContext.profile,
            accounts.documents || []
        );

        if (recomputedAccounts.length === 0) return res.status(404).json({ error: 'No Instagram account linked.' });

        const account = account_id
            ? recomputedAccounts.find((doc) => matchesIgAccountIdentifier(doc, account_id))
            : recomputedAccounts.find((doc) => doc.effective_access === true) || recomputedAccounts[0];
        if (!account) return res.status(404).json({ error: 'Instagram account not found.' });
        if (account.effective_access !== true) {
            return res.status(403).json(buildInstagramAccountAccessError(account));
        }
        const accessToken = account.access_token;

        // Fetch profile info, stories, live status, and media (for reel count) in parallel
        const [profileResult, storiesResult, liveResult, reelsCountResult] = await Promise.allSettled([
            // 1. Profile info from /me
            fetchInstagramProfileSnapshot(accessToken).then((data) => ({ data })),
            // 2. Stories count
            axios.get('https://graph.instagram.com/v24.0/me/stories', {
                params: {
                    fields: 'id',
                    access_token: accessToken
                }
            }),
            // 3. Live status
            axios.get('https://graph.instagram.com/v24.0/me/live_media', {
                params: {
                    fields: 'id',
                    access_token: accessToken
                }
            }),
            // 4. Count reels by fetching media with media_product_type
            //    Per Instagram API docs, reels have media_product_type === 'REELS'
            (async () => {
                let reelsCount = 0;
                let nextUrl = null;
                let pagesFetched = 0;
                const MAX_PAGES = 20; // Safety limit to avoid excessive API calls

                // First page
                const firstPage = await axios.get('https://graph.instagram.com/v24.0/me/media', {
                    params: {
                        fields: 'media_product_type',
                        limit: 100,
                        access_token: accessToken
                    }
                });

                const countReels = (items) => items.filter(m => m.media_product_type === 'REELS').length;

                reelsCount += countReels(firstPage.data.data || []);
                pagesFetched++;
                nextUrl = firstPage.data.paging?.next || null;

                // Paginate through remaining media
                while (nextUrl && pagesFetched < MAX_PAGES) {
                    const nextPage = await axios.get(nextUrl);
                    reelsCount += countReels(nextPage.data.data || []);
                    pagesFetched++;
                    nextUrl = nextPage.data.paging?.next || null;
                }

                return reelsCount;
            })()
        ]);

        // Extract profile data (required - fail if this fails)
        if (profileResult.status === 'rejected') {
            throw profileResult.reason;
        }
        const data = profileResult.value.data;

        // Extract optional data with safe defaults
        const storiesCount = storiesResult.status === 'fulfilled'
            ? (storiesResult.value.data.data || []).length
            : 0;

        const isLive = liveResult.status === 'fulfilled'
            ? (liveResult.value.data.data || []).length > 0
            : false;

        const reelsCount = reelsCountResult.status === 'fulfilled'
            ? reelsCountResult.value
            : 0;

        if (storiesResult.status === 'rejected') {
            console.log('Stories fetch skipped:', storiesResult.reason?.message);
        }
        if (liveResult.status === 'rejected') {
            console.log('Live status fetch skipped:', liveResult.reason?.message);
        }
        if (reelsCountResult.status === 'rejected') {
            console.log('Reels count fetch skipped:', reelsCountResult.reason?.message);
        }

        res.json({
            followers: data.followers_count || 0,
            following: data.follows_count || 0,
            media_count: data.media_count || 0,
            reels_count: reelsCount,
            stories_count: storiesCount,
            username: data.username || '',
            name: data.name || '',
            profile_picture_url: data.profile_picture_url || '',
            biography: data.biography || '',
            website: data.website || '',
            is_live: isLive,
            is_verified: false
        });

    } catch (err) {
        console.error(`IG Stats Error: ${err.message}`);
        if (err.response) {
            return res.status(err.response.status).json({ error: 'Failed to fetch Instagram stats.' });
        }
        res.status(500).json({ error: 'Failed to fetch stats.' });
    }
});

router.get('/instagram/insights', loginRequired, async (req, res) => {
    try {
        const { account_id, period = 'days_28' } = req.query;
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const profileContext = await resolveUserPlanContext(databases, req.user.$id);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const recomputedAccounts = await recomputeAccountAccessForUser(
            databases,
            req.user.$id,
            profileContext.profile,
            accounts.documents || []
        );

        const account = account_id
            ? recomputedAccounts.find((doc) => matchesIgAccountIdentifier(doc, account_id))
            : recomputedAccounts.find((doc) => doc.effective_access === true) || recomputedAccounts[0];
        if (!account) return res.status(404).json({ error: 'Instagram account not found.' });
        if (account.effective_access !== true) {
            return res.status(403).json(buildInstagramAccountAccessError(account));
        }

        const insights = await fetchRichInstagramInsights({
            accessToken: account.access_token,
            period: String(period || 'days_28')
        });

        return res.json({
            account: serializeIgAccount(account),
            ...insights,
            insights_available: Object.keys(insights.account_metrics || {}).length > 0
                || Object.keys(insights.account_timeseries || {}).length > 0
                || (insights.media_items || []).some((item) => Object.keys(item.metrics || {}).length > 0)
        });
    } catch (err) {
        console.error(`IG Insights Error: ${err.message}`);
        return res.status(500).json({ error: 'Failed to fetch Instagram insights.' });
    }
});

router.get('/instagram/insights-summary', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const profileContext = await resolveUserPlanContext(databases, req.user.$id);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const recomputedAccounts = await recomputeAccountAccessForUser(
            databases,
            req.user.$id,
            profileContext.profile,
            accounts.documents || []
        );

        const account = req.query?.account_id
            ? recomputedAccounts.find((doc) => matchesIgAccountIdentifier(doc, req.query.account_id))
            : recomputedAccounts.find((doc) => doc.effective_access === true) || recomputedAccounts[0];
        if (!account) return res.status(404).json({ error: 'Instagram account not found.' });
        if (account.effective_access !== true) {
            return res.status(403).json(buildInstagramAccountAccessError(account));
        }

        const richInsights = await fetchRichInstagramInsights({
            accessToken: account.access_token,
            period: String(req.query?.period || 'days_28')
        });

        const legacyInsights = await fetchInstagramAccountInsights({
            accessToken: account.access_token,
            period: String(req.query?.period || 'days_28')
        });

        return res.json({
            account: serializeIgAccount(account),
            period: richInsights.period,
            summary: richInsights.summary,
            insights: legacyInsights,
            insights_available: Object.keys(richInsights.account_metrics || {}).length > 0
        });
    } catch (err) {
        console.error(`IG Insights Summary Error: ${err.message}`);
        return res.status(500).json({ error: 'Failed to fetch Instagram insights.' });
    }
});

// Get Media
router.get('/instagram/media', loginRequired, async (req, res) => {
    try {
        const { account_id, type, after } = req.query;

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const accounts = await listOwnedIgAccounts(databases, req.user.$id);

        if (accounts.total === 0) return res.status(404).json({ error: 'No Instagram account linked.' });

        const account = account_id
            ? accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id))
            : accounts.documents[0];
        if (!account) return res.status(404).json({ error: 'Instagram account not found.' });
        const normalizedAccountId = getIgProfessionalAccountId(account);
        const accessToken = account.access_token;

        const apiEdge = type === 'story' ? 'stories' : type === 'live' ? 'live_media' : 'media';

        const params = {
            fields: type === 'live'
                ? 'id,status'
                : 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,shortcode',
            access_token: accessToken,
            limit: 25
        };
        if (after) params.after = after;

        const response = await axios.get(`https://graph.instagram.com/me/${apiEdge}`, { params });

        const data = response.data;
        const mediaItems = data.data || [];

        // Filter logic similar to Python
        const filteredItems = type === 'live'
            ? mediaItems.map((item) => ({
                id: item.id,
                caption: item.status === 'LIVE' ? 'Live session active' : 'Live session',
                media_type: 'VIDEO',
                media_url: '',
                thumbnail_url: '',
                permalink: '',
                timestamp: new Date().toISOString(),
                status: item.status || 'LIVE'
            }))
            : mediaItems.filter(item => {
                if (!type) return true;
                if (type === 'reel') return item.media_type === 'VIDEO';
                if (type === 'post') return ['IMAGE', 'CAROUSEL_ALBUM'].includes(item.media_type);
                return true;
            });

        const automationTypes = (() => {
            if (type === 'post') return ['post', 'comment'];
            if (type === 'reel') return ['reel'];
            if (type === 'story') return ['story'];
            if (type === 'live') return ['live'];
            return ['post', 'comment', 'reel', 'story', 'live'];
        })();

        let automationByMediaId = new Map();
        try {
            const automationDocs = await databases.listDocuments(
                process.env.APPWRITE_DATABASE_ID,
                AUTOMATIONS_COLLECTION_ID,
                [
                    Query.equal('user_id', req.user.$id),
                    Query.equal('account_id', normalizedAccountId),
                    Query.equal('automation_type', automationTypes),
                    Query.limit(200)
                ]
            );

            for (const doc of (automationDocs.documents || [])) {
                const mediaId = String(doc.media_id || '').trim();
                if (!mediaId || automationByMediaId.has(mediaId)) continue;
                automationByMediaId.set(mediaId, {
                    automation_id: doc.$id,
                    automation_type: doc.automation_type || null
                });
            }
        } catch (_) { }

        filteredItems.forEach(item => {
            const match = automationByMediaId.get(String(item.id || '').trim());
            item.has_automation = Boolean(match);
            if (match) {
                item.automation_id = match.automation_id;
                item.automation_type = match.automation_type;
            }
        });

        res.json({
            data: filteredItems,
            paging: data.paging || {}
        });

    } catch (err) {
        console.error(`IG Media Error: ${err.message}`);
        if (err.response) {
            return res.status(err.response.status).json({ error: 'Failed to fetch Instagram media.' });
        }
        res.status(500).json({ error: 'Failed to fetch media.' });
    }
});

// ============================================================================
// AUTH: Instagram URL (sidebar connect button)
// ============================================================================
router.get('/auth/instagram/url', loginRequired, async (req, res) => {
    const scopes = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights';
    const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${INSTAGRAM_APP_ID}&redirect_uri=${INSTAGRAM_REDIRECT_URI}&response_type=code&scope=${scopes}`;
    res.json({ url: authUrl });
});

// ============================================================================
// SYNC PROFILE (update IG account profile data in Appwrite)
// ============================================================================
// ============================================================================
// DASHBOARD COUNTS
// ============================================================================
router.get('/dashboard/counts', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const profileContext = await resolveUserPlanContext(databases, req.user.$id);
        const recomputedAccounts = await recomputeAccountAccessForUser(
            databases,
            req.user.$id,
            profileContext.profile,
            accounts.documents || []
        );
        const igAccount = recomputedAccounts.find(a => matchesIgAccountIdentifier(a, account_id));
        if (!igAccount) return res.status(404).json({ error: 'Account not found' });
        if (igAccount.effective_access !== true) {
            return res.status(403).json(buildInstagramAccountAccessError(igAccount));
        }
        const normalizedAccountId = getIgProfessionalAccountId(igAccount);
        const userId = req.user.$id;
        const ownedAccounts = { documents: recomputedAccounts };

        const queries = [Query.equal('user_id', userId)];
        let templateQueries = [Query.equal('user_id', userId)];
        let targetAccountId = null;
        if (account_id) {
            const account = ownedAccounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id));
            if (!account) return res.status(404).json({ error: 'Account not found' });
            targetAccountId = getIgProfessionalAccountId(account);
            queries.push(Query.equal('account_id', targetAccountId));
            templateQueries.push(Query.equal('account_id', targetAccountId));
        }
        const allOwnedAccountIds = ownedAccounts.documents
            .map((doc) => getIgProfessionalAccountId(doc))
            .filter(Boolean);
        const accountScopedQueries = targetAccountId
            ? [Query.equal('account_id', targetAccountId)]
            : (allOwnedAccountIds.length > 0 ? [Query.equal('account_id', allOwnedAccountIds)] : []);

        const [templatesResult, mentionsResult, welcomeMessageResult, suggestMoreResult, emailCollectorsResult, profileResult, logsResult] = await Promise.allSettled([
            databases.listDocuments(process.env.APPWRITE_DATABASE_ID, REPLY_TEMPLATES_COLLECTION_ID, templateQueries.concat([Query.limit(1)])),
            listMentionsDocuments(databases, { userId, accountIds: targetAccountId || allOwnedAccountIds, limit: 1 }),
            databases.listDocuments(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, queries.concat([Query.equal('automation_type', 'welcome_message'), Query.limit(1)])),
            listSuggestMoreDocuments(databases, { userId, accountIds: targetAccountId || allOwnedAccountIds, limit: 1 }),
            databases.listDocuments(process.env.APPWRITE_DATABASE_ID, AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID, accountScopedQueries.concat([Query.limit(1)])),
            databases.listDocuments(process.env.APPWRITE_DATABASE_ID, PROFILES_COLLECTION_ID, [Query.equal('user_id', userId), Query.limit(1)]),
            databases.listDocuments(process.env.APPWRITE_DATABASE_ID, LOGS_COLLECTION_ID, accountScopedQueries.concat([
                Query.greaterThanEqual('sent_at', new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString()),
                Query.limit(5000)
            ]))
        ]);

        const profile = profileResult.status === 'fulfilled' ? profileResult.value.documents[0] || null : null;
        const logs = logsResult.status === 'fulfilled' ? logsResult.value.documents || [] : [];
        const successfulLogs = logs.filter((entry) => String(entry.status || '').toLowerCase() === 'success').length;
        const replyRate = logs.length > 0 ? Math.round((successfulLogs / logs.length) * 100) : 0;
        const reelReplies = logs.filter((entry) => String(entry.automation_type || '').toLowerCase() === 'reel').length;
        const postReplies = logs.filter((entry) => ['comment', 'post'].includes(String(entry.automation_type || '').toLowerCase())).length;
        const hourlyLimit = Number(profile?.hourly_action_limit || 0);
        const dailyLimit = Number(profile?.daily_action_limit || 0);
        const monthlyLimit = Number(profile?.monthly_action_limit || 0);
        const now = Date.now();
        const countInWindow = (windowMs) => logs.reduce((count, entry) => {
            const raw = entry.sent_at || entry.created_at;
            if (!raw) return count;
            const ts = new Date(raw).getTime();
            if (Number.isNaN(ts)) return count;
            return ts >= now - windowMs ? count + 1 : count;
        }, 0);
        const hourlyUsage = countInWindow(60 * 60 * 1000);
        const dailyUsage = countInWindow(24 * 60 * 60 * 1000);
        const monthlyUsage = countInWindow(30 * 24 * 60 * 60 * 1000);

        res.json({
            reply_templates: templatesResult.status === 'fulfilled' ? templatesResult.value.total : 0,
            mention: mentionsResult.status === 'fulfilled' ? mentionsResult.value.total : 0,
            welcome_message: welcomeMessageResult.status === 'fulfilled' ? welcomeMessageResult.value.total : 0,
            suggest_more: suggestMoreResult.status === 'fulfilled' ? suggestMoreResult.value.total : 0,
            email_collector: emailCollectorsResult.status === 'fulfilled' ? emailCollectorsResult.value.total : 0,
            gauge_metrics: {
                dm_rate: replyRate,
                actions_month: monthlyUsage,
                actions_month_limit: Number(profile?.monthly_action_limit || 0),
                reel_replies: reelReplies,
                post_replies: postReplies,
                hourly_actions_used: hourlyUsage,
                hourly_action_limit: hourlyLimit,
                daily_actions_used: dailyUsage,
                daily_action_limit: dailyLimit,
                monthly_actions_used: monthlyUsage,
                monthly_action_limit: monthlyLimit
            },
            action_window_metrics: {
                hourly_actions_used: hourlyUsage,
                hourly_action_limit: hourlyLimit,
                daily_actions_used: dailyUsage,
                daily_action_limit: dailyLimit,
                monthly_actions_used: monthlyUsage,
                monthly_action_limit: monthlyLimit
            }
        });
    } catch (err) {
        console.error(`Dashboard Counts Error: ${err.message}`);
        res.json({
            reply_templates: 0,
            mention: 0,
            welcome_message: 0,
            suggest_more: 0,
            email_collector: 0,
            gauge_metrics: {
                dm_rate: 0,
                actions_month: 0,
                actions_month_limit: 0,
                reel_replies: 0,
                post_replies: 0,
                hourly_actions_used: 0,
                hourly_action_limit: 0,
                daily_actions_used: 0,
                daily_action_limit: 0,
                monthly_actions_used: 0,
                monthly_action_limit: 0
            }
        });
    }
});

router.post('/account/ig-accounts/refresh-profiles', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const profileContext = await resolveUserPlanContext(databases, req.user.$id);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const recomputedAccounts = await recomputeAccountAccessForUser(
            databases,
            req.user.$id,
            profileContext.profile,
            accounts.documents || []
        );

        const candidates = recomputedAccounts.filter((account) => isLinkedAccountActive(account) && account.access_token);
        const results = await Promise.allSettled(candidates.map(async (account) => {
            const snapshot = await fetchInstagramProfileSnapshot(account.access_token);
            const patch = {};
            if (snapshot.profile_picture_url !== undefined && snapshot.profile_picture_url !== account.profile_picture_url) {
                patch.profile_picture_url = snapshot.profile_picture_url || '';
            }
            if (snapshot.username !== undefined && snapshot.username !== account.username) {
                patch.username = snapshot.username || '';
            }
            if (snapshot.name !== undefined && snapshot.name !== account.name) {
                patch.name = snapshot.name || '';
            }
            const nextAccount = Object.keys(patch).length > 0
                ? await databases.updateDocument(process.env.APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, account.$id, patch)
                : account;

            return {
                account_id: account.$id,
                username: snapshot.username || account.username || '',
                updated: Object.keys(patch).length > 0,
                account: serializeIgAccount({
                    ...nextAccount,
                    ...normalizeAccountAccess(nextAccount)
                })
            };
        }));

        const refreshedAccounts = await recomputeAccountAccessForUser(databases, req.user.$id, profileContext.profile);
        return res.json({
            refreshed: results
                .filter((item) => item.status === 'fulfilled')
                .map((item) => item.value),
            failed: results
                .filter((item) => item.status === 'rejected')
                .map((item) => ({ error: item.reason?.message || 'Failed to refresh profile' })),
            ig_accounts: refreshedAccounts.map(serializeIgAccount)
        });
    } catch (err) {
        console.error(`Refresh Profiles Error: ${err.message}`);
        return res.status(500).json({ error: 'Failed to refresh Instagram profiles.' });
    }
});

router.get('/instagram/media-proxy', loginRequired, async (req, res) => {
    const mediaUrl = String(req.query.url || '').trim();
    if (!mediaUrl) {
        return res.status(400).json({ error: 'url is required' });
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(mediaUrl);
    } catch (_) {
        return res.status(400).json({ error: 'Invalid media URL.' });
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    const isAllowedHost =
        hostname === 'lookaside.fbsbx.com' ||
        hostname.endsWith('.lookaside.fbsbx.com') ||
        hostname === 'scontent.cdninstagram.com' ||
        hostname.endsWith('.cdninstagram.com') ||
        hostname === 'fbcdn.net' ||
        hostname.endsWith('.fbcdn.net');

    if (!isAllowedHost) {
        return res.status(400).json({ error: 'Unsupported media host.' });
    }

    try {
        const response = await axios.get(mediaUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
            }
        });

        res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
        res.setHeader('Cache-Control', 'private, max-age=300');
        return res.status(200).send(Buffer.from(response.data));
    } catch (err) {
        const status = Number(err?.response?.status || 502);
        if (status === 403 || status === 404) {
            logWarnWithThrottle(`ig-media-proxy:${status}`, `IG Media Proxy returning empty response for status ${status}`);
            return res.status(204).end();
        }
        logWarnWithThrottle(`ig-media-proxy:error:${status}`, `IG Media Proxy Error: ${err.message}`, 15_000);
        return res.status(status).json({ error: 'Failed to proxy Instagram media.' });
    }
});

const getLogWindowQueries = ({ accountId, startDate, endDate, limit = 200 }) => {
    const queries = [Query.equal('account_id', String(accountId)), Query.orderDesc('sent_at'), Query.limit(limit)];
    if (startDate) queries.push(Query.greaterThanEqual('sent_at', `${startDate}T00:00:00.000Z`));
    if (endDate) queries.push(Query.lessThanEqual('sent_at', `${endDate}T23:59:59.999Z`));
    return queries;
};

const escapeCsvValue = (value) => {
    const stringValue = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
};

router.get('/instagram/automation-activity-log', loginRequired, async (req, res) => {
    try {
        const { account_id, start_date, end_date } = req.query;
        const limit = Number(req.query.limit || 200);
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const account = accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id));
        if (!account) return res.status(404).json({ error: 'Account not found' });
        const targetAccountId = getIgProfessionalAccountId(account);

        const result = await retryAppwriteOperation(() => databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            LOGS_COLLECTION_ID,
            getLogWindowQueries({
                accountId: targetAccountId,
                startDate: start_date,
                endDate: end_date,
                limit: Math.min(Math.max(limit, 1), 5000)
            })
        ));

        const logs = (result.documents || []).map((entry) => ({
            id: entry.$id,
            account_id: entry.account_id,
            recipient_id: entry.recipient_id,
            sender_name: entry.sender_name,
            automation_id: entry.automation_id,
            automation_type: entry.automation_type,
            event_type: entry.event_type,
            source: entry.source,
            status: entry.status,
            message: entry.message,
            error_reason: entry.error_reason,
            payload: parseMaybeJson(entry.payload, entry.payload),
            sent_at: entry.sent_at,
            created_at: entry.$createdAt
        }));

        return res.json({ logs, total: result.total || logs.length });
    } catch (err) {
        console.error(`Automation Activity Log Error: ${err.message}`);
        return res.status(500).json({ error: 'Failed to fetch automation activity log.' });
    }
});

router.get('/instagram/automation-activity-log/csv', loginRequired, async (req, res) => {
    try {
        const { account_id, start_date, end_date } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const account = accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id));
        if (!account) return res.status(404).json({ error: 'Account not found' });
        const targetAccountId = getIgProfessionalAccountId(account);

        const result = await retryAppwriteOperation(() => databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            LOGS_COLLECTION_ID,
            getLogWindowQueries({ accountId: targetAccountId, startDate: start_date, endDate: end_date, limit: 5000 })
        ));

        const rows = [
            ['sent_at', 'status', 'automation_type', 'event_type', 'sender_name', 'recipient_id', 'message', 'source'],
            ...(result.documents || []).map((entry) => ([
                entry.sent_at,
                entry.status,
                entry.automation_type,
                entry.event_type,
                entry.sender_name,
                entry.recipient_id,
                entry.message,
                entry.source
            ]))
        ];

        const csv = rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="automation-activity-${targetAccountId}.csv"`);
        return res.send(csv);
    } catch (err) {
        console.error(`Automation Activity CSV Error: ${err.message}`);
        return res.status(500).json({ error: 'Failed to export automation activity log.' });
    }
});

// ============================================================================
// AUTOMATIONS (DM, Comment, Story, Post, Reel, Live)
// ============================================================================
// Keyword availability (fast validation)
router.post('/instagram/keywords/availability', loginRequired, async (req, res) => {
    try {
        const accountIdInput = req.query.account_id || req.body.account_id;
        if (!accountIdInput) return res.status(400).json({ error: 'account_id is required' });

        const automationType = req.body.type || req.query.type || req.body.automation_type || 'dm';
        const automationId = req.body.automation_id || null;

        const keywordInfo = getKeywordInfo({ keywords: req.body.keywords });
        const keywordArray = KEYWORD_TYPES.has(automationType) ? keywordInfo.keywords : [];
        if (keywordArray.length === 0) {
            return res.json({ available: true, conflicts: [] });
        }

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const account = accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, accountIdInput));
        if (!account) return res.status(404).json({ error: 'Account not found' });
        const targetAccountId = getIgProfessionalAccountId(account);

        const conflicts = await findKeywordConflicts(databases, {
            accountId: targetAccountId,
            automationId,
            automationType,
            keywords: keywordArray
        });

        res.json({ available: conflicts.length === 0, conflicts });
    } catch (err) {
        console.error(`Keyword Availability Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to validate keywords' });
    }
});

// GET all automations for account
router.get('/instagram/automations', loginRequired, async (req, res) => {
    try {
        const { account_id, type, summary } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const queries = [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id)];
        if (type) queries.push(Query.equal('automation_type', type));
        queries.push(Query.orderDesc('$createdAt'));
        queries.push(Query.limit(100));

        const result = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, queries);
        const documents = result.documents.filter((doc) => {
            if (String(doc?.automation_type || '').toLowerCase() !== 'story') {
                return true;
            }
            return String(doc?.story_scope || 'shown').toLowerCase() === 'shown';
        });

        const summaryMode = summary === '1' || summary === 'true';

        const automations = documents.map(doc => {
            const parsed = { ...doc };
            try { if (typeof parsed.keywords === 'string') parsed.keywords = JSON.parse(parsed.keywords); } catch (e) { parsed.keywords = []; }
            if (!summaryMode) {
                try { if (typeof parsed.buttons === 'string') parsed.buttons = JSON.parse(parsed.buttons); } catch (e) { }
                try { if (typeof parsed.template_elements === 'string') parsed.template_elements = JSON.parse(parsed.template_elements); } catch (e) { }
                try { if (typeof parsed.replies === 'string') parsed.replies = JSON.parse(parsed.replies); } catch (e) { }
                return parsed;
            }

            const keywordList = Array.isArray(parsed.keywords)
                ? parsed.keywords
                : (typeof parsed.keyword === 'string'
                    ? parsed.keyword.split(',').map((item) => String(item || '').trim()).filter(Boolean)
                    : []);

            return {
                $id: parsed.$id,
                $createdAt: parsed.$createdAt,
                $updatedAt: parsed.$updatedAt,
                account_id: parsed.account_id,
                automation_type: parsed.automation_type,
                title: parsed.title,
                title_normalized: parsed.title_normalized,
                trigger_type: parsed.trigger_type,
                template_type: parsed.template_type,
                template_id: parsed.template_id,
                media_id: parsed.media_id,
                media_url: parsed.media_url,
                is_active: parsed.is_active !== false,
                active: parsed.is_active !== false,
                followers_only: parsed.followers_only === true,
                followers_only_message: parsed.followers_only_message || '',
                suggest_more_enabled: parsed.suggest_more_enabled === true,
                private_reply_enabled: parsed.private_reply_enabled !== false,
                share_to_admin_enabled: parsed.share_to_admin_enabled === true,
                once_per_user_24h: parsed.once_per_user_24h === true,
                collect_email_enabled: parsed.collect_email_enabled === true,
                collect_email_only_gmail: parsed.collect_email_only_gmail === true,
                seen_typing_enabled: parsed.seen_typing_enabled === true,
                story_scope: parsed.automation_type === 'story' ? 'shown' : (parsed.story_scope || 'shown'),
                keyword_match_type: parsed.keyword_match_type || 'exact',
                keyword: keywordList,
                keywords: keywordList,
                comment_reply: parsed.comment_reply || ''
            };
        });

        res.json({ automations });
    } catch (err) {
        console.error(`Fetch Automations Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch automations' });
    }
});

// GET single automation
router.get('/instagram/automations/:id', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const doc = await retryAppwriteOperation(() => databases.getDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, req.params.id));
        if (doc.user_id !== req.user.$id) return res.status(403).json({ error: 'Unauthorized' });

        const parsed = { ...doc };
        try { if (typeof parsed.keywords === 'string') parsed.keywords = JSON.parse(parsed.keywords); } catch (e) { parsed.keywords = []; }
        try { if (typeof parsed.buttons === 'string') parsed.buttons = JSON.parse(parsed.buttons); } catch (e) { }
        try { if (typeof parsed.template_elements === 'string') parsed.template_elements = JSON.parse(parsed.template_elements); } catch (e) { }
        try { if (typeof parsed.replies === 'string') parsed.replies = JSON.parse(parsed.replies); } catch (e) { }
        if (String(parsed.automation_type || '').toLowerCase() === 'story') {
            parsed.story_scope = 'shown';
        }

        res.json(parsed);
    } catch (err) {
        if (Number(err?.code) === 404) {
            console.warn(`Get Automation Warning: ${err.message}`);
            return res.status(404).json({ error: 'Automation not found' });
        }
        console.error(`Get Automation Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch automation' });
    }
});

// CREATE automation
router.post('/instagram/automations', loginRequired, async (req, res) => {
    try {
        const { account_id, type } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const account = accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id));
        if (!account) return res.status(404).json({ error: 'Account not found' });
        const targetAccountId = getIgProfessionalAccountId(account);

        const body = req.body;
        const automationType = type || body.automation_type || 'dm';
        const featureAccessError = await enforceAutomationFeatureAccess(databases, req.user.$id, body);
        if (featureAccessError) {
            return res.status(403).json(featureAccessError);
        }
        const keywordInfo = getKeywordInfo(body);
        const keywordArray = KEYWORD_TYPES.has(automationType) ? keywordInfo.keywords : [];
        const keywordString = keywordArray.join(',');
        const validationErrors = validateAutomationPayload({
            ...body,
            automation_type: automationType
        });
        if (validationErrors.length > 0) {
            return res.status(400).json({ error: 'Validation failed', details: validationErrors });
        }

        const liveCapacityError = await ensureLiveAutomationCapacity(databases, {
            userId: req.user.$id,
            accountId: targetAccountId,
            automationType,
            triggerType: body.trigger_type || 'keywords'
        });
        if (liveCapacityError) {
            return res.status(400).json({ error: liveCapacityError, field: 'trigger_type' });
        }

        const {
            titleNormalized,
            docData: fullCreateData
        } = buildAutomationDocumentData({
            userId: req.user.$id,
            accountId: targetAccountId,
            automationType,
            payload: body
        });

        if ((automationType === 'dm' || automationType === 'global') && titleNormalized) {
            const duplicate = await hasDuplicateAutomationTitle(databases, {
                userId: req.user.$id,
                accountId: targetAccountId,
                automationType,
                titleNormalized
            });
            if (duplicate) {
                return res.status(400).json({ error: 'Duplicate title', field: 'title' });
            }
        }
        if (KEYWORD_TYPES.has(automationType) && keywordArray.length > 0) {
            const conflicts = await findKeywordConflicts(databases, {
                accountId: targetAccountId,
                automationId: null,
                automationType,
                keywords: keywordArray
            });
            if (conflicts.length > 0) {
                return res.status(400).json({
                    error: 'Duplicate keywords',
                    field: 'keywords',
                    duplicate_keywords: conflicts
                });
            }
            const moderationConflicts = await findModerationKeywordConflicts(databases, {
                userId: req.user.$id,
                accountIds: [targetAccountId, account_id],
                keywords: keywordArray
            });
            if (moderationConflicts.length > 0) {
                return res.status(400).json({
                    error: `Moderation keywords cannot be reused in automations: ${moderationConflicts.join(', ')}`,
                    field: 'keywords',
                    duplicate_keywords: moderationConflicts
                });
            }
        }

        const automationCollectionInfo = await getCollectionAttributeInfo(databases, AUTOMATIONS_COLLECTION_ID);
        const docData = sanitizePayloadForCollection(fullCreateData, automationCollectionInfo);

        // Create automation directly (replacing functions)
        const doc = await createDocumentWithUnknownAttributeRetry({
            databases,
            databaseId: process.env.APPWRITE_DATABASE_ID,
            collectionId: AUTOMATIONS_COLLECTION_ID,
            documentId: ID.unique(),
            payload: docData,
            permissions: [Permission.read(Role.user(req.user.$id))]
        });

        if (KEYWORD_TYPES.has(automationType)) {
            try {
                await syncKeywordRecords(databases, {
                    accountId: targetAccountId,
                    automationId: doc.$id,
                    automationType,
                    keywords: keywordArray,
                    matchType: body.keyword_match_type || 'exact'
                });
            } catch (e) {
                try {
                    await databases.deleteDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, doc.$id);
                } catch (_) { }
                return res.status(400).json({ error: e.message || 'Keyword sync failed', field: 'keywords' });
            }
        }
        res.status(201).json({ status: "success", automation_id: doc.$id });
    } catch (err) {
        console.error(`Create Automation Error: ${err.message}`, err?.response?.message || err?.response || '');
        res.status(500).json({ error: 'Failed to create automation' });
    }
});

// UPDATE automation
router.patch('/instagram/automations/:id', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const existing = await databases.getDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, req.params.id);
        if (existing.user_id !== req.user.$id) return res.status(403).json({ error: 'Unauthorized' });

        const body = req.body;
        const nextAutomationType = body.automation_type || existing.automation_type || 'dm';
        const keywordUpdateProvided = body.keyword !== undefined || body.keywords !== undefined || body.automation_type !== undefined;
        const {
            keywordArray: nextKeywords,
            titleNormalized,
            docData: fullUpdateData
        } = buildAutomationDocumentData({
            userId: req.user.$id,
            accountId: existing.account_id,
            automationType: nextAutomationType,
            payload: body,
            existingDocument: existing
        });

        const candidate = {
            ...existing,
            ...body,
            ...fullUpdateData,
            automation_type: nextAutomationType,
            keyword: nextKeywords.join(','),
            keywords: nextKeywords
        };
        const validationErrors = validateAutomationPayload(candidate);
        if (validationErrors.length > 0) {
            return res.status(400).json({ error: 'Validation failed', details: validationErrors });
        }

        const featureAccessError = await enforceAutomationFeatureAccess(databases, req.user.$id, candidate);
        if (featureAccessError) {
            return res.status(403).json(featureAccessError);
        }

        const liveCapacityError = await ensureLiveAutomationCapacity(databases, {
            userId: req.user.$id,
            accountId: existing.account_id,
            automationType: nextAutomationType,
            triggerType: fullUpdateData.trigger_type || body.trigger_type || existing.trigger_type || 'keywords',
            excludeId: existing.$id
        });
        if (liveCapacityError) {
            return res.status(400).json({ error: liveCapacityError, field: 'trigger_type' });
        }

        if ((body.title !== undefined || body.automation_type !== undefined) && (nextAutomationType === 'dm' || nextAutomationType === 'global') && titleNormalized) {
            const duplicate = await hasDuplicateAutomationTitle(databases, {
                userId: req.user.$id,
                accountId: existing.account_id,
                automationType: nextAutomationType,
                titleNormalized,
                excludeId: existing.$id
            });
            if (duplicate) {
                return res.status(400).json({ error: 'Duplicate title', field: 'title' });
            }
        }

        if (keywordUpdateProvided && KEYWORD_TYPES.has(nextAutomationType)) {
            const conflicts = await findKeywordConflicts(databases, {
                accountId: existing.account_id,
                automationId: existing.$id,
                automationType: nextAutomationType,
                keywords: nextKeywords || []
            });
            if (conflicts.length > 0) {
                return res.status(400).json({
                    error: 'Duplicate keywords',
                    field: 'keywords',
                    duplicate_keywords: conflicts
                });
            }
            const moderationConflicts = await findModerationKeywordConflicts(databases, {
                userId: req.user.$id,
                accountIds: [existing.account_id, req.query.account_id, req.body.account_id],
                keywords: nextKeywords || []
            });
            if (moderationConflicts.length > 0) {
                return res.status(400).json({
                    error: `Moderation keywords cannot be reused in automations: ${moderationConflicts.join(', ')}`,
                    field: 'keywords',
                    duplicate_keywords: moderationConflicts
                });
            }
        }

        const automationCollectionInfo = await getCollectionAttributeInfo(databases, AUTOMATIONS_COLLECTION_ID);
        const sanitizedUpdateData = sanitizePayloadForCollection(fullUpdateData, automationCollectionInfo);

        await databases.updateDocument(
            process.env.APPWRITE_DATABASE_ID,
            AUTOMATIONS_COLLECTION_ID,
            req.params.id,
            sanitizedUpdateData
        );

        if (keywordUpdateProvided) {
            try {
                await syncKeywordRecords(databases, {
                    accountId: existing.account_id,
                    automationId: existing.$id,
                    automationType: nextAutomationType,
                    keywords: nextKeywords || [],
                    matchType: fullUpdateData.keyword_match_type || 'exact'
                });
            } catch (e) {
                return res.status(400).json({ error: e.message || 'Keyword sync failed', field: 'keywords' });
            }
        }

        const doc = await databases.getDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, req.params.id);

        res.json(doc);
    } catch (err) {
        console.error(`Update Automation Error: ${err.message}`);
        if (err.code === 404) return res.status(404).json({ error: 'Automation not found' });
        res.status(500).json({ error: 'Failed to update automation' });
    }
});

router.get('/instagram/automations/:id/email-collector-destination', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const automation = await getOwnedAutomationDocument(databases, req.user.$id, req.params.id);
        const destinationDoc = await loadCollectorDestinationDocument(databases, automation);

        res.json({
            destination: normalizeCollectorDestinationResponse(destinationDoc)
        });
    } catch (error) {
        console.error(`Get Email Collector Destination Error: ${error.message}`);
        if (error.statusCode === 403) return res.status(403).json({ error: 'Unauthorized' });
        if (error.code === 404) return res.status(404).json({ error: 'Automation not found' });
        return res.json({
            destination: getCollectorDestinationDefaults(),
            warning: 'Collector destination storage is unavailable'
        });
    }
});

router.put('/instagram/automations/:id/email-collector-destination', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const automation = await getOwnedAutomationDocument(databases, req.user.$id, req.params.id);
        const existingDocument = await loadCollectorDestinationDocument(databases, automation);

        const destinationType = normalizeCollectorDestinationType(req.body?.destination_type);
        if (!destinationType) {
            return res.status(400).json({ error: 'destination_type must be "sheet" or "webhook"' });
        }

        const sheetLink = destinationType === 'sheet' ? String(req.body?.sheet_link || '').trim() : '';
        const webhookUrl = destinationType === 'webhook' ? String(req.body?.webhook_url || '').trim() : '';

        if (destinationType === 'sheet' && !sheetLink) {
            return res.status(400).json({ error: 'sheet_link is required for Google Sheets destinations' });
        }
        if (destinationType === 'webhook' && !webhookUrl) {
            return res.status(400).json({ error: 'webhook_url is required for webhook destinations' });
        }

        const existingResponse = normalizeCollectorDestinationResponse(existingDocument);
        const destinationChanged = existingResponse.destination_type !== destinationType
            || existingResponse.sheet_link !== sheetLink
            || existingResponse.webhook_url !== webhookUrl;
        const serviceAccountEmail = getCollectorDestinationDefaults().service_account_email;
        const nextDestinationJson = destinationChanged
            ? {
                verified: false,
                verified_at: null,
                verification_error: null,
                service_account_email: serviceAccountEmail
            }
            : {
                ...existingResponse.destination_json,
                service_account_email: serviceAccountEmail
            };

        const savedDoc = await persistCollectorDestinationDocument(databases, automation, {
            user_id: String(automation.user_id || '').trim(),
            account_id: String(automation.account_id || '').trim(),
            automation_id: String(automation.$id || '').trim(),
            destination_type: destinationType,
            sheet_link: sheetLink || null,
            webhook_url: webhookUrl || null,
            destination_id: destinationChanged ? null : (existingResponse.destination_id || null),
            destination_json: JSON.stringify(nextDestinationJson),
            updated_at: new Date().toISOString()
        }, existingDocument);

        res.json({
            destination: normalizeCollectorDestinationResponse(savedDoc)
        });
    } catch (error) {
        console.error(`Save Email Collector Destination Error: ${error.message}`);
        if (error.statusCode === 403) return res.status(403).json({ error: 'Unauthorized' });
        if (error.code === 404) return res.status(404).json({ error: 'Automation not found' });
        if (isMissingCollectionError(error)) {
            return res.status(500).json({ error: 'automation_collect_destinations collection is not available' });
        }
        res.status(500).json({ error: 'Failed to save email collector destination' });
    }
});

router.post('/instagram/automations/:id/email-collector-destination/verify', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const automation = await getOwnedAutomationDocument(databases, req.user.$id, req.params.id);
        const existingDocument = await loadCollectorDestinationDocument(databases, automation);
        if (!existingDocument) {
            return res.status(400).json({ error: 'Save the destination before verifying it' });
        }

        const normalizedDestination = normalizeCollectorDestinationResponse(existingDocument);
        const now = new Date().toISOString();
        const destinationJson = {
            ...normalizedDestination.destination_json,
            verified: false,
            verified_at: null,
            verification_error: null,
            service_account_email: getCollectorDestinationDefaults().service_account_email
        };
        let destinationId = normalizedDestination.destination_id || null;

        if (normalizedDestination.destination_type === 'sheet') {
            if (!normalizedDestination.sheet_link) {
                return res.status(400).json({ error: 'sheet_link is required before verification' });
            }
            const metadata = await loadSpreadsheetMetadata(normalizedDestination.sheet_link);
            destinationId = `${metadata.spreadsheetId}::${metadata.sheetGid}`;
            Object.assign(destinationJson, {
                verified: true,
                verified_at: now,
                spreadsheet_id: metadata.spreadsheetId,
                spreadsheet_title: metadata.spreadsheetTitle,
                sheet_gid: metadata.sheetGid,
                sheet_title: metadata.sheetTitle
            });
        } else if (normalizedDestination.destination_type === 'webhook') {
            if (!normalizedDestination.webhook_url) {
                return res.status(400).json({ error: 'webhook_url is required before verification' });
            }
            const samplePayload = buildCollectorVerifySamplePayload(automation);
            const webhookResponse = await sendWebhookPayload(normalizedDestination.webhook_url, samplePayload);
            Object.assign(destinationJson, {
                verified: true,
                verified_at: now,
                last_verify_status: webhookResponse?.status || null,
                last_verify_sample: samplePayload
            });
        } else {
            return res.status(400).json({ error: 'destination_type must be "sheet" or "webhook"' });
        }

        const savedDoc = await persistCollectorDestinationDocument(databases, automation, {
            destination_type: normalizedDestination.destination_type,
            sheet_link: normalizedDestination.sheet_link || null,
            webhook_url: normalizedDestination.webhook_url || null,
            destination_id: destinationId,
            destination_json: JSON.stringify(destinationJson),
            updated_at: now
        }, existingDocument);

        res.json({
            destination: normalizeCollectorDestinationResponse(savedDoc)
        });
    } catch (error) {
        console.error(`Verify Email Collector Destination Error: ${error.message}`);
        if (error.statusCode === 403) return res.status(403).json({ error: 'Unauthorized' });
        if (error.code === 404) return res.status(404).json({ error: 'Automation not found' });
        if (isMissingCollectionError(error)) {
            return res.status(500).json({ error: 'automation_collect_destinations collection is not available' });
        }
        res.status(400).json({ error: error.message || 'Failed to verify email collector destination' });
    }
});

// DELETE automation
router.delete('/instagram/automations/:id', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const existing = await databases.getDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, req.params.id);
        if (existing.user_id !== req.user.$id) return res.status(403).json({ error: 'Unauthorized' });



        try {
            await syncKeywordRecords(databases, {
                accountId: existing.account_id,
                automationId: existing.$id,
                automationType: existing.automation_type || 'dm',
                keywords: [],
                matchType: existing.keyword_match_type || 'exact'
            });
        } catch (e) {
            console.error(`Keyword cleanup failed: ${e.message}`);
        }

        await databases.deleteDocument(
            process.env.APPWRITE_DATABASE_ID,
            AUTOMATIONS_COLLECTION_ID,
            req.params.id
        );
        res.json({ message: 'Automation deleted' });
    } catch (err) {
        console.error(`Delete Automation Error: ${err.message}`);
        if (err.code === 404) return res.status(404).json({ error: 'Automation not found' });
        res.status(500).json({ error: 'Failed to delete automation' });
    }
});

// ============================================================================
// REPLY TEMPLATES
// ============================================================================
// GET all templates (list)
router.get('/instagram/reply-templates', loginRequired, async (req, res) => {
    try {
        const { full, account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const account = accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id));
        if (!account) return res.status(404).json({ error: 'Account not found' });
        const targetAccountId = getIgProfessionalAccountId(account);

        migrateLegacyReplyTemplatesForAccount(databases, req.user.$id, targetAccountId);

        const queries = [Query.equal('user_id', req.user.$id), Query.equal('account_id', targetAccountId), Query.orderDesc('$createdAt'), Query.limit(100)];

        const result = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, REPLY_TEMPLATES_COLLECTION_ID, queries);
        const automationsByTemplate = await getAutomationsByTemplateSafe(
            databases,
            [Query.equal('user_id', req.user.$id), Query.equal('account_id', targetAccountId)],
            'reply templates list'
        );

        const templates = result.documents.map(doc => {
            const linkedAutomations = automationsByTemplate.get(doc.$id) || [];
            const t = {
                id: doc.$id,
                name: doc.name,
                type: doc.template_type,
                template_type: doc.template_type,
                template_data: {},
                linked_automations: linkedAutomations,
                automation_count: linkedAutomations.length
            };
            if (full !== 'false') {
                try { t.template_data = typeof doc.template_data === 'string' ? JSON.parse(doc.template_data) : (doc.template_data || {}); } catch (e) { t.template_data = {}; }
            }
            return t;
        });

        res.json({ templates });
    } catch (err) {
        console.error(`Fetch Templates Error: ${err.message}`, err);
        res.status(500).json({ error: 'Failed to fetch templates', details: err.message });
    }
});

// GET single template
router.get('/instagram/reply-templates/:id', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const doc = await databases.getDocument(process.env.APPWRITE_DATABASE_ID, REPLY_TEMPLATES_COLLECTION_ID, req.params.id);
        if (doc.user_id !== req.user.$id) return res.status(403).json({ error: 'Unauthorized' });
        const resolvedAccount = await resolveReplyTemplateAccount(databases, req.user.$id, doc, req.query.account_id);
        if (resolvedAccount.error) {
            return res.status(resolvedAccount.status).json({ error: resolvedAccount.error });
        }

        let templateData = {};
        try { templateData = typeof doc.template_data === 'string' ? JSON.parse(doc.template_data) : (doc.template_data || {}); } catch (e) { }
        const linkedAutomations = (
            await getAutomationsByTemplateSafe(
                databases,
                [Query.equal('user_id', req.user.$id), Query.equal('account_id', resolvedAccount.accountId), Query.equal('template_id', doc.$id)],
                'reply template detail'
            )
        ).get(doc.$id) || [];

        res.json({
            id: doc.$id,
            name: doc.name,
            type: doc.template_type,
            template_type: doc.template_type,
            template_data: templateData,
            linked_automations: linkedAutomations,
            automation_count: linkedAutomations.length
        });
    } catch (err) {
        console.error(`Get Template Error: ${err.message}`);
        if (err.code === 404) return res.status(404).json({ error: 'Template not found' });
        res.status(500).json({ error: 'Failed to fetch template' });
    }
});

// CREATE template
router.post('/instagram/reply-templates', loginRequired, async (req, res) => {
    try {
        const { name, template_type, template_data, account_id } = req.body;
        if (!name || !template_type || !account_id) return res.status(400).json({ error: 'name, template_type and account_id are required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const account = accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id));
        if (!account) return res.status(404).json({ error: 'Account not found' });
        const targetAccountId = getIgProfessionalAccountId(account);

        const nameNormalized = normalizeTitle(name);
        const duplicate = await hasDuplicateTemplateName(databases, { userId: req.user.$id, accountId: targetAccountId, nameNormalized });
        if (duplicate) {
            return res.status(400).json({ error: 'Duplicate name', field: 'name' });
        }

        const docData = {
            user_id: req.user.$id,
            account_id: targetAccountId,
            name: name.trim(),
            name_normalized: nameNormalized,
            template_type,
            template_data: JSON.stringify(template_data || {})
        };

        const doc = await databases.createDocument(
            process.env.APPWRITE_DATABASE_ID,
            REPLY_TEMPLATES_COLLECTION_ID,
            ID.unique(),
            docData,
            [Permission.read(Role.user(req.user.$id))]
        );

        res.status(201).json({
            id: doc.$id,
            name: doc.name,
            type: doc.template_type,
            template_type: doc.template_type,
            template_data: template_data || {},
            linked_automations: [],
            automation_count: 0
        });
    } catch (err) {
        console.error(`Create Template Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

// UPDATE template
router.patch('/instagram/reply-templates/:id', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const existing = await databases.getDocument(process.env.APPWRITE_DATABASE_ID, REPLY_TEMPLATES_COLLECTION_ID, req.params.id);
        if (existing.user_id !== req.user.$id) return res.status(403).json({ error: 'Unauthorized' });
        const resolvedAccount = await resolveReplyTemplateAccount(databases, req.user.$id, existing, req.query.account_id);
        if (resolvedAccount.error) {
            return res.status(resolvedAccount.status).json({ error: resolvedAccount.error });
        }
        if (req.body.account_id && req.body.account_id !== existing.account_id) {
            return res.status(400).json({ error: 'account_id cannot be changed' });
        }

        const updateData = {};
        if (req.body.name !== undefined) {
            const nameNormalized = normalizeTitle(req.body.name);
            const duplicate = await hasDuplicateTemplateName(databases, { userId: req.user.$id, accountId: existing.account_id, nameNormalized, excludeId: existing.$id });
            if (duplicate) {
                return res.status(400).json({ error: 'Duplicate name', field: 'name' });
            }
            updateData.name = req.body.name.trim();
            updateData.name_normalized = nameNormalized;
        }
        if (req.body.template_type !== undefined) updateData.template_type = req.body.template_type;
        if (req.body.template_data !== undefined) updateData.template_data = JSON.stringify(req.body.template_data);

        const doc = await databases.updateDocument(process.env.APPWRITE_DATABASE_ID, REPLY_TEMPLATES_COLLECTION_ID, req.params.id, updateData);

        let templateData = {};
        try { templateData = typeof doc.template_data === 'string' ? JSON.parse(doc.template_data) : (doc.template_data || {}); } catch (e) { }
        const linkedAutomations = (
            await getAutomationsByTemplateSafe(
                databases,
                [Query.equal('user_id', req.user.$id), Query.equal('account_id', resolvedAccount.accountId), Query.equal('template_id', doc.$id)],
                'reply template update'
            )
        ).get(doc.$id) || [];

        res.json({
            id: doc.$id,
            name: doc.name,
            type: doc.template_type,
            template_type: doc.template_type,
            template_data: templateData,
            linked_automations: linkedAutomations,
            automation_count: linkedAutomations.length
        });
    } catch (err) {
        console.error(`Update Template Error: ${err.message}`);
        if (err.code === 404) return res.status(404).json({ error: 'Template not found' });
        res.status(500).json({ error: 'Failed to update template' });
    }
});

// DELETE template
router.delete('/instagram/reply-templates/:id', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const existing = await databases.getDocument(process.env.APPWRITE_DATABASE_ID, REPLY_TEMPLATES_COLLECTION_ID, req.params.id);
        if (existing.user_id !== req.user.$id) return res.status(403).json({ error: 'Unauthorized' });
        const resolvedAccount = await resolveReplyTemplateAccount(databases, req.user.$id, existing, req.query.account_id);
        if (resolvedAccount.error) {
            return res.status(resolvedAccount.status).json({ error: resolvedAccount.error });
        }

        const linked = (
            await getAutomationsByTemplateSafe(
                databases,
                [Query.equal('user_id', req.user.$id), Query.equal('account_id', resolvedAccount.accountId), Query.equal('template_id', existing.$id)],
                'reply template delete'
            )
        ).get(existing.$id) || [];

        if (linked.length > 0) {
            return res.status(400).json({
                error: 'Template is linked to automations',
                linked: linked
            });
        }

        await databases.deleteDocument(process.env.APPWRITE_DATABASE_ID, REPLY_TEMPLATES_COLLECTION_ID, req.params.id);
        res.json({ message: 'Template deleted' });
    } catch (err) {
        console.error(`Delete Template Error: ${err.message}`);
        if (err.code === 404) return res.status(404).json({ error: 'Template not found' });
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

// ============================================================================
// INBOX MENU
// ============================================================================
const INBOX_MENU_FOLLOWERS_ONLY_DEFAULT = 'Thanks for your message 🙂 Please follow this account first, then tap "I\'ve Followed" to continue.';
const INBOX_MENU_PRIMARY_BUTTON_DEFAULT = '👤 Follow Account';
const INBOX_MENU_SECONDARY_BUTTON_DEFAULT = "✅ I've Followed";

const listInboxMenuDocuments = async (databases, { userId, accountIds, limit = 50 }) => {
    const uniqueAccountIds = Array.from(new Set(
        (Array.isArray(accountIds) ? accountIds : [accountIds])
            .map((value) => String(value || '').trim())
            .filter(Boolean)
    ));

    const queries = [
        Query.equal('user_id', String(userId)),
        Query.equal('automation_type', 'inbox_menu'),
        Query.equal('trigger_type', 'menu_config'),
        Query.orderAsc('menu_item_order'),
        Query.orderAsc('$createdAt'),
        Query.limit(limit)
    ];

    if (uniqueAccountIds.length === 1) {
        queries.splice(1, 0, Query.equal('account_id', uniqueAccountIds[0]));
    } else if (uniqueAccountIds.length > 1) {
        queries.splice(1, 0, Query.equal('account_id', uniqueAccountIds));
    }

    const result = await databases.listDocuments(
        process.env.APPWRITE_DATABASE_ID,
        AUTOMATIONS_COLLECTION_ID,
        queries
    );

    return {
        ...result,
        _collectionId: AUTOMATIONS_COLLECTION_ID
    };
};

const buildReplyTemplateMap = async (databases, { userId, accountIds }) => {
    const uniqueAccountIds = Array.from(new Set(
        (Array.isArray(accountIds) ? accountIds : [accountIds])
            .map((value) => String(value || '').trim())
            .filter(Boolean)
    ));

    const queries = [
        Query.equal('user_id', String(userId)),
        Query.limit(100)
    ];

    if (uniqueAccountIds.length === 1) {
        queries.splice(1, 0, Query.equal('account_id', uniqueAccountIds[0]));
    } else if (uniqueAccountIds.length > 1) {
        queries.splice(1, 0, Query.equal('account_id', uniqueAccountIds));
    }

    const result = await databases.listDocuments(
        process.env.APPWRITE_DATABASE_ID,
        REPLY_TEMPLATES_COLLECTION_ID,
        queries
    ).catch(() => ({ documents: [] }));

    const templateMap = new Map();
    (result.documents || []).forEach((doc) => {
        templateMap.set(String(doc.$id), {
            ...doc,
            parsedTemplateData: parseMaybeJson(doc.template_data, {})
        });
    });
    return templateMap;
};

const hydrateInboxMenuItem = (item, templateMap) => {
    if (!item || typeof item !== 'object') return null;

    const hydrated = {
        ...item,
        title: String(item.title || '').trim(),
        type: item.type === 'web_url' ? 'web_url' : 'postback',
        followers_only: Boolean(item.followers_only)
    };

    if (hydrated.type === 'web_url') {
        hydrated.url = String(item.url || '').trim();
        hydrated.webview_height_ratio = String(item.webview_height_ratio || 'full').trim() || 'full';
        return hydrated;
    }

    const templateId = String(item.template_id || item.payload || '').trim();
    const template = templateId ? templateMap.get(templateId) : null;
    hydrated.payload = templateId;
    hydrated.template_id = templateId || undefined;
    hydrated.template_name = template?.name || undefined;
    hydrated.template_type = item.template_type || template?.template_type || undefined;
    hydrated.template_data = item.template_data || template?.parsedTemplateData || undefined;
    return hydrated;
};

const buildInboxMenuFromAutomationDocuments = (documents, templateMap) => (
    (Array.isArray(documents) ? documents : [])
        .slice()
        .sort((a, b) => {
            const orderA = Number(a?.menu_item_order ?? 0);
            const orderB = Number(b?.menu_item_order ?? 0);
            if (orderA !== orderB) return orderA - orderB;
            return String(a?.$createdAt || '').localeCompare(String(b?.$createdAt || ''));
        })
        .map((doc) => {
            const type = String(doc?.menu_item_type || '').trim().toLowerCase() === 'web_url' ? 'web_url' : 'postback';
            const baseItem = {
                automation_id: String(doc?.$id || '').trim(),
                title: String(doc?.title || '').trim(),
                type,
                followers_only: Boolean(doc?.followers_only),
                followers_only_message: String(doc?.followers_only_message || INBOX_MENU_FOLLOWERS_ONLY_DEFAULT).trim(),
                followers_only_primary_button_text: String(doc?.followers_only_primary_button_text || INBOX_MENU_PRIMARY_BUTTON_DEFAULT).trim(),
                followers_only_secondary_button_text: String(doc?.followers_only_secondary_button_text || INBOX_MENU_SECONDARY_BUTTON_DEFAULT).trim(),
                once_per_user_24h: Boolean(doc?.once_per_user_24h),
                collect_email_enabled: Boolean(doc?.collect_email_enabled),
                collect_email_only_gmail: Boolean(doc?.collect_email_only_gmail),
                collect_email_prompt_message: String(doc?.collect_email_prompt_message || COLLECT_EMAIL_PROMPT_DEFAULT).trim(),
                collect_email_fail_retry_message: String(doc?.collect_email_fail_retry_message || COLLECT_EMAIL_FAIL_RETRY_DEFAULT).trim(),
                collect_email_success_reply_message: String(doc?.collect_email_success_reply_message || COLLECT_EMAIL_SUCCESS_DEFAULT).trim(),
                seen_typing_enabled: Boolean(doc?.seen_typing_enabled)
            };

            if (type === 'web_url') {
                return hydrateInboxMenuItem({
                    ...baseItem,
                    url: String(doc?.media_url || '').trim(),
                    webview_height_ratio: String(doc?.comment_reply || 'full').trim() || 'full'
                }, templateMap);
            }

            return hydrateInboxMenuItem({
                ...baseItem,
                payload: String(doc?.template_id || '').trim(),
                template_id: String(doc?.template_id || '').trim(),
                template_type: doc?.template_type || undefined
            }, templateMap);
        })
        .filter(Boolean)
);

const listConvoStarterDocuments = async (databases, { userId, accountIds, limit = 10 }) => {
    const normalizedAccountIds = Array.from(new Set(
        (Array.isArray(accountIds) ? accountIds : [accountIds])
            .map((value) => String(value || '').trim())
            .filter(Boolean)
    ));

    const queries = [
        Query.equal('user_id', String(userId)),
        Query.equal('automation_type', 'convo_starter'),
        Query.limit(limit)
    ];

    if (normalizedAccountIds.length === 1) {
        queries.splice(1, 0, Query.equal('account_id', normalizedAccountIds[0]));
    } else if (normalizedAccountIds.length > 1) {
        queries.splice(1, 0, Query.equal('account_id', normalizedAccountIds));
    }

    const result = await databases.listDocuments(
        process.env.APPWRITE_DATABASE_ID,
        AUTOMATIONS_COLLECTION_ID,
        queries
    ).catch(() => ({ documents: [] }));

    return {
        ...result,
        _collectionId: AUTOMATIONS_COLLECTION_ID
    };
};

const buildConvoStartersFromAutomationDocuments = (documents, templateMap) => (
    (Array.isArray(documents) ? documents : [])
        .slice()
        .sort((a, b) => String(a?.$createdAt || '').localeCompare(String(b?.$createdAt || '')))
        .map((doc) => {
            const templateId = String(doc?.template_id || '').trim();
            const template = templateId ? templateMap.get(templateId) : null;

            return {
                question: String(doc?.title || '').trim(),
                payload: templateId || String(doc?.template_content || '').trim(),
                template_id: templateId || undefined,
                template_name: template?.name || undefined,
                template_type: doc?.template_type || template?.template_type || undefined,
                template_data: template?.parsedTemplateData || undefined,
                followers_only: Boolean(doc?.followers_only),
                followers_only_message: String(doc?.followers_only_message || ''),
                followers_only_primary_button_text: String(doc?.followers_only_primary_button_text || ''),
                followers_only_secondary_button_text: String(doc?.followers_only_secondary_button_text || ''),
                suggest_more_enabled: Boolean(doc?.suggest_more_enabled),
                once_per_user_24h: Boolean(doc?.once_per_user_24h),
                collect_email_enabled: Boolean(doc?.collect_email_enabled),
                collect_email_only_gmail: Boolean(doc?.collect_email_only_gmail),
                collect_email_prompt_message: String(doc?.collect_email_prompt_message || ''),
                collect_email_fail_retry_message: String(doc?.collect_email_fail_retry_message || ''),
                collect_email_success_reply_message: String(doc?.collect_email_success_reply_message || ''),
                seen_typing_enabled: Boolean(doc?.seen_typing_enabled)
            };
        })
        .filter((item) => item.question)
);

const normalizeInboxMenuForComparison = (menuItems) => (
    (Array.isArray(menuItems) ? menuItems : [])
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const type = item.type === 'web_url' ? 'web_url' : 'postback';
            const normalized = {
                type,
                title: String(item.title || '').trim()
            };

            if (type === 'web_url') {
                normalized.url = String(item.url || '').trim();
                normalized.webview_height_ratio = String(item.webview_height_ratio || 'full').trim() || 'full';
            } else {
                normalized.payload = String(item.payload || item.template_id || '').trim();
            }

            return normalized;
        })
        .filter(Boolean)
);

router.get('/instagram/inbox-menu', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const igAccount = accounts.documents.find(a => matchesIgAccountIdentifier(a, account_id));

        if (!igAccount) return res.status(404).json({ error: 'Account not found' });
        const normalizedAccountId = getIgProfessionalAccountId(igAccount);
        const templateMap = await buildReplyTemplateMap(databases, {
            userId: req.user.$id,
            accountIds: [normalizedAccountId, account_id]
        });

        // Get DB menu
        let dbMenu = [];
        try {
            const automationDocs = await listInboxMenuDocuments(databases, {
                userId: req.user.$id,
                accountIds: [normalizedAccountId, account_id],
                limit: 50
            });
            dbMenu = buildInboxMenuFromAutomationDocuments(automationDocs.documents, templateMap);
        } catch (e) {
            dbMenu = [];
        }

        // Fallback for older environments that still store inbox menu in a separate collection.
        if (dbMenu.length === 0) {
            try {
                const menuDocs = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, INBOX_MENUS_COLLECTION_ID,
                    [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)]);
                if (menuDocs.total > 0) {
                    const rawMenu = typeof menuDocs.documents[0].menu_items === 'string'
                        ? JSON.parse(menuDocs.documents[0].menu_items)
                        : (menuDocs.documents[0].menu_items || []);
                    dbMenu = (Array.isArray(rawMenu) ? rawMenu : [])
                        .map((item) => hydrateInboxMenuItem(item, templateMap))
                        .filter(Boolean);
                }
            } catch (e) {
                dbMenu = [];
            }
        }

        // Try fetching IG menu from Instagram API
        let igMenu = [];
        try {
            const accessToken = igAccount.access_token;
            const igResponse = await axios.get(`https://graph.instagram.com/v24.0/me/messenger_profile`, {
                params: { fields: 'persistent_menu', access_token: accessToken }
            });
            const persistentMenu = igResponse.data?.data?.[0]?.persistent_menu;
            if (persistentMenu && Array.isArray(persistentMenu)) {
                const defaultMenu = persistentMenu.find(m => m.locale === 'default') || persistentMenu[0];
                igMenu = defaultMenu?.call_to_actions || [];
            }
        } catch (e) { /* IG menu fetch may fail - not all accounts support it */ }

        // Determine status
        const comparableDbMenu = normalizeInboxMenuForComparison(dbMenu);
        const comparableIgMenu = normalizeInboxMenuForComparison(igMenu);
        let status = 'none';
        if (comparableDbMenu.length > 0 && comparableIgMenu.length > 0) {
            status = JSON.stringify(comparableDbMenu) === JSON.stringify(comparableIgMenu) ? 'match' : 'mismatch';
        } else if (comparableDbMenu.length > 0) {
            status = 'db_only';
        } else if (comparableIgMenu.length > 0) {
            status = 'ig_only';
        }

        res.json({
            ig_menu: igMenu,
            db_menu: dbMenu,
            is_synced: status === 'match',
            status,
            issue: null,
            account_id
        });
    } catch (err) {
        console.error(`Inbox Menu Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch inbox menu' });
    }
});

// Save inbox menu
router.post('/instagram/inbox-menu', loginRequired, async (req, res) => {
    try {
        const { account_id, menu_items, action } = req.body;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const igAccount = accounts.documents.find(a => matchesIgAccountIdentifier(a, account_id));
        if (!igAccount) return res.status(404).json({ error: 'Account not found' });
        const normalizedAccountId = getIgProfessionalAccountId(igAccount);

        // Duplicate title validation (case-insensitive)
        if (Array.isArray(menu_items)) {
            const seen = new Set();
            for (const item of menu_items) {
                const title = normalizeTitle(item?.title || '');
                if (!title) continue;
                if (seen.has(title)) {
                    return res.status(400).json({ error: 'Duplicate menu title', field: 'title' });
                }
                seen.add(title);
            }
        }

        const menuItems = Array.isArray(menu_items) ? menu_items : [];
        const existingDocs = await listInboxMenuDocuments(databases, {
            userId: req.user.$id,
            accountIds: [normalizedAccountId, account_id],
            limit: 50
        }).catch(() => ({ documents: [] }));

        for (const doc of (existingDocs.documents || [])) {
            await databases.deleteDocument(
                process.env.APPWRITE_DATABASE_ID,
                AUTOMATIONS_COLLECTION_ID,
                doc.$id
            );
        }

        if (menuItems.length > 0) {
            const automationCollectionInfo = await getCollectionAttributeInfo(databases, AUTOMATIONS_COLLECTION_ID);

            for (let index = 0; index < menuItems.length; index += 1) {
                const item = menuItems[index] || {};
                const isWebUrl = String(item.type || '').trim().toLowerCase() === 'web_url';
                const templateId = isWebUrl ? '' : String(item.payload || item.template_id || '').trim();
                const title = toSafeString(item.title, 255).trim();
                const normalizedAutoReplyItem = isWebUrl
                    ? {}
                    : {
                        followers_only: item.followers_only === true,
                        followers_only_message: String(item.followers_only_message || INBOX_MENU_FOLLOWERS_ONLY_DEFAULT).trim(),
                        followers_only_primary_button_text: String(item.followers_only_primary_button_text || INBOX_MENU_PRIMARY_BUTTON_DEFAULT).trim(),
                        followers_only_secondary_button_text: String(item.followers_only_secondary_button_text || INBOX_MENU_SECONDARY_BUTTON_DEFAULT).trim(),
                        suggest_more_enabled: item.suggest_more_enabled === true,
                        once_per_user_24h: item.once_per_user_24h === true,
                        collect_email_enabled: item.collect_email_enabled === true,
                        collect_email_only_gmail: item.collect_email_only_gmail === true,
                        collect_email_prompt_message: String(item.collect_email_prompt_message || COLLECT_EMAIL_PROMPT_DEFAULT).trim(),
                        collect_email_fail_retry_message: String(item.collect_email_fail_retry_message || COLLECT_EMAIL_FAIL_RETRY_DEFAULT).trim(),
                        collect_email_success_reply_message: String(item.collect_email_success_reply_message || COLLECT_EMAIL_SUCCESS_DEFAULT).trim(),
                        seen_typing_enabled: item.seen_typing_enabled === true
                    };

                if (!isWebUrl) {
                    const featureAccessError = await enforceAutomationFeatureAccess(
                        databases,
                        req.user.$id,
                        normalizedAutoReplyItem
                    );
                    if (featureAccessError) {
                        return res.status(403).json(featureAccessError);
                    }
                }

                const docData = sanitizePayloadForCollection({
                    user_id: req.user.$id,
                    account_id: normalizedAccountId,
                    automation_type: 'inbox_menu',
                    title,
                    title_normalized: normalizeTitle(title),
                    trigger_type: 'menu_config',
                    template_id: templateId || null,
                    template_type: isWebUrl ? null : (item.template_type ? toSafeString(item.template_type, 50) : null),
                    template_content: isWebUrl ? null : (templateId || null),
                    buttons: '[]',
                    replies: '[]',
                    template_elements: null,
                    media_url: isWebUrl ? toSafeString(item.url, MEDIA_URL_MAX) : null,
                    media_id: String(index),
                    menu_item_type: isWebUrl ? 'web_url' : 'postback',
                    menu_item_order: index,
                    followers_only: isWebUrl ? false : normalizedAutoReplyItem.followers_only === true,
                    followers_only_message: isWebUrl
                        ? ''
                        : (normalizedAutoReplyItem.followers_only
                            ? normalizedAutoReplyItem.followers_only_message
                            : ''),
                    followers_only_primary_button_text: isWebUrl
                        ? ''
                        : (normalizedAutoReplyItem.followers_only
                            ? normalizedAutoReplyItem.followers_only_primary_button_text
                            : ''),
                    followers_only_secondary_button_text: isWebUrl
                        ? ''
                        : (normalizedAutoReplyItem.followers_only
                            ? normalizedAutoReplyItem.followers_only_secondary_button_text
                            : ''),
                    keyword_match_type: 'exact',
                    is_active: true,
                    private_reply_enabled: true,
                    suggest_more_enabled: isWebUrl ? false : normalizedAutoReplyItem.suggest_more_enabled === true,
                    share_to_admin_enabled: false,
                    once_per_user_24h: isWebUrl ? false : normalizedAutoReplyItem.once_per_user_24h === true,
                    story_scope: 'shown',
                    collect_email_enabled: isWebUrl ? false : normalizedAutoReplyItem.collect_email_enabled === true,
                    collect_email_only_gmail: isWebUrl ? false : normalizedAutoReplyItem.collect_email_only_gmail === true,
                    collect_email_prompt_message: isWebUrl ? '' : normalizedAutoReplyItem.collect_email_prompt_message,
                    collect_email_fail_retry_message: isWebUrl ? '' : normalizedAutoReplyItem.collect_email_fail_retry_message,
                    collect_email_success_reply_message: isWebUrl ? '' : normalizedAutoReplyItem.collect_email_success_reply_message,
                    seen_typing_enabled: isWebUrl ? false : normalizedAutoReplyItem.seen_typing_enabled === true,
                    comment_reply: isWebUrl
                        ? toSafeString(item.webview_height_ratio || 'full', 1000)
                        : '__special_meta__:{"menu_item_type":"auto_reply"}'
                }, automationCollectionInfo);

                await databases.createDocument(
                    process.env.APPWRITE_DATABASE_ID,
                    AUTOMATIONS_COLLECTION_ID,
                    ID.unique(),
                    docData,
                    [Permission.read(Role.user(req.user.$id))]
                );
            }
        }

        // Publish to Instagram (action=save means publish)
        if (action === 'save' && menuItems.length > 0) {
            try {
                if (igAccount) {
                    // Format for IG persistent menu API
                    const igMenuItems = menuItems.map(m => {
                        const item = { type: m.type, title: m.title };
                        if (m.type === 'web_url') {
                            item.url = m.url;
                            item.webview_height_ratio = m.webview_height_ratio || 'full';
                        } else if (m.type === 'postback') {
                            item.payload = m.payload || m.template_id || '';
                        }
                        return item;
                    });
                    await axios.post(`https://graph.instagram.com/v24.0/me/messenger_profile`, {
                        persistent_menu: [{
                            locale: 'default',
                            composer_input_disabled: false,
                            call_to_actions: igMenuItems
                        }]
                    }, {
                        params: { access_token: igAccount.access_token }
                    });
                }
            } catch (e) { console.error('Failed to publish menu to IG:', e.message); }
        }

        res.json({ message: 'Menu saved successfully', menu_items: menuItems });
    } catch (err) {
        console.error(`Save Inbox Menu Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to save inbox menu' });
    }
});

// Delete inbox menu
router.delete('/instagram/inbox-menu', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const igAccount = accounts.documents.find(a => matchesIgAccountIdentifier(a, account_id));
        if (!igAccount) return res.status(404).json({ error: 'Account not found' });
        const normalizedAccountId = getIgProfessionalAccountId(igAccount);

        const existing = await listInboxMenuDocuments(databases, {
            userId: req.user.$id,
            accountIds: [normalizedAccountId, account_id],
            limit: 50
        }).catch(() => ({ documents: [] }));

        for (const doc of (existing.documents || [])) {
            await databases.deleteDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, doc.$id);
        }

        // Also delete from Instagram
        try {
            if (igAccount) {
                await axios.delete(`https://graph.instagram.com/v24.0/me/messenger_profile`, {
                    params: { access_token: igAccount.access_token },
                    data: { fields: ['persistent_menu'] }
                });
            }
        } catch (e) { /* ignore IG delete errors */ }

        res.json({ message: 'Menu deleted' });
    } catch (err) {
        console.error(`Delete Inbox Menu Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to delete inbox menu' });
    }
});

// ============================================================================
// CONVO STARTERS
// ============================================================================
router.get('/instagram/convo-starters', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        // Verify account ownership
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const igAccount = accounts.documents.find(a => matchesIgAccountIdentifier(a, account_id));
        if (!igAccount) return res.status(404).json({ error: 'Account not found' });

        const normalizedAccountId = getIgProfessionalAccountId(igAccount);
        const templateMap = await buildReplyTemplateMap(databases, {
            userId: req.user.$id,
            accountIds: [normalizedAccountId, account_id]
        });

        let dbStarters = [];
        try {
            const starterAutomationDocs = await listConvoStarterDocuments(databases, {
                userId: req.user.$id,
                accountIds: [normalizedAccountId, account_id],
                limit: 20
            });
            dbStarters = buildConvoStartersFromAutomationDocuments(starterAutomationDocs.documents, templateMap);
        } catch (e) {
            dbStarters = [];
        }

        if (dbStarters.length === 0) {
            try {
                const starterDocs = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, CONVO_STARTERS_COLLECTION_ID,
                    [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)]);
                if (starterDocs.total > 0) {
                    try {
                        dbStarters = typeof starterDocs.documents[0].starters === 'string'
                            ? JSON.parse(starterDocs.documents[0].starters)
                            : (starterDocs.documents[0].starters || []);
                    } catch (e) {
                        dbStarters = [];
                    }
                }
            } catch (e) { }
        }

        // Try fetching from IG
        let igStarters = [];
        try {
            const igResponse = await axios.get(`https://graph.instagram.com/v24.0/me/messenger_profile`, {
                params: { fields: 'ice_breakers', access_token: igAccount.access_token }
            });
            const iceBreakers = igResponse.data?.data?.[0]?.ice_breakers;
            if (iceBreakers && Array.isArray(iceBreakers)) {
                igStarters = iceBreakers;
            }
        } catch (e) { }

        const comparableDbStarters = dbStarters.map((starter) => ({
            question: String(starter?.question || '').trim(),
            payload: String(starter?.payload || '').trim()
        }));
        const comparableIgStarters = igStarters.map((starter) => ({
            question: String(starter?.question || '').trim(),
            payload: String(starter?.payload || '').trim()
        }));

        let status = 'none';
        if (dbStarters.length > 0 && igStarters.length > 0) {
            status = JSON.stringify(comparableDbStarters) === JSON.stringify(comparableIgStarters) ? 'match' : 'mismatch';
        } else if (dbStarters.length > 0) {
            status = 'db_only';
        } else if (igStarters.length > 0) {
            status = 'ig_only';
        }

        res.json({
            ig_starters: igStarters,
            db_starters: dbStarters,
            is_synced: status === 'match',
            status,
            issue: null,
            account_id
        });
    } catch (err) {
        console.error(`Convo Starters Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch convo starters' });
    }
});

// Save convo starters
router.post('/instagram/convo-starters', loginRequired, async (req, res) => {
    try {
        const { account_id, starters, publish } = req.body;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const igAccount = accounts.documents.find(a => matchesIgAccountIdentifier(a, account_id));
        if (!igAccount) return res.status(404).json({ error: 'Account not found' });
        const normalizedAccountId = getIgProfessionalAccountId(igAccount);

        // Duplicate question validation (case-insensitive)
        if (Array.isArray(starters)) {
            const seen = new Set();
            for (const starter of starters) {
                const question = normalizeTitle(starter?.question || '');
                if (!question) continue;
                if (seen.has(question)) {
                    return res.status(400).json({ error: 'Duplicate question', field: 'question' });
                }
                seen.add(question);
            }
        }

        const normalizedStarters = (Array.isArray(starters) ? starters : []).map((starter) => {
            const templateId = String(starter?.template_id || starter?.payload || '').trim();
            const followersOnly = starter?.followers_only === true;
            const collectEmailEnabled = starter?.collect_email_enabled === true;
            return {
                question: String(starter?.question || '').trim(),
                payload: templateId,
                template_id: templateId || undefined,
                template_type: starter?.template_type || undefined,
                followers_only: followersOnly,
                followers_only_message: followersOnly
                    ? String(starter?.followers_only_message || FOLLOWERS_ONLY_MESSAGE_DEFAULT).trim()
                    : '',
                followers_only_primary_button_text: String(starter?.followers_only_primary_button_text || FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT).trim(),
                followers_only_secondary_button_text: String(starter?.followers_only_secondary_button_text || FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT).trim(),
                suggest_more_enabled: starter?.suggest_more_enabled === true,
                once_per_user_24h: starter?.once_per_user_24h === true,
                collect_email_enabled: collectEmailEnabled,
                collect_email_only_gmail: starter?.collect_email_only_gmail === true,
                collect_email_prompt_message: String(starter?.collect_email_prompt_message || COLLECT_EMAIL_PROMPT_DEFAULT).trim(),
                collect_email_fail_retry_message: String(starter?.collect_email_fail_retry_message || COLLECT_EMAIL_FAIL_RETRY_DEFAULT).trim(),
                collect_email_success_reply_message: String(starter?.collect_email_success_reply_message || COLLECT_EMAIL_SUCCESS_DEFAULT).trim(),
                seen_typing_enabled: starter?.seen_typing_enabled === true
            };
        }).filter((starter) => starter.question);

        for (const starter of normalizedStarters) {
            const featureAccessError = await enforceAutomationFeatureAccess(databases, req.user.$id, starter);
            if (featureAccessError) {
                return res.status(403).json(featureAccessError);
            }
        }

        const existingAutomationDocs = await listConvoStarterDocuments(databases, {
            userId: req.user.$id,
            accountIds: [normalizedAccountId, account_id],
            limit: 20
        }).catch(() => ({ documents: [] }));

        for (const doc of (existingAutomationDocs.documents || [])) {
            await databases.deleteDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, doc.$id);
        }

        const automationCollectionInfo = await getCollectionAttributeInfo(databases, AUTOMATIONS_COLLECTION_ID);
        for (const starter of normalizedStarters) {
            const docData = sanitizePayloadForCollection({
                user_id: req.user.$id,
                account_id: normalizedAccountId,
                automation_type: 'convo_starter',
                title: toSafeString(starter.question, 255),
                title_normalized: normalizeTitle(starter.question),
                trigger_type: 'conversation_starter',
                template_id: starter.template_id ? toSafeString(starter.template_id, 255) : null,
                template_type: starter.template_type ? toSafeString(starter.template_type, 50) : null,
                template_content: starter.template_id ? toSafeString(starter.template_id, 255) : null,
                buttons: '[]',
                replies: '[]',
                template_elements: null,
                media_url: null,
                media_id: null,
                keyword: '',
                keywords: '[]',
                keyword_match_type: 'exact',
                is_active: true,
                followers_only: starter.followers_only === true,
                followers_only_message: starter.followers_only_message || '',
                followers_only_primary_button_text: starter.followers_only_primary_button_text || FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT,
                followers_only_secondary_button_text: starter.followers_only_secondary_button_text || FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT,
                suggest_more_enabled: starter.suggest_more_enabled === true,
                private_reply_enabled: true,
                share_to_admin_enabled: false,
                once_per_user_24h: starter.once_per_user_24h === true,
                story_scope: 'shown',
                collect_email_enabled: starter.collect_email_enabled === true,
                collect_email_only_gmail: starter.collect_email_only_gmail === true,
                collect_email_prompt_message: starter.collect_email_prompt_message || COLLECT_EMAIL_PROMPT_DEFAULT,
                collect_email_fail_retry_message: starter.collect_email_fail_retry_message || COLLECT_EMAIL_FAIL_RETRY_DEFAULT,
                collect_email_success_reply_message: starter.collect_email_success_reply_message || COLLECT_EMAIL_SUCCESS_DEFAULT,
                seen_typing_enabled: starter.seen_typing_enabled === true,
                comment_reply: '',
                linked_media_id: null,
                linked_media_url: null
            }, automationCollectionInfo);

            await databases.createDocument(
                process.env.APPWRITE_DATABASE_ID,
                AUTOMATIONS_COLLECTION_ID,
                ID.unique(),
                docData,
                [Permission.read(Role.user(req.user.$id))]
            );
        }

        try {
            const queries = [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)];
            const existing = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, CONVO_STARTERS_COLLECTION_ID, queries);
            const docData = {
                user_id: req.user.$id,
                account_id,
                starters: JSON.stringify(normalizedStarters)
            };

            if (existing.total > 0) {
                await databases.updateDocument(process.env.APPWRITE_DATABASE_ID, CONVO_STARTERS_COLLECTION_ID, existing.documents[0].$id, docData);
            } else {
                await databases.createDocument(process.env.APPWRITE_DATABASE_ID, CONVO_STARTERS_COLLECTION_ID, ID.unique(), docData,
                    [Permission.read(Role.user(req.user.$id))]);
            }
        } catch (_) { }

        // Optionally publish to Instagram
        if (publish) {
            try {
                if (igAccount) {
                    await axios.post(`https://graph.instagram.com/v24.0/me/messenger_profile`, {
                        ice_breakers: normalizedStarters.map((starter) => ({
                            question: starter.question,
                            payload: starter.payload || starter.question
                        }))
                    }, {
                        params: { access_token: igAccount.access_token }
                    });
                }
            } catch (e) { console.error('Failed to publish convo starters to IG:', e.message); }
        }

        res.json({ message: 'Convo starters saved successfully' });
    } catch (err) {
        console.error(`Save Convo Starters Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to save convo starters' });
    }
});

// Delete convo starters
router.delete('/instagram/convo-starters', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const igAccount = accounts.documents.find(a => matchesIgAccountIdentifier(a, account_id));
        if (!igAccount) return res.status(404).json({ error: 'Account not found' });
        const normalizedAccountId = getIgProfessionalAccountId(igAccount);

        const existingAutomationDocs = await listConvoStarterDocuments(databases, {
            userId: req.user.$id,
            accountIds: [normalizedAccountId, account_id],
            limit: 20
        }).catch(() => ({ documents: [] }));

        for (const doc of (existingAutomationDocs.documents || [])) {
            await databases.deleteDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, doc.$id);
        }

        try {
            const existing = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, CONVO_STARTERS_COLLECTION_ID,
                [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)]);

            if (existing.total > 0) {
                await databases.deleteDocument(process.env.APPWRITE_DATABASE_ID, CONVO_STARTERS_COLLECTION_ID, existing.documents[0].$id);
            }
        } catch (_) { }

        res.json({ message: 'Convo starters deleted' });
    } catch (err) {
        console.error(`Delete Convo Starters Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to delete convo starters' });
    }
});

// ============================================================================
// MENTIONS CONFIG
// ============================================================================
router.get('/instagram/mentions-config', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const account = accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id));
        if (!account) return res.status(404).json({ error: 'Account not found or unauthorized' });
        const normalizedAccountId = getIgProfessionalAccountId(account);

        const result = await listMentionsDocuments(databases, {
            userId: req.user.$id,
            accountIds: [normalizedAccountId, account_id],
            limit: 1
        });

        if (result.total > 0) {
            const doc = result.documents[0];
            res.json({
                is_setup: true,
                is_active: doc.is_active !== false,
                template_id: doc.template_id || null,
                doc_id: doc.$id,
                followers_only: Boolean(doc.followers_only),
                followers_only_message: String(doc.followers_only_message || FOLLOWERS_ONLY_MESSAGE_DEFAULT).trim(),
                followers_only_primary_button_text: String(doc.followers_only_primary_button_text || FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT).trim(),
                followers_only_secondary_button_text: String(doc.followers_only_secondary_button_text || FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT).trim(),
                suggest_more_enabled: Boolean(doc.suggest_more_enabled),
                once_per_user_24h: Boolean(doc.once_per_user_24h),
                collect_email_enabled: Boolean(doc.collect_email_enabled),
                collect_email_only_gmail: Boolean(doc.collect_email_only_gmail),
                collect_email_prompt_message: String(doc.collect_email_prompt_message || COLLECT_EMAIL_PROMPT_DEFAULT).trim(),
                collect_email_fail_retry_message: String(doc.collect_email_fail_retry_message || COLLECT_EMAIL_FAIL_RETRY_DEFAULT).trim(),
                collect_email_success_reply_message: String(doc.collect_email_success_reply_message || COLLECT_EMAIL_SUCCESS_DEFAULT).trim(),
                seen_typing_enabled: Boolean(doc.seen_typing_enabled)
            });
        } else {
            res.json({ is_setup: false, is_active: false });
        }
    } catch (err) {
        if (!isMissingCollectionError(err)) {
            console.error(`Mentions Config Error: ${err.message}`);
        }
        res.json({ is_setup: false, is_active: false });
    }
});

router.post('/instagram/mentions-config', loginRequired, async (req, res) => {
    try {
        const { account_id, template_id, is_active } = req.body;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const account = accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id));
        if (!account) return res.status(404).json({ error: 'Account not found or unauthorized' });
        const normalizedAccountId = getIgProfessionalAccountId(account);

        const existing = await listMentionsDocuments(databases, {
            userId: req.user.$id,
            accountIds: [normalizedAccountId, account_id],
            limit: 1
        });

        const payload = {
            ...req.body,
            title: 'Mentions',
            automation_type: 'mentions',
            trigger_type: 'config',
            template_id: template_id || null,
            is_active: is_active !== undefined ? is_active : true,
            followers_only: req.body.followers_only === true,
            followers_only_message: req.body.followers_only
                ? (req.body.followers_only_message || FOLLOWERS_ONLY_MESSAGE_DEFAULT)
                : '',
            followers_only_primary_button_text: req.body.followers_only_primary_button_text || FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT,
            followers_only_secondary_button_text: req.body.followers_only_secondary_button_text || FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT,
            suggest_more_enabled: req.body.suggest_more_enabled === true,
            once_per_user_24h: req.body.once_per_user_24h === true,
            collect_email_enabled: req.body.collect_email_enabled === true,
            collect_email_only_gmail: req.body.collect_email_only_gmail === true,
            collect_email_prompt_message: req.body.collect_email_prompt_message || COLLECT_EMAIL_PROMPT_DEFAULT,
            collect_email_fail_retry_message: req.body.collect_email_fail_retry_message || COLLECT_EMAIL_FAIL_RETRY_DEFAULT,
            collect_email_success_reply_message: req.body.collect_email_success_reply_message || COLLECT_EMAIL_SUCCESS_DEFAULT,
            seen_typing_enabled: req.body.seen_typing_enabled === true
        };
        const validationErrors = validateAutomationPayload(payload);
        if (validationErrors.length > 0) {
            return res.status(400).json({ error: 'Validation failed', details: validationErrors });
        }

        const featureAccessError = await enforceAutomationFeatureAccess(databases, req.user.$id, payload);
        if (featureAccessError) {
            return res.status(403).json(featureAccessError);
        }

        const automationCollectionInfo = await getCollectionAttributeInfo(databases, AUTOMATIONS_COLLECTION_ID);
        const docData = sanitizePayloadForCollection({
            user_id: req.user.$id,
            account_id: normalizedAccountId,
            automation_type: 'mentions',
            title: 'Mentions',
            title_normalized: 'mentions',
            trigger_type: 'config',
            template_id: template_id || null,
            template_type: req.body.template_type ? toSafeString(req.body.template_type, 50) : null,
            template_content: template_id ? toSafeString(template_id, 255) : null,
            buttons: '[]',
            replies: '[]',
            template_elements: null,
            media_url: null,
            media_id: null,
            keyword: '',
            keywords: '[]',
            keyword_match_type: 'exact',
            is_active: payload.is_active !== false,
            followers_only: payload.followers_only === true,
            followers_only_message: payload.followers_only_message,
            followers_only_primary_button_text: payload.followers_only_primary_button_text,
            followers_only_secondary_button_text: payload.followers_only_secondary_button_text,
            suggest_more_enabled: payload.suggest_more_enabled === true,
            private_reply_enabled: true,
            share_to_admin_enabled: false,
            once_per_user_24h: payload.once_per_user_24h === true,
            story_scope: 'shown',
            collect_email_enabled: payload.collect_email_enabled === true,
            collect_email_only_gmail: payload.collect_email_only_gmail === true,
            collect_email_prompt_message: payload.collect_email_prompt_message,
            collect_email_fail_retry_message: payload.collect_email_fail_retry_message,
            collect_email_success_reply_message: payload.collect_email_success_reply_message,
            seen_typing_enabled: payload.seen_typing_enabled === true,
            comment_reply: '',
            linked_media_id: null,
            linked_media_url: null
        }, automationCollectionInfo);

        if (existing.total > 0) {
            await databases.updateDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, existing.documents[0].$id, docData);
        } else {
            await databases.createDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, ID.unique(), docData,
                [Permission.read(Role.user(req.user.$id))]);
        }

        res.json({ message: 'Mentions config saved' });
    } catch (err) {
        console.error(`Save Mentions Config Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to save mentions config' });
    }
});

router.delete('/instagram/mentions-config', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const account = accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id));
        if (!account) return res.status(404).json({ error: 'Account not found or unauthorized' });
        const normalizedAccountId = getIgProfessionalAccountId(account);

        const existing = await listMentionsDocuments(databases, {
            userId: req.user.$id,
            accountIds: [normalizedAccountId, account_id],
            limit: 1
        });

        if (existing.total > 0) {
            await databases.deleteDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, existing.documents[0].$id);
        }

        res.json({ message: 'Mentions config deleted' });
    } catch (err) {
        console.error(`Delete Mentions Config Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to delete mentions config' });
    }
});

// ============================================================================
// SUPER PROFILE
// ============================================================================
router.get('/super-profile', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const igAccount = accounts.documents.find(a => matchesIgAccountIdentifier(a, account_id));
        if (!igAccount) return res.status(404).json({ error: 'Account not found' });

        const result = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, SUPER_PROFILES_COLLECTION_ID,
            [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)]);

        if (result.total > 0) {
            const doc = result.documents[0];
            let buttons = [];
            try { buttons = typeof doc.buttons === 'string' ? JSON.parse(doc.buttons) : (doc.buttons || []); } catch (e) { }
            const slug = getIgProfessionalAccountId(igAccount);
            const baseUrl = (process.env.FRONTEND_ORIGIN || '').replace(/\/+$/, '');
            const publicPath = `/superprofile/${slug}`;

            res.json({
                id: doc.$id,
                slug,
                template_id: doc.template_id || null,
                buttons,
                is_active: doc.is_active || false,
                public_url: `${baseUrl}${publicPath}`,
                created_at: doc.$createdAt,
                updated_at: doc.$updatedAt
            });
        } else {
            res.status(404).json({ error: 'Super profile not found' });
        }
    } catch (err) {
        console.error(`Super Profile Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch super profile' });
    }
});

router.post('/super-profile', loginRequired, async (req, res) => {
    try {
        const account_id = req.query.account_id || req.body.account_id;
        const { template_id, buttons, is_active } = req.body;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const igAccount = accounts.documents.find(a => matchesIgAccountIdentifier(a, account_id));
        if (!igAccount) return res.status(404).json({ error: 'Account not found' });
        const slug = getIgProfessionalAccountId(igAccount);
        const baseUrl = (process.env.FRONTEND_ORIGIN || '').replace(/\/+$/, '');
        const publicPath = `/superprofile/${slug}`;

        const docData = {
            user_id: req.user.$id,
            account_id,
            slug,
            template_id: template_id || null,
            buttons: JSON.stringify(buttons || []),
            is_active: is_active !== undefined ? is_active : true
        };

        const doc = await databases.createDocument(
            process.env.APPWRITE_DATABASE_ID,
            SUPER_PROFILES_COLLECTION_ID,
            ID.unique(),
            docData,
            [Permission.read(Role.user(req.user.$id))]
        );

        res.status(201).json({
            id: doc.$id,
            slug: doc.slug,
            template_id: doc.template_id,
            buttons: buttons || [],
            is_active: doc.is_active,
            public_url: `${baseUrl}${publicPath}`,
            created_at: doc.$createdAt,
            updated_at: doc.$updatedAt
        });
    } catch (err) {
        console.error(`Create Super Profile Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to create super profile' });
    }
});

router.patch('/super-profile', loginRequired, async (req, res) => {
    try {
        const account_id = req.query.account_id || req.body.account_id;
        const { template_id, buttons, is_active } = req.body;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const igAccount = accounts.documents.find(a => matchesIgAccountIdentifier(a, account_id));
        if (!igAccount) return res.status(404).json({ error: 'Account not found' });
        const slug = getIgProfessionalAccountId(igAccount);
        const baseUrl = (process.env.FRONTEND_ORIGIN || '').replace(/\/+$/, '');
        const publicPath = `/superprofile/${slug}`;

        const result = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, SUPER_PROFILES_COLLECTION_ID,
            [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)]);

        if (result.total === 0) return res.status(404).json({ error: 'Super profile not found' });

        const docId = result.documents[0].$id;
        const updateData = {};

        updateData.slug = slug;
        if (template_id !== undefined) updateData.template_id = template_id;
        if (buttons !== undefined) updateData.buttons = JSON.stringify(buttons);
        if (is_active !== undefined) updateData.is_active = is_active;

        const doc = await databases.updateDocument(process.env.APPWRITE_DATABASE_ID, SUPER_PROFILES_COLLECTION_ID, docId, updateData);

        let parsedButtons = [];
        try { parsedButtons = typeof doc.buttons === 'string' ? JSON.parse(doc.buttons) : (doc.buttons || []); } catch (e) { }

        res.json({
            id: doc.$id,
            slug: doc.slug,
            template_id: doc.template_id,
            buttons: parsedButtons,
            is_active: doc.is_active,
            public_url: `${baseUrl}${publicPath}`,
            created_at: doc.$createdAt,
            updated_at: doc.$updatedAt
        });
    } catch (err) {
        console.error(`Update Super Profile Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to update super profile' });
    }
});

// ============================================================================
// PUBLIC SUPER PROFILE
// ============================================================================
router.get('/public/superprofile/:slug', async (req, res) => {
    try {
        const slug = String(req.params.slug || '').trim();
        if (!slug) return res.status(400).json({ error: 'slug is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const result = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            SUPER_PROFILES_COLLECTION_ID,
            [Query.equal('slug', slug), Query.limit(1)]
        );

        if (result.total === 0) return res.status(404).json({ error: 'Profile not found' });

        const doc = result.documents[0];
        if (doc.is_active === false) return res.status(404).json({ error: 'Profile not found' });

        let buttons = [];
        try { buttons = typeof doc.buttons === 'string' ? JSON.parse(doc.buttons) : (doc.buttons || []); } catch (e) { }

        let account = null;
        try {
            const accRes = await databases.listDocuments(
                process.env.APPWRITE_DATABASE_ID,
                IG_ACCOUNTS_COLLECTION_ID,
                [Query.equal('account_id', doc.account_id), Query.limit(1)]
            );
            account = accRes.total > 0 ? accRes.documents[0] : null;
        } catch (e) { }

        if (!account) {
            try {
                account = await databases.getDocument(
                    process.env.APPWRITE_DATABASE_ID,
                    IG_ACCOUNTS_COLLECTION_ID,
                    doc.account_id
                );
            } catch (e) { }
        }

        res.json({
            slug,
            buttons,
            is_active: doc.is_active !== false,
            username: account?.username || '',
            profile_picture_url: account?.profile_picture_url || '',
            name: account?.name || ''
        });
    } catch (err) {
        console.error(`Public Super Profile Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch public profile' });
    }
});

// ============================================================================
// SUGGEST MORE
// ============================================================================
router.get('/instagram/suggest-more', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const account = accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id));
        if (!account) return res.status(404).json({ error: 'Account not found or unauthorized' });
        const normalizedAccountId = getIgProfessionalAccountId(account);

        const result = await listSuggestMoreDocuments(databases, {
            userId: req.user.$id,
            accountIds: [normalizedAccountId, account_id],
            limit: 1
        });

        if (result.total > 0) {
            const doc = result.documents[0];
            res.json({
                is_setup: true,
                is_active: doc.is_active || false,
                template_id: doc.template_id || null,
                doc_id: doc.$id
            });
        } else {
            res.json({ is_setup: false, is_active: false });
        }
    } catch (err) {
        console.error(`Suggest More Error: ${err.message}`);
        res.json({ is_setup: false, is_active: false });
    }
});

router.post('/instagram/suggest-more', loginRequired, async (req, res) => {
    try {
        const { account_id, template_id, is_active } = req.body;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const account = accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id));
        if (!account) return res.status(404).json({ error: 'Account not found or unauthorized' });
        const normalizedAccountId = getIgProfessionalAccountId(account);

        const existing = await listSuggestMoreDocuments(databases, {
            userId: req.user.$id,
            accountIds: [normalizedAccountId, account_id],
            limit: 1
        });

        const featureAccessError = await enforceAutomationFeatureAccess(
            databases,
            req.user.$id,
            {},
            { requireFeature: 'suggest_more' }
        );
        if (featureAccessError) {
            return res.status(403).json(featureAccessError);
        }

        const docData = {
            user_id: req.user.$id,
            account_id: normalizedAccountId,
            automation_type: 'suggest_more',
            title: 'Suggest More',
            title_normalized: 'suggest more',
            trigger_type: 'config',
            template_id: template_id || null,
            is_active: is_active !== undefined ? is_active : true
        };

        if (existing.total > 0) {
            await databases.updateDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, existing.documents[0].$id, docData);
        } else {
            await databases.createDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, ID.unique(), docData,
                [Permission.read(Role.user(req.user.$id))]);
        }

        res.json({ message: 'Suggest more config saved' });
    } catch (err) {
        console.error(`Save Suggest More Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to save suggest more config' });
    }
});

router.delete('/instagram/suggest-more', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const account = accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id));
        if (!account) return res.status(404).json({ error: 'Account not found or unauthorized' });
        const normalizedAccountId = getIgProfessionalAccountId(account);

        const existing = await listSuggestMoreDocuments(databases, {
            userId: req.user.$id,
            accountIds: [normalizedAccountId, account_id],
            limit: 1
        });

        if (existing.total > 0) {
            await databases.deleteDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, existing.documents[0].$id);
        }

        res.json({ message: 'Suggest more config deleted' });
    } catch (err) {
        console.error(`Delete Suggest More Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to delete suggest more config' });
    }
});

// ============================================================================
// COMMENT MODERATION
// ============================================================================
router.get('/instagram/comment-moderation', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        // Verify account ownership
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const account = accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id));
        if (!account) {
            return res.status(404).json({ error: 'Account not found or unauthorized' });
        }
        const targetAccountId = getIgProfessionalAccountId(account);

        const result = await listCommentModerationDocuments(databases, {
            userId: req.user.$id,
            accountIds: [targetAccountId, account_id]
        });
        const keywordRules = buildCommentModerationRulesFromKeywordDocuments(
            await listCommentModerationKeywordDocuments(databases, { accountId: targetAccountId })
        );

        if (result.length > 0 || keywordRules.length > 0) {
            const doc = result[0] || null;
            let rules = keywordRules;
            if (rules.length === 0 && doc) {
                try {
                    rules = typeof doc.rules === 'string' ? JSON.parse(doc.rules) : (doc.rules || []);
                } catch (e) { rules = []; }
            }

            res.json({
                rules: rules,
                is_active: doc?.is_active !== undefined ? doc.is_active : true,
                doc_id: doc?.$id || null
            });
        } else {
            res.json({ rules: [], is_active: true });
        }
    } catch (err) {
        console.error(`Get Comment Moderation Error: ${err.message}`, err);
        res.status(500).json({ error: 'Failed to fetch comment moderation rules' });
    }
});

router.post('/instagram/comment-moderation', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query; // Also check body if needed, but usually passed in query in frontend
        const { rules, is_active } = req.body;

        const targetAccountId = account_id || req.body.account_id;

        if (!targetAccountId) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const account = accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, targetAccountId));
        if (!account) {
            return res.status(404).json({ error: 'Account not found or unauthorized' });
        }
        const normalizedAccountId = getIgProfessionalAccountId(account);

        const normalizedRules = (Array.isArray(rules) ? rules : [])
            .filter((rule) => ['hide', 'delete'].includes(String(rule?.action || '')))
            .map((rule) => ({
                action: rule.action,
                keywords: Array.from(new Set(
                    (Array.isArray(rule?.keywords) ? rule.keywords : [])
                        .map((keyword) => String(keyword || '').trim().toLowerCase())
                        .filter(Boolean)
                ))
            }))
            .filter((rule) => rule.keywords.length > 0);

        const totalKeywordCount = normalizedRules.reduce((count, rule) => count + rule.keywords.length, 0);
        const moderationKeywords = extractModerationKeywordsFromRules(normalizedRules);
        if (moderationKeywords.length !== totalKeywordCount) {
            return res.status(400).json({ error: 'Each moderation keyword can only belong to one action list.' });
        }

        const automationConflicts = await findAutomationKeywordConflictsForModeration(databases, {
            accountId: normalizedAccountId,
            keywords: moderationKeywords
        });
        if (automationConflicts.length > 0) {
            return res.status(400).json({
                error: `These moderation keywords are already used in automations or global triggers: ${automationConflicts.join(', ')}`,
                field: 'keywords',
                duplicate_keywords: automationConflicts
            });
        }

        const existing = await listCommentModerationDocuments(databases, {
            userId: req.user.$id,
            accountIds: [normalizedAccountId, targetAccountId]
        });

        await syncCommentModerationKeywordRecords(databases, {
            accountId: normalizedAccountId,
            rules: normalizedRules
        });

        const docData = {
            user_id: req.user.$id,
            account_id: normalizedAccountId,
            rules: JSON.stringify(normalizedRules),
            is_active: is_active !== undefined ? is_active : true
        };
        const moderationCollectionInfo = await getCollectionAttributeInfo(databases, COMMENT_MODERATION_COLLECTION_ID);
        const sanitizedDocData = sanitizePayloadForCollection(docData, moderationCollectionInfo);

        if (existing.length > 0) {
            await databases.updateDocument(process.env.APPWRITE_DATABASE_ID, COMMENT_MODERATION_COLLECTION_ID, existing[0].$id, sanitizedDocData);
        } else {
            await databases.createDocument(process.env.APPWRITE_DATABASE_ID, COMMENT_MODERATION_COLLECTION_ID, ID.unique(), sanitizedDocData,
                [Permission.read(Role.user(req.user.$id))]);
        }

        res.json({ message: 'Comment moderation rules saved' });
    } catch (err) {
        console.error(`Save Comment Moderation Error: ${err.message}`, err);
        res.status(500).json({ error: 'Failed to save comment moderation rules' });
    }
});


module.exports = router;



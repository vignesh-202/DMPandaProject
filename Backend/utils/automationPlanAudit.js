const { Query } = require('node-appwrite');
const sharedPlanFeatures = require('../../shared/planFeatures.json');
const {
    APPWRITE_DATABASE_ID,
    AUTOMATIONS_COLLECTION_ID,
    IG_ACCOUNTS_COLLECTION_ID
} = require('./appwrite');
const {
    normalizeFeatureKey,
    resolveUserPlanContext,
    listPricingPlans,
    normalizePlanDocument
} = require('./planConfig');

const TOGGLE_FEATURE_MAP = Object.freeze(sharedPlanFeatures.toggleFeatureMap || {});
const AUTOMATION_TYPE_FEATURE_MAP = Object.freeze(sharedPlanFeatures.automationTypeFeatureMap || {});
const COMMENT_REPLY_FEATURE_MAP = Object.freeze(sharedPlanFeatures.commentReplyFeatureMap || {});
const SHARE_TRIGGER_FEATURE_MAP = Object.freeze(sharedPlanFeatures.shareTriggerFeatureMap || {});

const requiredFeaturesForAutomation = (automation = {}) => {
    const type = String(automation.automation_type || automation.type || 'dm').trim().toLowerCase();
    const required = [];
    if (AUTOMATION_TYPE_FEATURE_MAP[type]) required.push(AUTOMATION_TYPE_FEATURE_MAP[type]);
    Object.entries(TOGGLE_FEATURE_MAP).forEach(([field, featureKey]) => {
        if (automation?.[field] === true) required.push(featureKey);
    });
    const commentReplyFeature = COMMENT_REPLY_FEATURE_MAP[type] || (type === 'global' ? 'post_comment_reply_automation' : '');
    if (String(automation.comment_reply || automation.comment_reply_text || '').trim() && commentReplyFeature) {
        required.push(commentReplyFeature);
    }
    const isShareTrigger = String(automation.trigger_type || '').trim().toLowerCase() === 'share_to_admin'
        || automation.share_to_admin_enabled === true
        || String(automation.template_type || '').trim() === 'template_share_post';
    if (isShareTrigger) {
        required.push(SHARE_TRIGGER_FEATURE_MAP[type] || 'share_post_to_admin');
    }
    return Array.from(new Set(required.map((feature) => normalizeFeatureKey(feature)).filter(Boolean)));
};

const updateAutomationPlanValidationForUser = async (databases, userId, planContext = null) => {
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) return { checked: 0, updated: 0 };

    let accountEntitlementsMap = new Map();
    try {
        const pricingPlans = await listPricingPlans(databases);
        const igAccountsRes = await databases.listDocuments(APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, [
            Query.equal('user_id', safeUserId),
            Query.limit(100)
        ]).catch(() => ({ documents: [] }));
        const igAccounts = igAccountsRes.documents || [];

        for (const acc of igAccounts) {
            const planCode = String(acc.plan_code || 'free').trim().toLowerCase();
            const isFree = planCode === 'free';
            const expiresAt = acc.expires_at ? new Date(acc.expires_at) : null;
            const isActive = !isFree && Boolean(expiresAt && expiresAt.getTime() > Date.now());
            const effectivePricingPlan = isActive 
                ? (pricingPlans.find(p => p.plan_code === planCode || p.id === planCode) || pricingPlans.find(p => p.plan_code === 'free'))
                : pricingPlans.find(p => p.plan_code === 'free');
            const normalized = normalizePlanDocument(effectivePricingPlan || {});
            const entitlements = normalized?.entitlements || {};
            
            if (acc.$id) accountEntitlementsMap.set(String(acc.$id), entitlements);
            if (acc.account_id) accountEntitlementsMap.set(String(acc.account_id), entitlements);
            if (acc.ig_user_id) accountEntitlementsMap.set(String(acc.ig_user_id), entitlements);
        }
    } catch (_) {}

    const defaultContext = planContext || await resolveUserPlanContext(databases, safeUserId);
    const defaultEntitlements = defaultContext.entitlements || {};

    const response = await databases.listDocuments(APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, [
        Query.equal('user_id', safeUserId),
        Query.limit(500)
    ]);
    let updated = 0;
    let persistenceUnsupported = false;
    for (const automation of response.documents || []) {
        const accKey = String(automation.account_id || automation.ig_user_id || automation.ig_account_id || '').trim();
        const entitlements = (accKey && accountEntitlementsMap.get(accKey)) || defaultEntitlements;

        const missing = requiredFeaturesForAutomation(automation)
            .filter((feature) => entitlements[feature] !== true);
        const nextState = missing.length > 0 ? 'invalid_due_to_plan' : 'valid';
        const nextInvalidFeatures = missing.length > 0 ? JSON.stringify(missing) : null;
        if (automation.plan_validation_state === nextState && (automation.invalid_features || null) === nextInvalidFeatures) {
            continue;
        }
        try {
            await databases.updateDocument(APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, automation.$id, {
                plan_validation_state: nextState,
                invalid_features: nextInvalidFeatures
            });
        } catch (error) {
            const message = String(error?.message || '').toLowerCase();
            if (message.includes('unknown attribute')
                || message.includes('attribute not found')
                || message.includes('maximum number or size of attributes')) {
                persistenceUnsupported = true;
                break;
            }
            throw error;
        }
        updated += 1;
    }
    return {
        checked: Number(response.total || (response.documents || []).length),
        updated,
        persistenceUnsupported
    };
};

module.exports = {
    requiredFeaturesForAutomation,
    updateAutomationPlanValidationForUser
};

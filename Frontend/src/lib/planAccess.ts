import sharedPlanFeatures from '../../../shared/planFeatures.json';

const featureAliases = (sharedPlanFeatures.benefitAliases || {}) as Record<string, string>;
const featureLabels = (sharedPlanFeatures.featureLabels || {}) as Record<string, string>;
const automationTypeFeatureMap = (sharedPlanFeatures.automationTypeFeatureMap || {}) as Record<string, string>;
const toggleFeatureMap = (sharedPlanFeatures.toggleFeatureMap || {}) as Record<string, string>;
const commentReplyFeatureMap = (sharedPlanFeatures.commentReplyFeatureMap || {}) as Record<string, string>;
const shareTriggerFeatureMap = (sharedPlanFeatures.shareTriggerFeatureMap || {}) as Record<string, string>;

export const normalizeFeatureKey = (value: string): string => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[+/\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

export const resolveCanonicalFeatureKey = (value: string): string => {
    const normalized = normalizeFeatureKey(value);
    if (!normalized) return '';
    return featureAliases[normalized] || normalized;
};

export const getFeatureLabel = (featureKey: string): string => {
    const canonicalKey = resolveCanonicalFeatureKey(featureKey);
    return featureLabels[canonicalKey] || canonicalKey.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
};

export const hasPlanEntitlement = (entitlements: Record<string, boolean> | null | undefined, featureKey: string): boolean => {
    const canonicalKey = resolveCanonicalFeatureKey(featureKey);
    if (!canonicalKey) return false;

    const normalizedEntitlements = Object.entries(entitlements || {}).reduce<Record<string, boolean>>((acc, [key, enabled]) => {
        acc[resolveCanonicalFeatureKey(key)] = enabled === true;
        return acc;
    }, {});

    return normalizedEntitlements[canonicalKey] === true;
};

export const getAutomationRequiredFeatures = ({
    automationType,
    toggles = {},
    hasCommentReply = false,
    isShareTrigger = false
}: {
    automationType: string;
    toggles?: Record<string, boolean>;
    hasCommentReply?: boolean;
    isShareTrigger?: boolean;
}): string[] => {
    const type = normalizeFeatureKey(automationType);
    const required = new Set<string>();

    if (automationTypeFeatureMap[type]) {
        required.add(resolveCanonicalFeatureKey(automationTypeFeatureMap[type]));
    }

    Object.entries(toggleFeatureMap).forEach(([toggleKey, featureKey]) => {
        if (toggles[toggleKey] === true) {
            required.add(resolveCanonicalFeatureKey(featureKey));
        }
    });

    const commentReplyFeature = commentReplyFeatureMap[type] || (type === 'global' ? 'post_comment_reply_automation' : '');
    if (hasCommentReply && commentReplyFeature) {
        required.add(resolveCanonicalFeatureKey(commentReplyFeature));
    }

    if (isShareTrigger) {
        required.add(resolveCanonicalFeatureKey(shareTriggerFeatureMap[type] || 'share_post_to_dm'));
    }

    return Array.from(required).filter(Boolean);
};

export const buildLockedFeatureState = (
    entitlements: Record<string, boolean> | null | undefined,
    featureKey: string,
    note?: string
) => {
    const canonicalKey = resolveCanonicalFeatureKey(featureKey);
    const isLocked = !hasPlanEntitlement(entitlements, canonicalKey);
    return {
        isLocked,
        featureKey: canonicalKey,
        label: getFeatureLabel(canonicalKey),
        note: note || `Upgrade your plan to unlock ${getFeatureLabel(canonicalKey)}.`
    };
};

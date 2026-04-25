const DEFAULT_WATERMARK_POLICY = {
    enabled: true,
    default_text: 'Automation made by DMPanda',
    enforcement_mode: 'fallback_secondary_message',
    allow_user_override: true
};

const hasWatermark = (textValue, watermarkText) =>
    String(textValue || '').toLowerCase().includes(String(watermarkText || '').toLowerCase());

const appendWatermark = (textValue, watermarkText) => {
    const base = String(textValue || '').trim();
    const suffix = String(watermarkText || DEFAULT_WATERMARK_POLICY.default_text).trim();
    if (!base) return suffix;
    if (hasWatermark(base, suffix)) return base;
    return `${base}\n\n${suffix}`;
};

const parseFeatureOverrides = (value) => {
    if (!value) return {};
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(String(value));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
};

const resolveWatermarkPolicy = ({ globalPolicy, profile }) => {
    const basePolicy = {
        ...DEFAULT_WATERMARK_POLICY,
        ...(globalPolicy && typeof globalPolicy === 'object' ? globalPolicy : {})
    };
    const runtimeFeatures = parseFeatureOverrides(profile?.features_json);
    const featureOverrides = parseFeatureOverrides(profile?.feature_overrides_json);
    if (profile?.benefit_no_watermark === true) {
        runtimeFeatures.no_watermark = true;
    }

    if (!basePolicy.enabled) {
        return { ...basePolicy, enabled: false };
    }

    if (basePolicy.allow_user_override && runtimeFeatures.no_watermark === true) {
        return { ...basePolicy, enabled: false };
    }

    if (basePolicy.allow_user_override && String(featureOverrides.watermark_text || '').trim()) {
        return {
            ...basePolicy,
            default_text: String(featureOverrides.watermark_text).trim()
        };
    }

    return basePolicy;
};

const planWatermark = ({ templateType, payload, policy }) => {
    const safePayload = payload && typeof payload === 'object' ? payload : {};
    const activePolicy = {
        ...DEFAULT_WATERMARK_POLICY,
        ...(policy && typeof policy === 'object' ? policy : {})
    };
    if (!activePolicy.enabled) {
        return { primaryPayload: safePayload, secondaryPayload: null, mode: 'disabled' };
    }

    const watermarkText = String(activePolicy.default_text || DEFAULT_WATERMARK_POLICY.default_text).trim();
    const type = String(templateType || '').trim().toLowerCase();

    const inlineIfFits = (textValue, limit) => {
        const candidate = appendWatermark(textValue, watermarkText);
        if (candidate.length <= limit) {
            return { inline: true, value: candidate };
        }
        return { inline: false, value: textValue };
    };

    if (type === 'template_text' || type === 'template_quick_replies') {
        if (hasWatermark(safePayload.text, watermarkText)) {
            return { primaryPayload: safePayload, secondaryPayload: null, mode: 'none' };
        }
        const result = activePolicy.enforcement_mode === 'inline_when_possible'
            ? inlineIfFits(safePayload.text, 1000)
            : { inline: false, value: safePayload.text };
        if (result.inline) {
            return {
                primaryPayload: { ...safePayload, text: result.value },
                secondaryPayload: null,
                mode: 'inline'
            };
        }
        return {
            primaryPayload: safePayload,
            secondaryPayload: { text: watermarkText },
            mode: 'secondary'
        };
    }

    if (type === 'template_buttons') {
        if (hasWatermark(safePayload.text, watermarkText)) {
            return { primaryPayload: safePayload, secondaryPayload: null, mode: 'none' };
        }
        const result = activePolicy.enforcement_mode === 'inline_when_possible'
            ? inlineIfFits(safePayload.text, 640)
            : { inline: false, value: safePayload.text };
        if (result.inline) {
            return {
                primaryPayload: { ...safePayload, text: result.value },
                secondaryPayload: null,
                mode: 'inline'
            };
        }
        return {
            primaryPayload: safePayload,
            secondaryPayload: { text: watermarkText },
            mode: 'secondary'
        };
    }

    if (type === 'template_carousel') {
        const elements = Array.isArray(safePayload.elements) ? safePayload.elements.slice() : [];
        if (elements.length > 0) {
            const first = elements[0] && typeof elements[0] === 'object' ? { ...elements[0] } : {};
            const baseText = first.subtitle || first.title || '';
            if (hasWatermark(baseText, watermarkText)) {
                return { primaryPayload: safePayload, secondaryPayload: null, mode: 'none' };
            }
            const result = activePolicy.enforcement_mode === 'inline_when_possible'
                ? inlineIfFits(baseText, 80)
                : { inline: false, value: baseText };
            if (result.inline) {
                first.subtitle = result.value;
                elements[0] = first;
                return {
                    primaryPayload: { ...safePayload, elements },
                    secondaryPayload: null,
                    mode: 'inline'
                };
            }
        }
        return {
            primaryPayload: safePayload,
            secondaryPayload: { text: watermarkText },
            mode: 'secondary'
        };
    }

    return {
        primaryPayload: safePayload,
        secondaryPayload: { text: watermarkText },
        mode: 'secondary'
    };
};

module.exports = {
    DEFAULT_WATERMARK_POLICY,
    resolveWatermarkPolicy,
    planWatermark
};

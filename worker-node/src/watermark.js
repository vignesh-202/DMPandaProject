const DEFAULT_WATERMARK_POLICY = {
    enabled: String(process.env.DEFAULT_WATERMARK_ENABLED || 'true').trim().toLowerCase() !== 'false',
    type: 'text',
    position: ['inline_when_possible', 'secondary_message'].includes(String(process.env.DEFAULT_WATERMARK_POSITION || '').trim().toLowerCase())
        ? String(process.env.DEFAULT_WATERMARK_POSITION).trim().toLowerCase()
        : 'secondary_message',
    opacity: Number.isFinite(Number(process.env.DEFAULT_WATERMARK_OPACITY))
        ? Math.max(0, Math.min(1, Number(process.env.DEFAULT_WATERMARK_OPACITY)))
        : 1,
    default_text: String(process.env.DEFAULT_WATERMARK_TEXT || 'Automation made by DMPanda').trim() || 'Automation made by DMPanda'
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

const resolveWatermarkPolicy = ({ globalPolicy, profile }) => {
    const adminPolicy = globalPolicy && typeof globalPolicy === 'object'
        ? globalPolicy
        : null;
    const runtimeFeatures = { ...(profile?.__plan_features || {}) };
    if (profile?.benefit_no_watermark === true) {
        runtimeFeatures.no_watermark = true;
    }
    if (profile?.no_watermark === true) {
        runtimeFeatures.no_watermark = true;
    }

    const planFallbackPolicy = {
        ...DEFAULT_WATERMARK_POLICY,
        enabled: runtimeFeatures.no_watermark === true ? false : DEFAULT_WATERMARK_POLICY.enabled
    };
    const basePolicy = {
        ...planFallbackPolicy,
        ...(adminPolicy || {})
    };

    if (!basePolicy.enabled) {
        return { ...basePolicy, enabled: false };
    }

    if (runtimeFeatures.no_watermark === true) {
        return { ...basePolicy, enabled: false };
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
        const result = activePolicy.position === 'inline_when_possible'
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
        const result = activePolicy.position === 'inline_when_possible'
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
            const result = activePolicy.position === 'inline_when_possible'
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

const DEFAULT_WATERMARK_POLICY = {
    enabled: String(process.env.DEFAULT_WATERMARK_ENABLED || 'true').trim().toLowerCase() !== 'false',
    type: 'text',
    position: ['dynamic', 'secondary', 'secondary_message', 'off'].includes(String(process.env.DEFAULT_WATERMARK_POSITION || '').trim().toLowerCase())
        ? String(process.env.DEFAULT_WATERMARK_POSITION).trim().toLowerCase()
        : 'dynamic',
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

    if (basePolicy.position === 'off' || basePolicy.enabled === false || runtimeFeatures.no_watermark === true) {
        return { ...basePolicy, enabled: false, position: 'off' };
    }

    return basePolicy;
};

const planWatermark = ({ templateType, payload, policy }) => {
    const safePayload = payload && typeof payload === 'object' ? payload : {};
    const activePolicy = {
        ...DEFAULT_WATERMARK_POLICY,
        ...(policy && typeof policy === 'object' ? policy : {})
    };
    if (!activePolicy.enabled || activePolicy.position === 'off') {
        return { primaryPayload: safePayload, secondaryPayload: null, mode: 'disabled' };
    }

    const watermarkText = String(activePolicy.default_text || DEFAULT_WATERMARK_POLICY.default_text).trim();
    const type = String(templateType || '').trim().toLowerCase();

    // Secondary mode: always send watermark as a separate follow-up message bubble
    const isSecondaryOnly = activePolicy.position === 'secondary' || activePolicy.position === 'secondary_message';
    if (isSecondaryOnly) {
        return {
            primaryPayload: safePayload,
            secondaryPayload: { text: watermarkText },
            mode: 'secondary'
        };
    }

    const inlineIfFits = (textValue, limit) => {
        const candidate = appendWatermark(textValue, watermarkText);
        if (candidate.length <= limit) {
            return { inline: true, value: candidate };
        }
        return { inline: false, value: textValue };
    };

    // Dynamic mode: evaluates whether the watermark can be seamlessly embedded into the message
    // without cluttering long messages (base text <= 500 chars) or exceeding safe limits (<= 800 chars).
    // If the message is already long or incompatible, it delivers it as a separate follow-up message.
    const dynamicInlineIfFits = (textValue, limit = 800, maxBaseLength = 500) => {
        const raw = String(textValue || '').trim();
        if (raw.length > maxBaseLength) {
            return { inline: false, value: textValue };
        }
        const candidate = appendWatermark(raw, watermarkText);
        if (candidate.length <= limit) {
            return { inline: true, value: candidate };
        }
        return { inline: false, value: textValue };
    };

    const isDynamic = activePolicy.position === 'dynamic' || !activePolicy.position;

    if (type === 'template_text' || type === 'template_quick_replies') {
        if (hasWatermark(safePayload.text, watermarkText)) {
            return { primaryPayload: safePayload, secondaryPayload: null, mode: 'none' };
        }
        let result = { inline: false, value: safePayload.text };
        if (isDynamic) {
            result = dynamicInlineIfFits(safePayload.text, 800, 500);
        } else if (activePolicy.position === 'inline_when_possible') {
            result = inlineIfFits(safePayload.text, 1000);
        }
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
        let result = { inline: false, value: safePayload.text };
        if (isDynamic) {
            result = dynamicInlineIfFits(safePayload.text, 500, 300);
        } else if (activePolicy.position === 'inline_when_possible') {
            result = inlineIfFits(safePayload.text, 640);
        }
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
        if (elements.length > 0 && activePolicy.position === 'inline_when_possible') {
            const first = elements[0] && typeof elements[0] === 'object' ? { ...elements[0] } : {};
            const baseText = first.subtitle || first.title || '';
            if (hasWatermark(baseText, watermarkText)) {
                return { primaryPayload: safePayload, secondaryPayload: null, mode: 'none' };
            }
            const result = inlineIfFits(baseText, 80);
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

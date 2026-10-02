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
    const base = String(textValue || '').trimEnd();
    const suffix = String(watermarkText || DEFAULT_WATERMARK_POLICY.default_text).trim();
    if (!base) return suffix;
    if (hasWatermark(base, suffix)) return base;
    // Leave 2 lines before watermark and then start from the next line
    return `${base}\n\n\n${suffix}`;
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

    // Secondary mode: always send watermark as a separate individual follow-up message bubble
    const isSecondaryOnly = activePolicy.position === 'secondary' || activePolicy.position === 'secondary_message';
    if (isSecondaryOnly) {
        return {
            primaryPayload: safePayload,
            secondaryPayload: { text: watermarkText },
            mode: 'secondary'
        };
    }

    // Dynamic mode:
    // 1. Identify reply template type and length of watermark
    // 2. If inline text is possible and has enough space, leave 2 lines and start watermark from next line
    // 3. If template cannot take text (media, carousel, shares) or text is already too long (insufficient space),
    //    send watermark as an individual follow-up text message bubble.
    const watermarkLength = watermarkText.length;
    const spacing = 3; // '\n\n\n' (leaves 2 lines before watermark)

    // Text & Quick Replies: Max 1,000 chars on Instagram Messenger API
    if (type === 'template_text' || type === 'text' || type === 'template_quick_replies' || type === 'quick_replies') {
        const rawText = String(safePayload.text || '').trim();
        if (hasWatermark(rawText, watermarkText)) {
            return { primaryPayload: safePayload, secondaryPayload: null, mode: 'none' };
        }

        const candidateLength = rawText.length + spacing + watermarkLength;
        const maxInlineLimit = 850; // Instagram safe limit allowing buffer

        // If template has valid text and sufficient space, insert inline leaving 2 lines
        if (rawText.length > 0 && candidateLength <= maxInlineLimit) {
            return {
                primaryPayload: { ...safePayload, text: appendWatermark(rawText, watermarkText) },
                secondaryPayload: null,
                mode: 'inline'
            };
        }

        // Insufficient space or no text body: deliver as an individual follow-up text message
        return {
            primaryPayload: safePayload,
            secondaryPayload: { text: watermarkText },
            mode: 'secondary'
        };
    }

    // Button Template: Meta enforces a strict 640-character limit on the message body text.
    if (type === 'template_buttons' || type === 'button') {
        const rawText = String(safePayload.text || '').trim();
        if (hasWatermark(rawText, watermarkText)) {
            return { primaryPayload: safePayload, secondaryPayload: null, mode: 'none' };
        }

        const candidateLength = rawText.length + spacing + watermarkLength;
        const maxInlineLimit = 550; // Safely below Meta's 640-char limit

        // If text has enough space for watermark, insert inline leaving 2 blank lines
        if (rawText.length > 0 && candidateLength <= maxInlineLimit) {
            return {
                primaryPayload: { ...safePayload, text: appendWatermark(rawText, watermarkText) },
                secondaryPayload: null,
                mode: 'inline'
            };
        }

        // Insufficient space: send watermark as an individual follow-up text message
        return {
            primaryPayload: safePayload,
            secondaryPayload: { text: watermarkText },
            mode: 'secondary'
        };
    }

    // Carousel Templates (generic templates: cards have 80-char title/subtitle limits; inline text breaks cards)
    // Media Templates (images, videos, reels, posts: attachments cannot take text captions in direct message payloads)
    // In all these cases, inline text is not possible or has no space -> send as an individual text message
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

function buildSingleEventPayload(webhookData, entry, { messaging = null, change = null } = {}) {
    const nextEntry = { ...entry };
    nextEntry.messaging = messaging ? [messaging] : [];
    nextEntry.changes = change ? [change] : [];
    return {
        ...webhookData,
        entry: [nextEntry]
    };
}

function extractMessagingMeta(entry, event) {
    const businessAccountId = String(entry?.id || event?.recipient?.id || '').trim();
    const recipientId = businessAccountId;
    const senderId = String(event?.sender?.id || '').trim();
    const eventType = event?.postback
        ? (event?.postback?.referral || event?.postback?.context ? 'share_referral' : 'postback')
        : event?.read
            ? 'read'
            : event?.delivery
                ? 'delivery'
                : 'message';
    const eventKey = event?.message?.mid
        || event?.postback?.mid
        || event?.postback?.payload
        || event?.postback?.title
        || `${eventType}:${recipientId}:${senderId}:${JSON.stringify(event || {})}`;

    return {
        eventType,
        accountId: businessAccountId,
        recipientId,
        senderId,
        conversationKey: senderId && recipientId ? `${recipientId}:${senderId}` : `${recipientId}:unknown`,
        eventKey: String(eventKey || '').trim()
    };
}

function extractChangeMeta(entry, change) {
    const field = String(change?.field || '').trim().toLowerCase();
    const value = change?.value || {};
    const recipientId = String(value?.recipient?.id || entry?.id || '').trim();
    const senderId = String(
        value?.from?.id
        || value?.sender?.id
        || value?.user?.id
        || value?.author?.id
        || value?.mentioned_by?.id
        || value?.user_id
        || value?.sender_id
        || ''
    ).trim();

    let eventType = '';
    if (field === 'comments' || field === 'live_comments') {
        eventType = 'comment';
    } else if (field === 'mentions' || field === 'mention' || field === 'story_mentions' || field.includes('mention')) {
        eventType = 'mention';
    } else {
        return null;
    }

    const entityId = value?.id || value?.comment_id || value?.media_id || value?.message || '';

    return {
        eventType,
        accountId: recipientId,
        recipientId,
        senderId,
        conversationKey: senderId && recipientId ? `${recipientId}:${senderId}` : `${recipientId}:unknown`,
        eventKey: `${eventType}:${recipientId}:${senderId}:${entityId}`
    };
}

function splitWebhookPayload(webhookData) {
    const entries = Array.isArray(webhookData?.entry) ? webhookData.entry : [];
    const jobs = [];

    for (const entry of entries) {
        const messagingEvents = Array.isArray(entry?.messaging) ? entry.messaging : [];
        for (const messaging of messagingEvents) {
            const meta = extractMessagingMeta(entry, messaging);
            jobs.push({
                ...meta,
                payload: buildSingleEventPayload(webhookData, entry, { messaging })
            });
        }

        const changes = Array.isArray(entry?.changes) ? entry.changes : [];
        for (const change of changes) {
            const meta = extractChangeMeta(entry, change);
            if (!meta) continue;
            jobs.push({
                ...meta,
                payload: buildSingleEventPayload(webhookData, entry, { change })
            });
        }
    }

    return jobs;
}

module.exports = {
    splitWebhookPayload
};

const { ID } = require('node-appwrite');
const {
    AUTOMATIONS_COLLECTION_ID,
    AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID,
    KEYWORDS_COLLECTION_ID,
    KEYWORD_INDEX_COLLECTION_ID,
    LOGS_COLLECTION_ID,
    CHAT_STATES_COLLECTION_ID
} = require('./appwrite');

const AUTOMATION_TYPE_SCHEMAS = Object.freeze({
    dm: { mode: 'standard', singleton: false, triggerType: 'keywords', titleFallback: 'DM Automation' },
    global: { mode: 'standard', singleton: false, triggerType: 'keywords', titleFallback: 'Global Automation' },
    post: { mode: 'standard', singleton: false, triggerType: 'keywords', titleFallback: 'Post Automation' },
    reel: { mode: 'standard', singleton: false, triggerType: 'keywords', titleFallback: 'Reel Automation' },
    story: { mode: 'standard', singleton: false, triggerType: 'keywords', titleFallback: 'Story Automation' },
    live: { mode: 'standard', singleton: false, triggerType: 'keywords', titleFallback: 'Live Automation' },
    comment: { mode: 'standard', singleton: false, triggerType: 'keywords', titleFallback: 'Comment Automation' },
    mentions: { mode: 'config', singleton: true, triggerType: 'config', titleFallback: 'Mentions' },
    suggest_more: { mode: 'config', singleton: true, triggerType: 'config', titleFallback: 'Suggest More' },
    inbox_menu: { mode: 'config', singleton: false, triggerType: 'config', titleFallback: 'Inbox Menu' },
    convo_starter: { mode: 'config', singleton: false, triggerType: 'config', titleFallback: 'Conversation Starter' }
});

const normalizeAutomationType = (value) => String(value || '').trim().toLowerCase();

const getAutomationSchema = (automationType) =>
    AUTOMATION_TYPE_SCHEMAS[normalizeAutomationType(automationType)]
    || { mode: 'standard', singleton: false, triggerType: 'keywords', titleFallback: 'Automation' };

const isKeywordDrivenAutomation = (automationType) => new Set(['dm', 'global', 'post', 'reel', 'story', 'live', 'comment']).has(normalizeAutomationType(automationType));

const buildAutomationEnvelope = ({
    userId,
    accountId,
    automationType,
    payload = {},
    existingDocument = null
}) => {
    const schema = getAutomationSchema(automationType);
    const safeType = normalizeAutomationType(automationType);
    const merged = {
        ...(existingDocument || {}),
        ...(payload || {})
    };

    return {
        user_id: String(userId || merged.user_id || '').trim(),
        account_id: String(accountId || merged.account_id || '').trim(),
        automation_type: safeType,
        trigger_type: String(merged.trigger_type || schema.triggerType || 'keywords').trim().toLowerCase(),
        title: String(merged.title || schema.titleFallback || 'Automation').trim(),
        is_active: merged.is_active !== false,
        template_id: merged.template_id ?? null,
        template_type: merged.template_type ?? null,
        template_content: merged.template_content ?? null,
        followers_only: merged.followers_only === true,
        followers_only_message: merged.followers_only_message ?? '',
        followers_only_primary_button_text: merged.followers_only_primary_button_text ?? null,
        followers_only_secondary_button_text: merged.followers_only_secondary_button_text ?? null,
        suggest_more_enabled: merged.suggest_more_enabled === true,
        private_reply_enabled: merged.private_reply_enabled !== false,
        share_to_admin_enabled: merged.share_to_admin_enabled === true,
        once_per_user_24h: merged.once_per_user_24h === true,
        collect_email_enabled: merged.collect_email_enabled === true,
        collect_email_only_gmail: merged.collect_email_only_gmail === true,
        collect_email_prompt_message: merged.collect_email_prompt_message ?? null,
        collect_email_fail_retry_message: merged.collect_email_fail_retry_message ?? null,
        collect_email_success_reply_message: merged.collect_email_success_reply_message ?? null,
        seen_typing_enabled: merged.seen_typing_enabled === true,
        story_scope: merged.story_scope ?? 'shown'
    };
};

const deleteCollectorDestinationRecords = async ({
    databases,
    databaseId,
    listAllDocuments,
    automationId
}) => {
    const safeAutomationId = String(automationId || '').trim();
    if (!safeAutomationId) return 0;

    const rows = await listAllDocuments(databases, AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID, [
        { method: 'equal', attribute: 'automation_id', values: [safeAutomationId] }
    ]);

    let deleted = 0;
    for (const row of rows) {
        await databases.deleteDocument(databaseId, AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID, row.$id);
        deleted += 1;
    }
    return deleted;
};

const mapPseudoQueries = (Query, queries = []) =>
    queries.map((query) => {
        if (query?.method === 'equal') {
            return Query.equal(query.attribute, query.values);
        }
        if (query?.method === 'limit') {
            return Query.limit(query.value);
        }
        return query;
    });

const createAutomationRecord = async ({
    databases,
    databaseId,
    payload,
    permissions,
    createDocumentWithUnknownAttributeRetry,
    preflight = null
}) => {
    if (typeof preflight === 'function') {
        await preflight();
    }
    return createDocumentWithUnknownAttributeRetry({
        databases,
        databaseId,
        collectionId: AUTOMATIONS_COLLECTION_ID,
        documentId: ID.unique(),
        payload,
        permissions
    });
};

const updateAutomationRecord = async ({
    databases,
    databaseId,
    automationId,
    payload,
    preflight = null
}) => {
    if (typeof preflight === 'function') {
        await preflight();
    }
    return databases.updateDocument(databaseId, AUTOMATIONS_COLLECTION_ID, automationId, payload);
};

const upsertSingletonAutomation = async ({
    databases,
    databaseId,
    Query,
    accountId,
    userId,
    automationType,
    payload,
    permissions,
    createDocumentWithUnknownAttributeRetry,
    preflight = null
}) => {
    if (typeof preflight === 'function') {
        await preflight();
    }
    const queries = mapPseudoQueries(Query, [
        { method: 'equal', attribute: 'user_id', values: [String(userId || '').trim()] },
        { method: 'equal', attribute: 'account_id', values: [String(accountId || '').trim()] },
        { method: 'equal', attribute: 'automation_type', values: [String(automationType || '').trim()] },
        { method: 'limit', value: 1 }
    ]);
    const existing = await databases.listDocuments(databaseId, AUTOMATIONS_COLLECTION_ID, queries);
    if (existing.total > 0) {
        const doc = existing.documents[0];
        await updateAutomationRecord({
            databases,
            databaseId,
            automationId: doc.$id,
            payload
        });
        return { mode: 'updated', documentId: doc.$id };
    }

    const created = await createAutomationRecord({
        databases,
        databaseId,
        payload,
        permissions,
        createDocumentWithUnknownAttributeRetry
    });
    return { mode: 'created', documentId: created.$id, document: created };
};

const deleteAutomationRecord = async ({
    databases,
    databaseId,
    automation,
    cleanupKeywords,
    cleanupCollectorDestinations,
    preflight = null
}) => {
    if (!automation?.$id) return;

    if (typeof preflight === 'function') {
        await preflight();
    }

    if (typeof cleanupCollectorDestinations === 'function') {
        await cleanupCollectorDestinations(automation);
    }
    if (typeof cleanupKeywords === 'function') {
        await cleanupKeywords(automation);
    }

    await databases.deleteDocument(databaseId, AUTOMATIONS_COLLECTION_ID, automation.$id);
};

const inspectAutomationDependencies = async ({
    automationType,
    automation = null,
    candidate = null,
    loadCollectionInfo = null,
    loadCollectorDocument = null
}) => {
    const safeType = normalizeAutomationType(automationType || automation?.automation_type || candidate?.automation_type);
    const relatedCollections = [
        AUTOMATIONS_COLLECTION_ID,
        KEYWORDS_COLLECTION_ID,
        KEYWORD_INDEX_COLLECTION_ID,
        AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID,
        LOGS_COLLECTION_ID,
        CHAT_STATES_COLLECTION_ID
    ];

    const result = {
        automationType: safeType,
        checkedCollections: [],
        existingCollectorDocument: null
    };

    if (typeof loadCollectionInfo === 'function') {
        for (const collectionId of relatedCollections) {
            await loadCollectionInfo(collectionId);
            result.checkedCollections.push(collectionId);
        }
    }

    if (typeof loadCollectorDocument === 'function' && automation?.$id) {
        result.existingCollectorDocument = await loadCollectorDocument();
    }

    return result;
};

module.exports = {
    AUTOMATION_TYPE_SCHEMAS,
    getAutomationSchema,
    inspectAutomationDependencies,
    normalizeAutomationType,
    buildAutomationEnvelope,
    createAutomationRecord,
    updateAutomationRecord,
    upsertSingletonAutomation,
    deleteAutomationRecord,
    deleteCollectorDestinationRecords
};

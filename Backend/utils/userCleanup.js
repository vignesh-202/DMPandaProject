const { Query } = require('node-appwrite');
const {
    APPWRITE_DATABASE_ID,
    USERS_COLLECTION_ID,
    SETTINGS_COLLECTION_ID,
    CAMPAIGNS_COLLECTION_ID,
    IG_ACCOUNTS_COLLECTION_ID,
    TRANSACTIONS_COLLECTION_ID,
    PROFILES_COLLECTION_ID,
    AUTOMATIONS_COLLECTION_ID,
    REPLY_TEMPLATES_COLLECTION_ID,
    INBOX_MENUS_COLLECTION_ID,
    CONVO_STARTERS_COLLECTION_ID,
    SUPER_PROFILES_COLLECTION_ID,
    COMMENT_MODERATION_COLLECTION_ID,
    CHAT_STATES_COLLECTION_ID,
    AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID,
    KEYWORDS_COLLECTION_ID,
    KEYWORD_INDEX_COLLECTION_ID
} = require('./appwrite');

const isMissingCollectionError = (error) =>
    error?.code === 404
    && String(error?.message || '').toLowerCase().includes('collection');

const isMissingAttributeError = (error) => {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('attribute not found in schema')
        || (message.includes('invalid query') && message.includes('attribute'));
};

const deleteDocumentsMatchingQueries = async (databases, collectionId, queries = []) => {
    let deletedCount = 0;

    while (true) {
        let result;
        try {
            result = await databases.listDocuments(
                APPWRITE_DATABASE_ID,
                collectionId,
                [...queries, Query.limit(100)]
            );
        } catch (error) {
            if (isMissingCollectionError(error) || isMissingAttributeError(error)) {
                return deletedCount;
            }
            throw error;
        }

        if (!result.documents.length) break;

        const deletions = await Promise.allSettled(
            result.documents.map((doc) =>
                databases.deleteDocument(APPWRITE_DATABASE_ID, collectionId, doc.$id)
            )
        );

        deletions.forEach((item) => {
            if (item.status === 'fulfilled') {
                deletedCount += 1;
            }
        });
    }

    return deletedCount;
};

const deleteByEquality = async (databases, collectionId, field, value) => {
    if (value === undefined || value === null || String(value).trim() === '') return 0;
    return deleteDocumentsMatchingQueries(databases, collectionId, [Query.equal(field, String(value))]);
};

const cleanupUserOwnedData = async (databases, userId) => {
    let igAccountsResult = { documents: [] };
    try {
        igAccountsResult = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            [Query.equal('user_id', String(userId)), Query.limit(100)]
        );
    } catch (error) {
        if (!isMissingCollectionError(error) && !isMissingAttributeError(error)) {
            throw error;
        }
    }

    const linkedAccountIds = Array.from(
        new Set(
            (igAccountsResult.documents || [])
                .flatMap((account) => [
                    account?.account_id,
                    account?.ig_user_id,
                    account?.$id
                ])
                .map((value) => String(value || '').trim())
                .filter(Boolean)
        )
    );

    const accountScopedCollections = [
        AUTOMATIONS_COLLECTION_ID,
        REPLY_TEMPLATES_COLLECTION_ID,
        INBOX_MENUS_COLLECTION_ID,
        CONVO_STARTERS_COLLECTION_ID,
        SUPER_PROFILES_COLLECTION_ID,
        COMMENT_MODERATION_COLLECTION_ID,
        CHAT_STATES_COLLECTION_ID,
        AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID,
        KEYWORDS_COLLECTION_ID,
        KEYWORD_INDEX_COLLECTION_ID
    ];

    for (const accountId of linkedAccountIds) {
        for (const collectionId of accountScopedCollections) {
            await deleteByEquality(databases, collectionId, 'account_id', accountId);
        }
    }

    const userScopedCollections = [
        SETTINGS_COLLECTION_ID,
        CAMPAIGNS_COLLECTION_ID,
        PROFILES_COLLECTION_ID,
        AUTOMATIONS_COLLECTION_ID,
        REPLY_TEMPLATES_COLLECTION_ID,
        INBOX_MENUS_COLLECTION_ID,
        CONVO_STARTERS_COLLECTION_ID,
        SUPER_PROFILES_COLLECTION_ID,
        COMMENT_MODERATION_COLLECTION_ID,
        CHAT_STATES_COLLECTION_ID,
        AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID,
        IG_ACCOUNTS_COLLECTION_ID
    ];

    for (const collectionId of userScopedCollections) {
        await deleteByEquality(databases, collectionId, 'user_id', userId);
    }

    await deleteByEquality(databases, TRANSACTIONS_COLLECTION_ID, 'userId', userId);
    await deleteByEquality(databases, TRANSACTIONS_COLLECTION_ID, 'user_id', userId);
    await deleteByEquality(databases, USERS_COLLECTION_ID, '$id', userId);
};

module.exports = {
    cleanupUserOwnedData
};

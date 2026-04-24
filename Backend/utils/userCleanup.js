const crypto = require('crypto');
const { Query } = require('node-appwrite');
const {
    APPWRITE_DATABASE_ID,
    USERS_COLLECTION_ID,
    SETTINGS_COLLECTION_ID,
    CAMPAIGNS_COLLECTION_ID,
    IG_ACCOUNTS_COLLECTION_ID,
    TRANSACTIONS_COLLECTION_ID,
    PAYMENT_ATTEMPTS_COLLECTION_ID,
    COUPON_REDEMPTIONS_COLLECTION_ID,
    PROFILES_COLLECTION_ID,
    AUTOMATIONS_COLLECTION_ID,
    REPLY_TEMPLATES_COLLECTION_ID,
    INBOX_MENUS_COLLECTION_ID,
    CONVO_STARTERS_COLLECTION_ID,
    SUPER_PROFILES_COLLECTION_ID,
    COMMENT_MODERATION_COLLECTION_ID,
    CHAT_STATES_COLLECTION_ID,
    AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID,
    AUTOMATION_COLLECTED_EMAILS_COLLECTION_ID,
    LOGS_COLLECTION_ID,
    ADMIN_AUDIT_LOGS_COLLECTION_ID,
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

const buildDeletedUserReference = (userId) => {
    const hash = crypto
        .createHash('sha256')
        .update(`deleted-user:${String(userId || '').trim()}`)
        .digest('hex');
    return `deleted:${hash.slice(0, 32)}`;
};

const anonymizeTransactionsForUser = async (databases, userId) => {
    const deletedUserRef = buildDeletedUserReference(userId);
    let updated = 0;
    const fields = ['userId', 'user_id'];

    for (const field of fields) {
        while (true) {
            let result;
            try {
                result = await databases.listDocuments(
                    APPWRITE_DATABASE_ID,
                    TRANSACTIONS_COLLECTION_ID,
                    [Query.equal(field, String(userId)), Query.limit(100)]
                );
            } catch (error) {
                if (isMissingCollectionError(error) || isMissingAttributeError(error)) {
                    break;
                }
                throw error;
            }

            if (!result.documents.length) break;

            const updates = await Promise.allSettled(result.documents.map((doc) => {
                const patch = {
                    userId: deletedUserRef
                };
                if (Object.prototype.hasOwnProperty.call(doc, 'notes')) {
                    patch.notes = String(doc.notes || '').trim()
                        ? `${String(doc.notes).trim()} [user deleted/anonymized]`
                        : 'user deleted/anonymized';
                }
                return databases.updateDocument(
                    APPWRITE_DATABASE_ID,
                    TRANSACTIONS_COLLECTION_ID,
                    doc.$id,
                    patch
                );
            }));

            updates.forEach((item) => {
                if (item.status === 'fulfilled') {
                    updated += 1;
                }
            });

            if (result.documents.length < 100) break;
        }
    }

    return updated;
};

const cleanupUserOwnedData = async (databases, userId, options = {}) => {
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) return { deleted: 0, anonymized_transactions: 0 };

    let igAccountsResult = { documents: [] };
    try {
        igAccountsResult = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            [Query.equal('user_id', safeUserId), Query.limit(100)]
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
        AUTOMATION_COLLECTED_EMAILS_COLLECTION_ID,
        LOGS_COLLECTION_ID,
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
        AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID,
        AUTOMATION_COLLECTED_EMAILS_COLLECTION_ID,
        IG_ACCOUNTS_COLLECTION_ID,
        ADMIN_AUDIT_LOGS_COLLECTION_ID
    ];

    for (const collectionId of userScopedCollections) {
        const userField = collectionId === ADMIN_AUDIT_LOGS_COLLECTION_ID ? 'target_user_id' : 'user_id';
        await deleteByEquality(databases, collectionId, userField, safeUserId);
    }

    await deleteByEquality(databases, PAYMENT_ATTEMPTS_COLLECTION_ID, 'user_id', safeUserId);
    await deleteByEquality(databases, COUPON_REDEMPTIONS_COLLECTION_ID, 'user_id', safeUserId);

    const anonymizedTransactions = options.retainFinancialRecords === false
        ? (
            await deleteByEquality(databases, TRANSACTIONS_COLLECTION_ID, 'userId', safeUserId)
            + await deleteByEquality(databases, TRANSACTIONS_COLLECTION_ID, 'user_id', safeUserId)
        )
        : await anonymizeTransactionsForUser(databases, safeUserId);

    await deleteByEquality(databases, USERS_COLLECTION_ID, '$id', safeUserId);
    return {
        anonymized_transactions: anonymizedTransactions
    };
};

module.exports = {
    cleanupUserOwnedData,
    anonymizeTransactionsForUser,
    buildDeletedUserReference
};

const { Client, Account, Databases, Users, Storage, Functions, Messaging } = require('node-appwrite');
require('dotenv').config();

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;

const getAppwriteClient = (options = {}) => {
    const { useApiKey = false, sessionToken = null, headers = {} } = options;
    const client = new Client()
        .setEndpoint(APPWRITE_ENDPOINT)
        .setProject(APPWRITE_PROJECT_ID);

    if (useApiKey) {
        client.setKey(APPWRITE_API_KEY);
    }

    if (sessionToken) {
        client.setSession(sessionToken);
    }

    // Add any extra headers if provided
    Object.keys(headers).forEach(key => {
        if (headers[key]) {
            client.addHeader(key, headers[key]);
        }
    });

    return client;
};

module.exports = {
    getAppwriteClient,
    Functions,
    Messaging,
    APPWRITE_DATABASE_ID: process.env.APPWRITE_DATABASE_ID || process.env.DATABASE_ID,
    USERS_COLLECTION_ID: 'users',
    SETTINGS_COLLECTION_ID: 'settings',
    ADMIN_SETTINGS_COLLECTION_ID: 'admin_settings',
    CAMPAIGNS_COLLECTION_ID: 'campaigns',
    EMAIL_CAMPAIGNS_COLLECTION_ID: 'email_campaigns',
    IG_ACCOUNTS_COLLECTION_ID: 'ig_accounts',
    TRANSACTIONS_COLLECTION_ID: 'transactions',
    PAYMENT_ATTEMPTS_COLLECTION_ID: 'payment_attempts',
    PRICING_COLLECTION_ID: 'pricing',
    COUPONS_COLLECTION_ID: 'coupons',
    COUPON_REDEMPTIONS_COLLECTION_ID: 'coupon_redemptions',
    INACTIVE_USER_CLEANUP_AUDIT_COLLECTION_ID: 'inactive_user_cleanup_audit',
    PROFILES_COLLECTION_ID: 'profiles',
    AUTOMATIONS_COLLECTION_ID: 'automations',
    REPLY_TEMPLATES_COLLECTION_ID: 'reply_templates',
    INBOX_MENUS_COLLECTION_ID: 'inbox_menus',
    CONVO_STARTERS_COLLECTION_ID: 'convo_starters',
    SUPER_PROFILES_COLLECTION_ID: 'super_profiles',
    COMMENT_MODERATION_COLLECTION_ID: 'comment_moderation',
    LOGS_COLLECTION_ID: 'logs',
    CHAT_STATES_COLLECTION_ID: 'chat_states',
    AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID: 'automation_collect_destinations',
    AUTOMATION_COLLECTED_EMAILS_COLLECTION_ID: 'automation_collected_emails',
    KEYWORDS_COLLECTION_ID: 'keywords',
    KEYWORD_INDEX_COLLECTION_ID: 'keyword_index',
    ADMIN_AUDIT_LOGS_COLLECTION_ID: 'admin_audit_logs',
    // Function IDs
    FUNCTION_REMOVE_INSTAGRAM: process.env.FUNCTION_REMOVE_INSTAGRAM,
    FUNCTION_INACTIVE_USER_CLEANUP: process.env.FUNCTION_INACTIVE_USER_CLEANUP
};


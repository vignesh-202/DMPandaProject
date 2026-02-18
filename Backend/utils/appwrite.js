const { Client, Account, Databases, Users, Storage, Functions } = require('node-appwrite');
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
    APPWRITE_DATABASE_ID: process.env.APPWRITE_DATABASE_ID,
    USERS_COLLECTION_ID: 'users',
    SETTINGS_COLLECTION_ID: 'settings',
    CAMPAIGNS_COLLECTION_ID: 'campaigns',
    IG_ACCOUNTS_COLLECTION_ID: 'ig_accounts',
    PRICING_COLLECTION_ID: 'pricing',
    AUTOMATIONS_COLLECTION_ID: 'automations',
    REPLY_TEMPLATES_COLLECTION_ID: 'reply_templates',
    INBOX_MENUS_COLLECTION_ID: 'inbox_menus',
    CONVO_STARTERS_COLLECTION_ID: 'convo_starters',
    MENTIONS_COLLECTION_ID: 'mentions',
    SUPER_PROFILES_COLLECTION_ID: 'super_profiles',
    SUGGEST_MORE_COLLECTION_ID: 'suggest_more',
    COMMENT_MODERATION_COLLECTION_ID: 'comment_moderation',
    KEYWORDS_COLLECTION_ID: 'keywords',
    KEYWORD_INDEX_COLLECTION_ID: 'keyword_index',
    // Function IDs
    FUNCTION_REMOVE_INSTAGRAM: process.env.FUNCTION_REMOVE_INSTAGRAM
};


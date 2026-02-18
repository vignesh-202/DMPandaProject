const { Client, Account, Databases, Users, Storage } = require('node-appwrite');
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
        // node-appwrite Server SDK does not have setSession. We must set the header directly.
        client.addHeader('X-Appwrite-Session', sessionToken);
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
    APPWRITE_DATABASE_ID: process.env.APPWRITE_DATABASE_ID,
    USERS_COLLECTION_ID: 'users',
    SETTINGS_COLLECTION_ID: 'settings',
    CAMPAIGNS_COLLECTION_ID: 'campaigns',
    IG_ACCOUNTS_COLLECTION_ID: 'ig_accounts',
    PRICING_COLLECTION_ID: 'pricing'
};

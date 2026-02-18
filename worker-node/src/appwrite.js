const { Client, Databases, Query } = require('node-appwrite');
require('dotenv').config();

class AppwriteClient {
    constructor() {
        this.client = new Client();
        this.client
            .setEndpoint(process.env.APPWRITE_ENDPOINT)
            .setProject(process.env.APPWRITE_PROJECT_ID)
            .setKey(process.env.APPWRITE_API_KEY);
        this.databases = new Databases(this.client);
        this.databaseId = process.env.APPWRITE_DATABASE_ID;
    }

    async getIGAccount(accountId) {
        try {
            let response = await this.databases.listDocuments(
                this.databaseId,
                process.env.IG_ACCOUNTS_COLLECTION_ID,
                [Query.equal('ig_user_id', accountId)]
            );
            if (response.documents.length === 0) {
                response = await this.databases.listDocuments(
                    this.databaseId,
                    process.env.IG_ACCOUNTS_COLLECTION_ID,
                    [Query.equal('account_id', accountId)]
                );
            }
            if (response.documents.length === 0) {
                response = await this.databases.listDocuments(
                    this.databaseId,
                    process.env.IG_ACCOUNTS_COLLECTION_ID,
                    [Query.equal('ig_user_id', accountId)]
                );
            }
            return response.documents.length > 0 ? response.documents[0] : null;
        } catch (error) {
            console.error(`Error fetching IG account ${accountId}:`, error);
            return null;
        }
    }

    async getActiveAutomations(accountId, automationType = 'dm') {
        try {
            const response = await this.databases.listDocuments(
                this.databaseId,
                process.env.AUTOMATIONS_COLLECTION_ID,
                [
                    Query.equal('account_id', accountId),
                    Query.equal('automation_type', automationType),
                    Query.equal('is_active', true)
                ]
            );
            return response.documents;
        } catch (error) {
            console.error(`Error fetching automations for ${accountId}:`, error);
            return [];
        }
    }

    async getTemplate(templateId, accountId = null) {
        try {
            const template = await this.databases.getDocument(
                this.databaseId,
                'reply_templates',
                templateId
            );
            if (accountId && template.account_id && String(template.account_id) !== String(accountId)) {
                return null;
            }
            return template;
        } catch (error) {
            if (error.code !== 404) {
                console.error(`Error fetching template ${templateId}:`, error);
            }
            return null;
        }
    }
}

module.exports = AppwriteClient;



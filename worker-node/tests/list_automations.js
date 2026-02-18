
const { Client, Databases, Query } = require('node-appwrite');
require('dotenv').config();

async function listAutomations() {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT)
        .setProject(process.env.APPWRITE_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);

    try {
        const response = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            process.env.AUTOMATIONS_COLLECTION_ID,
            [Query.equal('ig_account_id', '1784140686974678')]
        );
        console.log("Automations for 1784140686974678:");
        response.documents.forEach(doc => {
            console.log(`- ID: ${doc.$id}, Keyword: ${doc.keyword}, Active: ${doc.active}`);
        });
    } catch (error) {
        console.error("Error listing automations:", error);
    }
}

listAutomations();

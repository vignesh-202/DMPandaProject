
const { Client, Databases } = require('node-appwrite');
require('dotenv').config();

async function listAccounts() {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT)
        .setProject(process.env.APPWRITE_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);

    try {
        const response = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            process.env.IG_ACCOUNTS_COLLECTION_ID
        );
        console.log("IG Accounts in DB:");
        response.documents.forEach(doc => {
            console.log(`- ID: ${doc.$id}, IG User ID: ${doc.ig_user_id}, User ID: ${doc.user_id}, Username: ${doc.username}`);
        });
    } catch (error) {
        console.error("Error listing accounts:", error);
    }
}

listAccounts();

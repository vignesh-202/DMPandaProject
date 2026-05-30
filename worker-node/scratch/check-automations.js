const AppwriteClient = require('../src/appwrite');
require('dotenv').config();

async function run() {
    const client = new AppwriteClient();
    const result = await client.databases.listDocuments(
        client.databaseId,
        process.env.AUTOMATIONS_COLLECTION_ID || 'automations'
    );
    console.log('Automations:');
    for (const doc of result.documents) {
        console.log(JSON.stringify({
            id: doc.$id,
            title: doc.title,
            automation_type: doc.automation_type,
            comment_reply: doc.comment_reply,
            comment_reply_text: doc.comment_reply_text,
            is_active: doc.is_active,
            keywords: doc.keywords
        }, null, 2));
    }
}

run().catch(console.error);

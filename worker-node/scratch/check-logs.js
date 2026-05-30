const { Client, Databases, Query } = require('node-appwrite');
require('dotenv').config();

async function run() {
    const client = new Client();
    client
        .setEndpoint(process.env.APPWRITE_ENDPOINT)
        .setProject(process.env.APPWRITE_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);
        
    const databases = new Databases(client);
    const result = await databases.listDocuments(
        process.env.APPWRITE_DATABASE_ID,
        process.env.LOGS_COLLECTION_ID || 'logs',
        [
            Query.limit(20),
            Query.orderDesc('$createdAt')
        ]
    );
    console.log('Logs:');
    for (const doc of result.documents) {
        console.log(JSON.stringify({
            id: doc.$id,
            createdAt: doc.$createdAt,
            source: doc.source,
            message: doc.message,
            status: doc.status,
            payload: doc.payload
        }, null, 2));
    }
}

run().catch(console.error);

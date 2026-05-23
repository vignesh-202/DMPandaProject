require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Databases } = require('node-appwrite');
const { getAppwriteClient, REPLY_TEMPLATES_COLLECTION_ID } = require('../utils/appwrite');

async function main() {
    const client = getAppwriteClient({ useApiKey: true });
    const databases = new Databases(client);
    const dbId = process.env.APPWRITE_DATABASE_ID || process.env.DATABASE_ID;
    try {
        const result = await databases.listDocuments(dbId, REPLY_TEMPLATES_COLLECTION_ID);
        result.documents.forEach(doc => {
            console.log('Template:', doc.name, '($id:', doc.$id, ')');
            console.log('Raw:', doc.template_data);
            console.log('---');
        });
    } catch (err) {
        console.error('Error:', err);
    }
}

main();

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Databases } = require('node-appwrite');
const { getAppwriteClient, USERS_COLLECTION_ID, REPLY_TEMPLATES_COLLECTION_ID } = require('../utils/appwrite');

async function main() {
    const client = getAppwriteClient({ useApiKey: true });
    const databases = new Databases(client);
    const dbId = process.env.APPWRITE_DATABASE_ID || process.env.DATABASE_ID;
    console.log('Database ID:', dbId);
    try {
        const result = await databases.listDocuments(dbId, REPLY_TEMPLATES_COLLECTION_ID);
        console.log(`Found ${result.documents.length} templates:`);
        for (const doc of result.documents) {
            console.log('----------------------------------------');
            console.log('ID:', doc.$id);
            console.log('Name:', doc.name);
            console.log('Type:', doc.template_type);
            console.log('Template Data (raw):', doc.template_data);
            try {
                const parsed = JSON.parse(doc.template_data);
                console.log('Template Data (parsed):', parsed);
            } catch (e) {
                console.log('Template Data parsing failed:', e.message);
            }
        }
    } catch (err) {
        console.error('Error listing templates:', err);
    }
}

main();

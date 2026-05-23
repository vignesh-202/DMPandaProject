require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Databases } = require('node-appwrite');
const { getAppwriteClient, REPLY_TEMPLATES_COLLECTION_ID } = require('../utils/appwrite');

async function main() {
    const client = getAppwriteClient({ useApiKey: true });
    const databases = new Databases(client);
    const dbId = process.env.APPWRITE_DATABASE_ID || process.env.DATABASE_ID;
    try {
        const result = await databases.listDocuments(dbId, REPLY_TEMPLATES_COLLECTION_ID);
        const target = result.documents.find(doc => doc.name.toLowerCase().includes('test template') || doc.$id.includes('test'));
        if (target) {
            console.log('FOUND TEMPLATE:');
            console.log(JSON.stringify(target, null, 2));
        } else {
            console.log('Template not found. Listing all templates names:');
            result.documents.forEach(doc => console.log(doc.$id, doc.name, doc.template_type));
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

main();

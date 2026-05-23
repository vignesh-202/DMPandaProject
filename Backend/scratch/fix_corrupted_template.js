require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Databases } = require('node-appwrite');
const { getAppwriteClient, REPLY_TEMPLATES_COLLECTION_ID } = require('../utils/appwrite');

const TEMPLATE_ID = '699a9d980030b6ff8be9';

async function main() {
    const client = getAppwriteClient({ useApiKey: true });
    const databases = new Databases(client);
    const dbId = process.env.APPWRITE_DATABASE_ID || process.env.DATABASE_ID;

    try {
        // First, read the current template
        const doc = await databases.getDocument(dbId, REPLY_TEMPLATES_COLLECTION_ID, TEMPLATE_ID);
        console.log('Current template:', doc.name, doc.template_type);
        
        const currentData = JSON.parse(doc.template_data);
        console.log('Current text (first 100 chars):', (currentData.text || '').substring(0, 100));
        console.log('Current replies:', JSON.stringify(currentData.replies?.map(r => ({ title: r.title, payload_preview: (r.payload || '').substring(0, 50) }))));

        // Fix the corrupted data - replace hex garbage with proper content
        const fixedData = {
            text: 'Welcome! How can I help you today?',
            replies: (currentData.replies || []).map(reply => ({
                title: reply.title || 'Reply',
                payload: `You selected: ${reply.title || 'Reply'}`,
                content_type: reply.content_type || 'text'
            }))
        };

        console.log('\nFixed data:', JSON.stringify(fixedData, null, 2));

        // Update the document
        await databases.updateDocument(dbId, REPLY_TEMPLATES_COLLECTION_ID, TEMPLATE_ID, {
            template_data: JSON.stringify(fixedData)
        });

        console.log('\n✅ Template data fixed successfully!');
        
        // Verify the fix
        const verifyDoc = await databases.getDocument(dbId, REPLY_TEMPLATES_COLLECTION_ID, TEMPLATE_ID);
        const verifyData = JSON.parse(verifyDoc.template_data);
        console.log('Verified text:', verifyData.text);
        console.log('Verified replies:', JSON.stringify(verifyData.replies));
    } catch (err) {
        console.error('Error:', err);
    }
}

main();

const { Client, Databases, Query } = require('node-appwrite');
require('dotenv').config();

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const PRICING_COLLECTION_ID = 'pricing';

const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);

async function updatePlans() {
    try {
        console.log('Fetching pricing plans...');
        const response = await databases.listDocuments(APPWRITE_DATABASE_ID, PRICING_COLLECTION_ID);
        const plans = response.documents;
        console.log(`Found ${plans.length} plans.`);

        for (const plan of plans) {
            console.log(`Updating plan: ${plan.name} (${plan.$id})`);
            
            // 1. Update features array
            let features = [];
            try {
                features = Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features || '[]');
            } catch (e) {
                features = (plan.features || '').split(',').map(f => f.trim()).filter(Boolean);
            }
            
            if (!features.includes('Once Per User / 24h')) {
                features.push('Once Per User / 24h');
            }

            // 2. Update comparison_json
            let comparison = [];
            try {
                comparison = JSON.parse(plan.comparison_json || '[]');
            } catch (e) {}

            const existingComp = comparison.find(c => c.key === 'once_per_user_24h');
            if (!existingComp) {
                comparison.push({
                    key: 'once_per_user_24h',
                    label: 'Once Per User / 24h',
                    value: true
                });
            } else {
                existingComp.value = true;
            }

            // 3. Update benefit_once_per_user_24h field if it exists
            const updatePayload = {
                features: JSON.stringify(features),
                comparison_json: JSON.stringify(comparison),
                benefit_once_per_user_24h: true
            };

            await databases.updateDocument(
                APPWRITE_DATABASE_ID,
                PRICING_COLLECTION_ID,
                plan.$id,
                updatePayload
            );
            console.log(`Successfully updated ${plan.name}`);
        }
        console.log('All plans updated successfully.');
    } catch (error) {
        console.error('Error updating plans:', error);
    }
}

updatePlans();

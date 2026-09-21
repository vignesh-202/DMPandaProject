const path = require('path');
require(path.join(__dirname, '../Backend/node_modules/dotenv')).config({ path: path.join(__dirname, '../Backend/.env') });
const { getAppwriteClient, APPWRITE_DATABASE_ID } = require('../Backend/utils/appwrite');
const { Databases, Functions } = require(path.join(__dirname, '../Backend/node_modules/node-appwrite'));
const fs = require('fs');

async function main() {
    const client = getAppwriteClient({ useApiKey: true });
    const db = new Databases(client);
    const functions = new Functions(client);

    console.log('Fetching collections for database:', APPWRITE_DATABASE_ID);
    const collRes = await db.listCollections(APPWRITE_DATABASE_ID);
    console.log('Found collections:', collRes.total);

    const schemaReport = [];

    for (const c of collRes.collections) {
        const attrRes = await db.listAttributes(APPWRITE_DATABASE_ID, c.$id);
        const attrs = attrRes.attributes.map(a => ({
            key: a.key,
            type: a.type,
            status: a.status,
            required: a.required,
            array: a.array,
            default: a.default
        }));
        schemaReport.push({
            id: c.$id,
            name: c.name,
            attributesCount: attrs.length,
            attributes: attrs
        });
    }

    fs.writeFileSync('schema_audit.json', JSON.stringify(schemaReport, null, 2));
    console.log('Saved schema_audit.json');

    console.log('Fetching functions...');
    const fnList = await functions.list();
    console.log('Total deployed functions:', fnList.total);
    const fnReport = [];
    for (const f of fnList.functions) {
        let deployments = { total: 0, deployments: [] };
        try {
            deployments = await functions.listDeployments(f.$id);
        } catch (err) {
            console.log('Could not fetch deployments for', f.$id, err.message);
        }
        fnReport.push({
            id: f.$id,
            name: f.name,
            runtime: f.runtime,
            enabled: f.enabled,
            live: f.live,
            schedule: f.schedule,
            deploymentId: f.deployment,
            totalDeployments: deployments.total,
            deployments: deployments.deployments.map(d => ({
                id: d.$id,
                status: d.status,
                buildTime: d.buildTime,
                size: d.size,
                entrypoint: d.entrypoint
            }))
        });
    }

    fs.writeFileSync('functions_audit.json', JSON.stringify(fnReport, null, 2));
    console.log('Saved functions_audit.json');
}

main().catch(err => {
    console.error('Error:', err);
});

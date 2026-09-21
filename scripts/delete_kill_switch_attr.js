const path = require('path');
require(path.join(__dirname, '../Backend/node_modules/dotenv')).config({ path: path.join(__dirname, '../Backend/.env') });
const { getAppwriteClient, APPWRITE_DATABASE_ID } = require('../Backend/utils/appwrite');
const { Databases } = require(path.join(__dirname, '../Backend/node_modules/node-appwrite'));

async function main() {
    const client = getAppwriteClient({ useApiKey: true });
    const db = new Databases(client);

    console.log('Checking users collection attributes...');
    const attrs = await db.listAttributes(APPWRITE_DATABASE_ID, 'users');
    const hasKillSwitch = attrs.attributes.some(a => a.key === 'kill_switch_enabled');

    if (hasKillSwitch) {
        console.log('Found kill_switch_enabled in users collection. Deleting attribute...');
        await db.deleteAttribute(APPWRITE_DATABASE_ID, 'users', 'kill_switch_enabled');
        console.log('Successfully deleted kill_switch_enabled attribute from users collection!');
    } else {
        console.log('kill_switch_enabled attribute is already deleted or not present.');
    }
}

main().catch(err => {
    console.error('Error:', err.message);
});

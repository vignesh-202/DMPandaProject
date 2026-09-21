const fs = require('fs');
const path = require('path');

const schema = JSON.parse(fs.readFileSync('schema_audit.json'));
const schemaMap = {};
schema.forEach(c => {
    schemaMap[c.id] = new Set(c.attributes.map(a => a.key));
});

const functionsDir = 'functions';
const dirs = fs.readdirSync(functionsDir).filter(d => fs.statSync(path.join(functionsDir, d)).isDirectory());

console.log('=== DRIFT AUDIT: FUNCTIONS VS APPWRITE SCHEMA ===\n');

const discrepancies = [];

dirs.forEach(d => {
    const mainPy = path.join(functionsDir, d, 'main.py');
    if (!fs.existsSync(mainPy)) return;
    const content = fs.readFileSync(mainPy, 'utf8');

    // Find update_document or create_document calls or patch dictionaries
    // Look for dictionary keys in patch = { ... } or data = { ... }
    const patchMatches = content.matchAll(/(?:patch|data|payload|doc|fields)\s*=\s*\{([^}]+)\}/gs);
    for (const match of patchMatches) {
        const dictBody = match[1];
        const keyMatches = dictBody.matchAll(/["']([a-zA-Z0-9_]+)["']\s*:/g);
        for (const km of keyMatches) {
            const key = km[1];
            // Check which collection this might belong to
            // If the key is not in the corresponding collection, report it
            // Let's check against ig_accounts, users, automations, etc.
            if (content.includes('ig_accounts') && (key.includes('credit') || key.includes('action_limit') || key.includes('plan'))) {
                if (!schemaMap['ig_accounts'].has(key)) {
                    discrepancies.push({
                        function: d,
                        collection: 'ig_accounts',
                        attribute: key,
                        existsInSchema: false
                    });
                }
            }
            if (content.includes('users') && (key.includes('kill_switch') || key.includes('plan_code'))) {
                if (!schemaMap['users'].has(key)) {
                    discrepancies.push({
                        function: d,
                        collection: 'users',
                        attribute: key,
                        existsInSchema: false
                    });
                }
            }
        }
    }
});

console.log('Discrepancies found:', discrepancies);
fs.writeFileSync('drift_audit.json', JSON.stringify(discrepancies, null, 2));

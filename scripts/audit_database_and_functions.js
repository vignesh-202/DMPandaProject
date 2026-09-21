const fs = require('fs');
const path = require('path');

const schema = JSON.parse(fs.readFileSync('schema_audit.json'));
const fns = JSON.parse(fs.readFileSync('functions_audit.json'));

console.log('=== TOTAL COLLECTIONS:', schema.length);
console.log('=== TOTAL FUNCTIONS:', fns.length);

// Directories to search
const searchDirs = [
    'Backend',
    'Frontend/src',
    'admin-panel/src',
    'streamer-node',
    'worker-node',
    'functions',
    'shared'
];

function getAllFiles(dirPath, arrayOfFiles = []) {
    if (!fs.existsSync(dirPath)) return arrayOfFiles;
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (!['node_modules', '.git', 'dist', '.venv', '__pycache__'].includes(file)) {
                getAllFiles(fullPath, arrayOfFiles);
            }
        } else {
            if (/\.(js|ts|tsx|jsx|json|py)$/.test(file)) {
                arrayOfFiles.push(fullPath);
            }
        }
    }
    return arrayOfFiles;
}

let allFiles = [];
for (const d of searchDirs) {
    allFiles = allFiles.concat(getAllFiles(d));
}
console.log('Indexed code files for auditing:', allFiles.length);

const fileContents = allFiles.map(f => ({
    path: f,
    content: fs.readFileSync(f, 'utf8')
}));

const report = {
    collections: [],
    functionsAnalysis: []
};

for (const coll of schema) {
    const collName = coll.id;
    let collUsageCount = 0;
    for (const f of fileContents) {
        if (f.content.includes(collName)) {
            collUsageCount++;
        }
    }

    const attrReports = [];
    for (const attr of coll.attributes) {
        let attrUsageCount = 0;
        const matchingFiles = [];
        for (const f of fileContents) {
            // Simple match for attribute key
            if (f.content.includes(attr.key)) {
                attrUsageCount++;
                matchingFiles.push(f.path);
            }
        }
        attrReports.push({
            key: attr.key,
            type: attr.type,
            required: attr.required,
            usageCount: attrUsageCount,
            isUsed: attrUsageCount > 0,
            sampleFiles: matchingFiles.slice(0, 3)
        });
    }

    report.collections.push({
        id: coll.id,
        name: coll.name,
        attributesCount: coll.attributes.length,
        usageCount: collUsageCount,
        attributes: attrReports
    });
}

// Function analysis
for (const fn of fns) {
    const fnDir = path.join('functions', fn.id);
    const existsLocally = fs.existsSync(fnDir);
    let fnFiles = [];
    if (existsLocally) {
        fnFiles = getAllFiles(fnDir);
    }
    
    // Check collections mentioned in function
    const referencedCollections = [];
    const fnContents = fnFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');
    for (const coll of schema) {
        if (fnContents.includes(coll.id)) {
            referencedCollections.push(coll.id);
        }
    }

    report.functionsAnalysis.push({
        id: fn.$id || fn.id,
        name: fn.name,
        runtime: fn.runtime,
        schedule: fn.schedule,
        existsLocally,
        referencedCollections,
        deploymentsCount: fn.totalDeployments,
        activeDeployment: fn.deploymentId
    });
}

fs.writeFileSync('db_functions_deep_audit.json', JSON.stringify(report, null, 2));
console.log('Saved db_functions_deep_audit.json successfully!');

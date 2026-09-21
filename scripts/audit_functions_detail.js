const fs = require('fs');
const path = require('path');
const schema = JSON.parse(fs.readFileSync('schema_audit.json'));
const collIds = new Set(schema.map(c => c.id));
const collAttrMap = {};
schema.forEach(c => {
  collAttrMap[c.id] = new Set(c.attributes.map(a => a.key));
});

const functionsDir = 'functions';
const dirs = fs.readdirSync(functionsDir).filter(d => fs.statSync(path.join(functionsDir, d)).isDirectory());

console.log('=== APPWRITE FUNCTIONS CODE INSPECTION ===\n');
const results = [];

dirs.forEach(d => {
  const mainPy = path.join(functionsDir, d, 'main.py');
  if (!fs.existsSync(mainPy)) return;
  const content = fs.readFileSync(mainPy, 'utf8');
  
  // Find collections mentioned
  const foundColls = [];
  collIds.forEach(c => {
    if (content.includes(`'${c}'`) || content.includes(`"${c}"`) || content.includes(`_${c.toUpperCase()}`)) {
      foundColls.push(c);
    }
  });
  
  // Check for get_document, update_document, create_document, list_documents
  const dbCalls = (content.match(/databases\.(get_document|update_document|create_document|delete_document|list_documents)\([^)]+\)/g) || []);
  
  const envMatches = (content.match(/os\.environ\.get\(['"][A-Z0-9_]+['"]/g) || [])
    .map(m => m.replace(/os\.environ\.get\(['"]|['"]/g, ''));

  results.push({
    name: d,
    collections: foundColls,
    envVars: [...new Set(envMatches)],
    dbCallCount: dbCalls.length,
    linesCount: content.split('\n').length
  });
  
  console.log(`Function: ${d} (${content.split('\n').length} lines)`);
  console.log(`  Collections: ${foundColls.join(', ') || 'None directly'}`);
  console.log(`  Env vars: ${[...new Set(envMatches)].join(', ')}`);
  console.log(`  DB Operations: ${dbCalls.length}\n`);
});

fs.writeFileSync('functions_detail_audit.json', JSON.stringify(results, null, 2));

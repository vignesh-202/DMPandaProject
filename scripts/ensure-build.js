const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const frontendIndex = path.join(__dirname, '..', 'Frontend', 'dist', 'index.html');
const adminIndex = path.join(__dirname, '..', 'admin-panel', 'dist', 'index.html');

const frontendReady = fs.existsSync(frontendIndex);
const adminReady = fs.existsSync(adminIndex);

if (frontendReady && adminReady) {
  console.log('[Build] Pre-compiled production bundles verified for Frontend & Admin Panel.');
  process.exit(0);
}

console.log(`[Build] Missing pre-compiled assets (Frontend: ${frontendReady}, Admin: ${adminReady}). Compiling...`);
try {
  execSync('npm run build-all', { stdio: 'inherit' });
  console.log('[Build] Compilation complete.');
} catch (err) {
  console.error('[Build] Compilation failed:', err.message);
  // Do not fail build if at least dist folder exists
  if (frontendReady || adminReady) {
    console.warn('[Build] Continuing with available assets.');
    process.exit(0);
  }
  process.exit(1);
}

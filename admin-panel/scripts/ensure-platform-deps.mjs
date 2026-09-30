import { execSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Ensures that platform-specific native binaries (e.g. @rollup/rollup-linux-x64-gnu)
 * are installed when running on Linux (e.g. Hostinger, CI/CD, Docker).
 * This works around npm bug #4828 where cross-platform optional dependencies are skipped.
 */
function ensurePlatformDeps() {
  if (process.platform === 'linux' && process.arch === 'x64') {
    let hasRollupGnu = false;
    try {
      require.resolve('@rollup/rollup-linux-x64-gnu');
      hasRollupGnu = true;
    } catch {
      hasRollupGnu = false;
    }

    if (!hasRollupGnu) {
      console.log('[ensure-platform-deps] @rollup/rollup-linux-x64-gnu is missing on Linux x64. Auto-installing fallback binary...');
      try {
        execSync('npm install --no-save --no-package-lock @rollup/rollup-linux-x64-gnu@4.53.3', {
          stdio: 'inherit'
        });
        console.log('[ensure-platform-deps] Successfully installed @rollup/rollup-linux-x64-gnu.');
      } catch (err) {
        console.warn('[ensure-platform-deps] Notice: npm auto-install attempt returned:', err.message);
      }
    } else {
      console.log('[ensure-platform-deps] Linux x64 rollup binary verified.');
    }
  }
}

ensurePlatformDeps();

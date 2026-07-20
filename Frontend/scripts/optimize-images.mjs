/**
 * Image Optimization Script for DM Panda Frontend
 * Converts PNG images to WebP format for dramatically smaller file sizes.
 * 
 * Usage: node scripts/optimize-images.mjs
 * 
 * Requires: npm install sharp (dev dependency)
 * 
 * This script:
 * 1. Scans public/images/ for large PNG files (>100KB)
 * 2. Generates WebP versions alongside the originals
 * 3. Reports size savings
 * 
 * Note: The originals are preserved. The app should prefer .webp with .png fallback.
 */

import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = join(__dirname, '..', 'public', 'images');
const MIN_SIZE = 100 * 1024; // Only optimize files > 100KB

async function optimizeImages() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('❌ sharp is not installed. Run: npm install -D sharp');
    process.exit(1);
  }

  const files = await readdir(IMAGES_DIR);
  const pngFiles = files.filter(f => extname(f).toLowerCase() === '.png');

  let totalSaved = 0;
  let processed = 0;

  for (const file of pngFiles) {
    const filePath = join(IMAGES_DIR, file);
    const fileInfo = await stat(filePath);

    if (fileInfo.size < MIN_SIZE) {
      console.log(`⏭  Skipping ${file} (${(fileInfo.size / 1024).toFixed(0)}KB — under threshold)`);
      continue;
    }

    const webpPath = join(IMAGES_DIR, basename(file, '.png') + '.webp');
    const originalSize = fileInfo.size;

    try {
      await sharp(filePath)
        .webp({ quality: 82, effort: 4 })
        .toFile(webpPath);

      const webpInfo = await stat(webpPath);
      const saved = originalSize - webpInfo.size;
      const pct = ((saved / originalSize) * 100).toFixed(1);

      console.log(
        `✅ ${file} → .webp | ${(originalSize / 1024).toFixed(0)}KB → ${(webpInfo.size / 1024).toFixed(0)}KB (${pct}% smaller)`
      );

      totalSaved += saved;
      processed++;
    } catch (err) {
      console.error(`❌ Failed to optimize ${file}:`, err.message);
    }
  }

  console.log(`\n📊 Optimized ${processed} images, saved ${(totalSaved / 1024 / 1024).toFixed(1)}MB total`);
}

optimizeImages().catch(console.error);

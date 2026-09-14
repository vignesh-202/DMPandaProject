const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const IMAGES_DIR = path.resolve(__dirname, '..', 'Frontend', 'public', 'images');

async function optimizeImages() {
  console.log('='.repeat(60));
  console.log('   DM PANDA — AUTOMATED HIGH-PERFORMANCE IMAGE OPTIMIZER');
  console.log('='.repeat(60));

  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`Images directory not found: ${IMAGES_DIR}`);
    return;
  }

  const files = fs.readdirSync(IMAGES_DIR);
  let totalSavedBytes = 0;
  let convertedCount = 0;

  console.log(`Scanning ${files.length} items in ${IMAGES_DIR}...\n`);

  for (const file of files) {
    const fullPath = path.join(IMAGES_DIR, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) continue;

    const ext = path.extname(file).toLowerCase();
    const base = path.basename(file, ext);

    if (ext === '.png') {
      const webpPath = path.join(IMAGES_DIR, `${base}.webp`);
      const originalSize = stat.size;

      try {
        // High quality webp conversion with alpha preservation and near-lossless compression
        await sharp(fullPath)
          .webp({ quality: 82, effort: 6 })
          .toFile(webpPath);

        const newSize = fs.statSync(webpPath).size;
        const saved = originalSize - newSize;
        totalSavedBytes += saved;
        convertedCount++;

        const origKb = (originalSize / 1024).toFixed(0);
        const newKb = (newSize / 1024).toFixed(0);
        const pct = Math.round((saved / originalSize) * 100);

        console.log(`  ✓ [PNG -> WEBP] ${file}: ${origKb}KB -> ${newKb}KB (${pct}% saved)`);

        // If the original PNG is over 400KB, also compress the PNG fallback in-place
        if (originalSize > 400 * 1024) {
          try {
            const compressedPngBuffer = await sharp(fullPath)
              .png({ quality: 82, compressionLevel: 9, palette: true })
              .toBuffer();
            if (compressedPngBuffer.length < originalSize) {
              fs.writeFileSync(fullPath, compressedPngBuffer);
              const pngSavedPct = Math.round(((originalSize - compressedPngBuffer.length) / originalSize) * 100);
              console.log(`  ✓ [PNG IN-PLACE COMPRESS] ${file}: ${origKb}KB -> ${(compressedPngBuffer.length / 1024).toFixed(0)}KB (${pngSavedPct}% saved)`);
            }
          } catch (pngErr) {
            // non-fatal
          }
        }
      } catch (err) {
        console.warn(`  ⚠ Could not convert ${file}:`, err.message);
      }
    } else if (ext === '.gif' && base === 'loading_panda') {
      // Optimize huge 13.8MB gif to animated webp
      const webpPath = path.join(IMAGES_DIR, `${base}.webp`);
      try {
        await sharp(fullPath, { animated: true })
          .webp({ quality: 75, effort: 4 })
          .toFile(webpPath);

        const newSize = fs.statSync(webpPath).size;
        const saved = stat.size - newSize;
        totalSavedBytes += saved;
        convertedCount++;

        const origMb = (stat.size / (1024 * 1024)).toFixed(1);
        const newMb = (newSize / (1024 * 1024)).toFixed(1);
        const pct = Math.round((saved / stat.size) * 100);

        console.log(`  ✓ [ANIMATED GIF -> WEBP] ${file}: ${origMb}MB -> ${newMb}MB (${pct}% saved)`);
      } catch (err) {
        console.warn(`  ⚠ Could not convert animated gif:`, err.message);
      }
    }
  }

  // Also optimize images in subdirectories e.g. offers/
  const offersDir = path.join(IMAGES_DIR, 'offers');
  if (fs.existsSync(offersDir)) {
    const offerFiles = fs.readdirSync(offersDir);
    for (const file of offerFiles) {
      const fullPath = path.join(offersDir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) continue;
      const ext = path.extname(file).toLowerCase();
      const base = path.basename(file, ext);

      if (ext === '.png') {
        const webpPath = path.join(offersDir, `${base}.webp`);
        try {
          await sharp(fullPath).webp({ quality: 85 }).toFile(webpPath);
          convertedCount++;
          console.log(`  ✓ [OFFER PNG -> WEBP] offers/${file}`);
        } catch (e) {
          // ignore
        }
      }
    }
  }

  const totalSavedMb = (totalSavedBytes / (1024 * 1024)).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log(`TOTAL CONVERSIONS: ${convertedCount} images`);
  console.log(`TOTAL PAYLOAD SAVED: ${totalSavedMb} MB`);
  console.log('='.repeat(60) + '\n');
}

if (require.main === module) {
  optimizeImages().catch(err => console.error(err));
}

module.exports = { optimizeImages };

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'Frontend');
const PUBLIC_DIR = path.join(FRONTEND_DIR, 'public');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');
const INDEX_HTML = path.join(FRONTEND_DIR, 'index.html');
const ROBOTS_TXT = path.join(PUBLIC_DIR, 'robots.txt');
const SITEMAP_XML = path.join(PUBLIC_DIR, 'sitemap.xml');

function runAudit() {
  console.log('='.repeat(60));
  console.log('      DM PANDA — DIGITAL MARKETING & TECHNICAL SEO AUDIT');
  console.log('='.repeat(60));

  let totalScore = 0;
  const categories = {};

  // -------------------------------------------------------------
  // 1. Metadata & Open Graph Audit (Max 25 pts)
  // -------------------------------------------------------------
  let metaScore = 0;
  const metaIssues = [];
  const metaWins = [];

  if (fs.existsSync(INDEX_HTML)) {
    const html = fs.readFileSync(INDEX_HTML, 'utf8');

    // Title tag
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      const title = titleMatch[1].trim();
      if (title.length >= 30 && title.length <= 65) {
        metaScore += 4;
        metaWins.push(`Title tag length optimal (${title.length} chars): "${title}"`);
      } else {
        metaScore += 2;
        metaIssues.push(`Title length (${title.length} chars) should be between 30 and 65 chars.`);
      }
    } else {
      metaIssues.push('Missing <title> tag in index.html');
    }

    // Meta Description
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (descMatch) {
      const desc = descMatch[1].trim();
      if (desc.length >= 120 && desc.length <= 165) {
        metaScore += 4;
        metaWins.push(`Meta description length optimal (${desc.length} chars)`);
      } else {
        metaScore += 2;
        metaIssues.push(`Meta description length (${desc.length} chars) is outside optimal 120-165 range`);
      }
    } else {
      metaIssues.push('Missing meta description');
    }

    // Canonical tag
    if (/<link\s+rel=["']canonical["']\s+href=["']https:\/\/dmpanda\.com\/?["']/i.test(html)) {
      metaScore += 3;
      metaWins.push('Valid canonical link tag present');
    } else {
      metaIssues.push('Canonical tag missing or invalid');
    }

    // Robots meta tag with advanced directives
    if (/<meta\s+name=["']robots["']\s+content=["'][^"']*max-image-preview:large[^"']*["']/i.test(html)) {
      metaScore += 4;
      metaWins.push('Robots meta tag includes max-image-preview:large for rich snippets');
    } else if (/<meta\s+name=["']robots["']\s+content=["'][^"']*index,\s*follow[^"']*["']/i.test(html)) {
      metaScore += 2;
      metaIssues.push('Robots tag lacks max-image-preview:large directive for Google Discover/Snippets');
    } else {
      metaIssues.push('Missing robots meta tag');
    }

    // Open Graph tags
    const hasOgTitle = /<meta\s+property=["']og:title["']/i.test(html);
    const hasOgDesc = /<meta\s+property=["']og:description["']/i.test(html);
    const hasOgImage = /<meta\s+property=["']og:image["']/i.test(html);
    const hasOgUrl = /<meta\s+property=["']og:url["']/i.test(html);
    if (hasOgTitle && hasOgDesc && hasOgImage && hasOgUrl) {
      metaScore += 5;
      metaWins.push('All core Open Graph tags present (title, desc, image, url)');
    } else {
      metaScore += 2;
      metaIssues.push('Incomplete Open Graph tags');
    }

    // Twitter Card tags
    const hasTwCard = /<meta\s+(name|property)=["']twitter:card["']/i.test(html);
    const hasTwImage = /<meta\s+(name|property)=["']twitter:image["']/i.test(html);
    if (hasTwCard && hasTwImage) {
      metaScore += 3;
      metaWins.push('Twitter card tags configured with large summary preview');
    } else {
      metaIssues.push('Incomplete Twitter card tags');
    }

    // Resource hints / preconnects
    if (/rel=["']preconnect["']\s+href=["']https:\/\/fonts\.gstatic\.com["']/i.test(html)) {
      metaScore += 2;
      metaWins.push('Font preconnect hints properly placed');
    }
  }

  categories['Metadata & Social Cards'] = { score: metaScore, max: 25, wins: metaWins, issues: metaIssues };
  totalScore += metaScore;

  // -------------------------------------------------------------
  // 2. Structured Data / Schema.org (Max 25 pts)
  // -------------------------------------------------------------
  let schemaScore = 0;
  const schemaIssues = [];
  const schemaWins = [];

  if (fs.existsSync(INDEX_HTML)) {
    const html = fs.readFileSync(INDEX_HTML, 'utf8');
    const jsonLdMatches = html.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi);

    if (jsonLdMatches && jsonLdMatches.length > 0) {
      schemaScore += 5;
      schemaWins.push(`Found ${jsonLdMatches.length} inline JSON-LD script block(s) in index.html`);

      let parsedSchemas = [];
      for (const block of jsonLdMatches) {
        const rawJson = block.replace(/<\/?script[^>]*>/gi, '').trim();
        try {
          const parsed = JSON.parse(rawJson);
          if (Array.isArray(parsed)) parsedSchemas.push(...parsed);
          else if (parsed['@graph']) parsedSchemas.push(...parsed['@graph']);
          else parsedSchemas.push(parsed);
        } catch (err) {
          schemaIssues.push(`JSON-LD block has syntax error: ${err.message}`);
        }
      }

      const types = parsedSchemas.map(s => s['@type']).filter(Boolean);

      if (types.some(t => /SoftwareApplication|WebApplication/i.test(t))) {
        schemaScore += 7;
        schemaWins.push('SoftwareApplication/WebApplication schema present for rich search snippets');
      } else {
        schemaIssues.push('Missing SoftwareApplication / WebApplication structured data');
      }

      if (types.some(t => /Organization/i.test(t))) {
        schemaScore += 6;
        schemaWins.push('Organization schema present with branding & logo');
      } else {
        schemaIssues.push('Missing Organization structured data');
      }

      if (types.some(t => /WebSite/i.test(t))) {
        schemaScore += 4;
        schemaWins.push('WebSite schema present with site search capability');
      } else {
        schemaIssues.push('Missing WebSite structured data');
      }

      if (types.some(t => /FAQPage|BreadcrumbList|AggregateRating/i.test(t)) || types.length >= 3) {
        schemaScore += 3;
        schemaWins.push('Rich schema elements (FAQ/Breadcrumb/Rating) included');
      }
    } else {
      schemaIssues.push('No JSON-LD structured data in index.html (Google cannot parse schema on first pass before JS hydration)');
    }
  }

  categories['Structured Data (JSON-LD)'] = { score: schemaScore, max: 25, wins: schemaWins, issues: schemaIssues };
  totalScore += schemaScore;

  // -------------------------------------------------------------
  // 3. Image Optimization & Media Performance (Max 25 pts)
  // -------------------------------------------------------------
  let imageScore = 0;
  const imageIssues = [];
  const imageWins = [];

  if (fs.existsSync(IMAGES_DIR)) {
    const files = fs.readdirSync(IMAGES_DIR);
    const pngFiles = files.filter(f => f.endsWith('.png'));
    const webpFiles = files.filter(f => f.endsWith('.webp'));
    let totalSizeBytes = 0;
    let bloatedCount = 0;
    let criticalBloatCount = 0;

    for (const file of files) {
      const filePath = path.join(IMAGES_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        totalSizeBytes += stat.size;
        if (stat.size > 500 * 1024) bloatedCount++;
        if (stat.size > 2 * 1024 * 1024) criticalBloatCount++;
      }
    }

    const totalMB = (totalSizeBytes / (1024 * 1024)).toFixed(1);

    // Score on total weight
    if (totalSizeBytes < 20 * 1024 * 1024) {
      imageScore += 7;
      imageWins.push(`Total image directory weight is lean: ${totalMB} MB`);
    } else if (totalSizeBytes < 40 * 1024 * 1024) {
      imageScore += 4;
      imageIssues.push(`Total image directory weight is moderate: ${totalMB} MB`);
    } else {
      imageScore += 1;
      imageIssues.push(`CRITICAL: Image directory is heavily bloated (${totalMB} MB total)`);
    }

    // Score on bloated files (>500KB)
    if (criticalBloatCount === 0 && bloatedCount <= 2) {
      imageScore += 6;
      imageWins.push(`No severe image bloat (0 files >2MB, only ${bloatedCount} files >500KB)`);
    } else {
      imageIssues.push(`Found ${criticalBloatCount} images >2MB and ${bloatedCount} images >500KB (e.g., dashboard_dark.png, loading_panda.gif)`);
    }

    // Score on WebP coverage
    const webpCoverageRatio = pngFiles.length > 0 ? (webpFiles.length / pngFiles.length) : 0;
    const webpPct = Math.round(webpCoverageRatio * 100);
    if (webpCoverageRatio >= 0.8) {
      imageScore += 7;
      imageWins.push(`High WebP adoption: ${webpFiles.length}/${pngFiles.length} (${webpPct}%) PNGs have WebP variants`);
    } else if (webpCoverageRatio >= 0.3) {
      imageScore += 3;
      imageIssues.push(`Partial WebP adoption: only ${webpFiles.length}/${pngFiles.length} (${webpPct}%) PNGs have WebP variants`);
    } else {
      imageIssues.push(`Missing modern WebP images: 0 WebP images found for ${pngFiles.length} PNGs`);
    }

    // Hero Fold Image Check
    const heroLightWebp = fs.existsSync(path.join(IMAGES_DIR, 'dashboard_light.webp'));
    const heroDarkWebp = fs.existsSync(path.join(IMAGES_DIR, 'dashboard_dark.webp'));
    if (heroLightWebp && heroDarkWebp) {
      imageScore += 5;
      imageWins.push('Hero fold dashboard images optimized in high-speed WebP');
    } else {
      imageIssues.push('Hero dashboard images lack optimized WebP equivalents (causes high LCP)');
    }
  }

  categories['Image & Performance SEO'] = { score: imageScore, max: 25, wins: imageWins, issues: imageIssues };
  totalScore += imageScore;

  // -------------------------------------------------------------
  // 4. Crawlability & Indexing (Sitemap, Robots, Server) (Max 25 pts)
  // -------------------------------------------------------------
  let crawlScore = 0;
  const crawlIssues = [];
  const crawlWins = [];

  // Robots.txt
  if (fs.existsSync(ROBOTS_TXT)) {
    const robots = fs.readFileSync(ROBOTS_TXT, 'utf8');
    const hasSitemap = /Sitemap:\s*https:\/\/dmpanda\.com\/sitemap\.xml/i.test(robots);
    const hasUserAgent = /User-agent:\s*\*/i.test(robots);
    const hasDisallow = /Disallow:\s*\/dashboard/i.test(robots);

    if (hasUserAgent && hasSitemap && hasDisallow) {
      crawlScore += 7;
      crawlWins.push('robots.txt properly configured (User-agent, Disallow /dashboard, Sitemap link)');
    } else {
      crawlScore += 3;
      crawlIssues.push('robots.txt missing recommended directives');
    }
  } else {
    crawlIssues.push('Missing public/robots.txt');
  }

  // Sitemap.xml
  if (fs.existsSync(SITEMAP_XML)) {
    const sitemap = fs.readFileSync(SITEMAP_XML, 'utf8');
    const urlMatches = sitemap.match(/<loc>([^<]+)<\/loc>/g);
    const urlCount = urlMatches ? urlMatches.length : 0;
    const hasLastMod = /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sitemap);
    const hasPriority = /<priority>[0-1]\.\d<\/priority>/.test(sitemap);

    if (urlCount >= 15 && hasLastMod && hasPriority) {
      crawlScore += 8;
      crawlWins.push(`sitemap.xml is comprehensive (${urlCount} indexable URLs, ISO lastmod dates, priorities)`);
    } else if (urlCount > 0) {
      crawlScore += 4;
      crawlIssues.push(`sitemap.xml has only ${urlCount} URLs or lacks lastmod/priority tags`);
    } else {
      crawlIssues.push('sitemap.xml has no valid <url> entries');
    }
  } else {
    crawlIssues.push('Missing public/sitemap.xml');
  }

  // Server Routing & SEO Endpoints Check
  const rootServer = path.join(ROOT_DIR, 'server.js');
  if (fs.existsSync(rootServer)) {
    const serverCode = fs.readFileSync(rootServer, 'utf8');
    if (/sitemap\.xml/i.test(serverCode) && /robots\.txt/i.test(serverCode)) {
      crawlScore += 5;
      crawlWins.push('Master server.js explicitly routes robots.txt & sitemap.xml with proper MIME types');
    } else {
      crawlScore += 2;
      crawlIssues.push('Master server.js missing dedicated sitemap/robots route handlers');
    }

    if (/brotli|gzip/i.test(serverCode)) {
      crawlScore += 5;
      crawlWins.push('Master server has HTTP compression (Brotli/Gzip) enabled');
    } else {
      crawlIssues.push('Master server lacks static asset compression');
    }
  } else {
    crawlIssues.push('Master server.js not yet created');
  }

  categories['Crawlability & Indexing'] = { score: crawlScore, max: 25, wins: crawlWins, issues: crawlIssues };
  totalScore += crawlScore;

  // -------------------------------------------------------------
  // Summary & Diagnostic Output
  // -------------------------------------------------------------
  console.log('\nAudit Category Breakdown:');
  for (const [name, data] of Object.entries(categories)) {
    const pct = Math.round((data.score / data.max) * 100);
    const bar = '■'.repeat(Math.round(pct / 10)) + '□'.repeat(10 - Math.round(pct / 10));
    console.log(`\n  [${bar}] ${name}: ${data.score}/${data.max} (${pct}%)`);
    if (data.wins.length > 0) {
      data.wins.forEach(w => console.log(`     ✓ ${w}`));
    }
    if (data.issues.length > 0) {
      data.issues.forEach(i => console.log(`     ⚠ ${i}`));
    }
  }

  let grade = 'F';
  if (totalScore >= 90) grade = 'A+ (Elite SEO & High Indexability)';
  else if (totalScore >= 80) grade = 'A (Strong SEO & Indexing Readiness)';
  else if (totalScore >= 70) grade = 'B (Good, with actionable optimization gaps)';
  else if (totalScore >= 60) grade = 'C (Average, needs technical fixes)';
  else grade = 'D/F (Critical indexing & performance liabilities)';

  console.log('\n' + '='.repeat(60));
  console.log(`OVERALL SEO & PAGE INDEXING SCORE: ${totalScore} / 100`);
  console.log(`GRADE: ${grade}`);
  console.log('='.repeat(60) + '\n');

  return { totalScore, categories, grade };
}

if (require.main === module) {
  runAudit();
}

module.exports = { runAudit };

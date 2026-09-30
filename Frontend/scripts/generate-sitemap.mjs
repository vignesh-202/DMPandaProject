import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE_ORIGIN = 'https://dmpanda.com';

// Canonical public indexable static routes
// Private routes (dashboard, login, auth, admin) are intentionally excluded
const STATIC_ROUTES = [
  '/',
  '/features',
  '/pricing',
  '/about',
  '/contact',
  '/blog',
  '/privacy',
  '/terms',
  '/disclaimer',
  '/refund-policy',
  '/delete-account-guide'
];

function parseBlogData() {
  const dataPath = path.resolve(__dirname, '../src/app/blog/data.ts');
  const content = fs.readFileSync(dataPath, 'utf8');

  // Parse blog posts and extract actual publication / update dates from data.ts
  const postRegex = /slug:\s*'([^']+)'[\s\S]*?publishedAt:\s*'([^']+)'(?:[\s\S]*?updatedAt:\s*'([^']+)')?/g;
  const posts = [];
  let match;

  while ((match = postRegex.exec(content)) !== null) {
    posts.push({
      slug: match[1],
      lastmod: match[3] || match[2] // Real modification / publication date
    });
  }

  return posts;
}

function generateSitemap() {
  const blogPosts = parseBlogData();
  console.log(`Parsed ${blogPosts.length} blog posts from data.ts`);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Static routes (no fabricated lastmod, no arbitrary priority or changefreq)
  for (const route of STATIC_ROUTES) {
    const loc = route === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${route}`;
    xml += `  <url>\n`;
    xml += `    <loc>${loc}</loc>\n`;
    xml += `  </url>\n`;
  }

  // Blog posts (using actual source-of-truth dates)
  for (const post of blogPosts) {
    xml += `  <url>\n`;
    xml += `    <loc>${SITE_ORIGIN}/blog/${post.slug}</loc>\n`;
    if (post.lastmod) {
      xml += `    <lastmod>${post.lastmod}</lastmod>\n`;
    }
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;

  const outputPath = path.resolve(__dirname, '../public/sitemap.xml');
  fs.writeFileSync(outputPath, xml, 'utf8');
  console.log(`Generated canonical sitemap at: ${outputPath}`);
}

generateSitemap();

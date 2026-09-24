import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE_ORIGIN = 'https://dmpanda.com';
const TODAY = '2026-09-24';

const STATIC_ROUTES = [
  {
    url: '/',
    priority: '1.0',
    changefreq: 'daily',
    lastmod: TODAY,
    image: {
      loc: `${SITE_ORIGIN}/images/logo.png`,
      title: 'DM Panda - Official Meta Certified Instagram DM Automation',
      caption: 'Automate Instagram DMs, post comments, reels, and stories with DM Panda.'
    }
  },
  {
    url: '/features',
    priority: '0.9',
    changefreq: 'weekly',
    lastmod: TODAY,
    image: {
      loc: `${SITE_ORIGIN}/images/features/instagram_comment_auto_reply.png`,
      title: 'DM Panda Features - Instagram Automation Suite',
      caption: 'Full suite of 23 certified Instagram automation features for creators and businesses.'
    }
  },
  {
    url: '/pricing',
    priority: '0.9',
    changefreq: 'weekly',
    lastmod: TODAY,
    image: {
      loc: `${SITE_ORIGIN}/images/logo.png`,
      title: 'DM Panda Pricing Plans',
      caption: 'Transparent and affordable Instagram automation plans for individuals and agencies.'
    }
  },
  {
    url: '/blog',
    priority: '0.9',
    changefreq: 'daily',
    lastmod: TODAY,
    image: {
      loc: `${SITE_ORIGIN}/images/blog_auto_reply_comments.png`,
      title: 'DM Panda Growth & Automation Blog',
      caption: 'Latest strategies, guides, and tutorials for Instagram DM automation and lead generation.'
    }
  },
  {
    url: '/about',
    priority: '0.7',
    changefreq: 'monthly',
    lastmod: TODAY
  },
  {
    url: '/contact',
    priority: '0.7',
    changefreq: 'monthly',
    lastmod: TODAY
  },
  {
    url: '/privacy',
    priority: '0.5',
    changefreq: 'monthly',
    lastmod: TODAY
  },
  {
    url: '/terms',
    priority: '0.5',
    changefreq: 'monthly',
    lastmod: TODAY
  },
  {
    url: '/disclaimer',
    priority: '0.5',
    changefreq: 'monthly',
    lastmod: TODAY
  },
  {
    url: '/refund-policy',
    priority: '0.5',
    changefreq: 'monthly',
    lastmod: TODAY
  },
  {
    url: '/delete-account-guide',
    priority: '0.5',
    changefreq: 'monthly',
    lastmod: TODAY
  }
];

function escapeXml(unsafe) {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseBlogData() {
  const dataPath = path.resolve(__dirname, '../src/app/blog/data.ts');
  const content = fs.readFileSync(dataPath, 'utf8');

  const postRegex = /slug:\s*'([^']+)'[\s\S]*?title:\s*'([^']+)'[\s\S]*?excerpt:\s*'([^']+)'[\s\S]*?image:\s*'([^']+)'/g;
  const posts = [];
  let match;

  while ((match = postRegex.exec(content)) !== null) {
    posts.push({
      slug: match[1],
      title: match[2].replace(/\\'/g, "'"),
      excerpt: match[3].replace(/\\'/g, "'"),
      image: match[4]
    });
  }

  return posts;
}

function generateSitemap() {
  const blogPosts = parseBlogData();
  console.log(`Parsed ${blogPosts.length} blog posts from data.ts`);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

  // Static routes
  for (const route of STATIC_ROUTES) {
    xml += `  <url>\n`;
    xml += `    <loc>${SITE_ORIGIN}${route.url}</loc>\n`;
    xml += `    <lastmod>${route.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
    xml += `    <priority>${route.priority}</priority>\n`;
    if (route.image) {
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${escapeXml(route.image.loc)}</image:loc>\n`;
      xml += `      <image:title>${escapeXml(route.image.title)}</image:title>\n`;
      xml += `      <image:caption>${escapeXml(route.image.caption)}</image:caption>\n`;
      xml += `    </image:image>\n`;
    }
    xml += `  </url>\n`;
  }

  // Blog posts
  for (const post of blogPosts) {
    const postUrl = `${SITE_ORIGIN}/blog/${post.slug}`;
    const imgUrl = post.image.startsWith('http') ? post.image : `${SITE_ORIGIN}${post.image}`;

    xml += `  <url>\n`;
    xml += `    <loc>${postUrl}</loc>\n`;
    xml += `    <lastmod>${TODAY}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += `    <image:image>\n`;
    xml += `      <image:loc>${escapeXml(imgUrl)}</image:loc>\n`;
    xml += `      <image:title>${escapeXml(post.title)}</image:title>\n`;
    xml += `      <image:caption>${escapeXml(post.excerpt)}</image:caption>\n`;
    xml += `    </image:image>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;

  const outputPath = path.resolve(__dirname, '../public/sitemap.xml');
  fs.writeFileSync(outputPath, xml, 'utf8');
  console.log(`Generated Google Search Console compliant sitemap at: ${outputPath}`);
}

generateSitemap();

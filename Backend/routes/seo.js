const express = require('express');
const router = express.Router();
const { getAppwriteClient, SUPER_PROFILES_COLLECTION_ID } = require('../utils/appwrite');
const { Databases, Query } = require('node-appwrite');

// Get clean frontend origin
const getFrontendOrigin = () => {
    return (process.env.FRONTEND_ORIGIN || 'https://dmpanda.com').trim().replace(/\/+$/, '');
};

// Robots.txt generator
router.get('/robots.txt', (req, res) => {
    const origin = getFrontendOrigin();
    const content = [
        'User-agent: *',
        'Allow: /',
        'Disallow: /dashboard/',
        'Disallow: /auth/',
        'Disallow: /api/',
        '',
        `Sitemap: ${origin}/sitemap.xml`
    ].join('\n');

    res.header('Content-Type', 'text/plain');
    res.status(200).send(content);
});

// Dynamic sitemap.xml generator
router.get('/sitemap.xml', async (req, res) => {
    try {
        const origin = getFrontendOrigin();
        
        // Static routes
        const staticPaths = [
            { path: '', changefreq: 'daily', priority: '1.0' },
            { path: '/features', changefreq: 'weekly', priority: '0.8' },
            { path: '/pricing', changefreq: 'weekly', priority: '0.8' },
            { path: '/about', changefreq: 'weekly', priority: '0.7' },
            { path: '/contact', changefreq: 'weekly', priority: '0.7' },
            { path: '/privacy', changefreq: 'monthly', priority: '0.5' },
            { path: '/terms', changefreq: 'monthly', priority: '0.5' },
            { path: '/disclaimer', changefreq: 'monthly', priority: '0.5' },
            { path: '/refund-policy', changefreq: 'monthly', priority: '0.5' },
            { path: '/delete-account-guide', changefreq: 'monthly', priority: '0.5' },
            { path: '/login', changefreq: 'monthly', priority: '0.5' }
        ];

        // Fetch dynamic Super Profiles
        let dynamicPaths = [];
        try {
            const serverClient = getAppwriteClient({ useApiKey: true });
            const databases = new Databases(serverClient);
            
            // Fetch active super profiles (limit to 1000 for safety, we can paginate if needed)
            const result = await databases.listDocuments(
                process.env.APPWRITE_DATABASE_ID,
                SUPER_PROFILES_COLLECTION_ID,
                [
                    Query.equal('is_active', true),
                    Query.limit(1000)
                ]
            );

            if (result && result.documents) {
                dynamicPaths = result.documents.map(doc => ({
                    path: `/superprofile/${doc.slug}`,
                    changefreq: 'weekly',
                    priority: '0.6',
                    lastmod: doc.$updatedAt || doc.$createdAt
                }));
            }
        } catch (dbErr) {
            console.error('Sitemap Generator DB Error:', dbErr.message);
            // Non-blocking: continue with static paths if DB fails
        }

        const allPaths = [...staticPaths, ...dynamicPaths];

        // Construct XML
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        
        allPaths.forEach(item => {
            xml += '  <url>\n';
            xml += `    <loc>${origin}${item.path}</loc>\n`;
            if (item.lastmod) {
                // Ensure date format is YYYY-MM-DD
                const dateStr = new Date(item.lastmod).toISOString().split('T')[0];
                xml += `    <lastmod>${dateStr}</lastmod>\n`;
            }
            xml += `    <changefreq>${item.changefreq}</changefreq>\n`;
            xml += `    <priority>${item.priority}</priority>\n`;
            xml += '  </url>\n';
        });

        xml += '</urlset>\n';

        res.header('Content-Type', 'application/xml');
        res.status(200).send(xml);
    } catch (err) {
        console.error('Sitemap Generation Error:', err.stack);
        res.status(500).send('Error generating sitemap');
    }
});

module.exports = router;

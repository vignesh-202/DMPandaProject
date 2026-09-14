// DM Panda — Unified Production Server for Hostinger Cloud Startup
// Serves Frontend, Admin Panel, and mounts Backend API seamlessly on a single port (process.env.PORT || 3000)
// Supports both Subdomain-based routing (app.*, admin.*, api.*) and Path-based routing (/admin, /api, /)

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

const app = express();
const PORT = process.env.PORT || 3000;

const FRONTEND_DIST = path.join(__dirname, 'Frontend/dist');
const FRONTEND_PUBLIC = path.join(__dirname, 'Frontend/public');
const ADMIN_DIST = path.join(__dirname, 'admin-panel/dist');

// Enable trust proxy for Hostinger / LiteSpeed / Cloudflare reverse proxies
app.set('trust proxy', 1);

/* ─── Security Headers ────────────────────────────────────────── */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

/* ─── SEO First: robots.txt and sitemap.xml ───────────────────── */
app.get('/robots.txt', (req, res) => {
  const robotsPath = path.join(FRONTEND_PUBLIC, 'robots.txt');
  if (fs.existsSync(robotsPath)) {
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(robotsPath);
  }
  res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
  res.send('User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /auth/\nDisallow: /api/\nSitemap: https://dmpanda.com/sitemap.xml\n');
});

app.get('/sitemap.xml', (req, res) => {
  const sitemapPath = path.join(FRONTEND_PUBLIC, 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    res.setHeader('Content-Type', 'application/xml; charset=UTF-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(sitemapPath);
  }
  res.status(404).send('Sitemap not found');
});

/* ─── High Performance On-The-Fly Compression Middleware ───────── */
const COMPRESSIBLE = /\.(js|css|html|json|xml|svg|txt|ico|map|woff2?)$/i;
const MIN_SIZE = 1024;

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  // Skip API endpoints from static file compression handler
  if (req.path.startsWith('/api') || req.path.startsWith('/auth')) return next();

  const isHashed = /\-[a-zA-Z0-9]{8,}\.(js|css)$/.test(req.path);
  const cacheControl = isHashed
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=3600, stale-while-revalidate=86400';

  let filePath = path.join(FRONTEND_DIST, req.path);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(FRONTEND_PUBLIC, req.path);
  }

  const ext = path.extname(req.path);
  if (!COMPRESSIBLE.test(ext) || !fs.existsSync(filePath)) return next();

  let stat;
  try { stat = fs.statSync(filePath); } catch { return next(); }
  if (!stat.isFile() || stat.size < MIN_SIZE) return next();

  const accept = req.headers['accept-encoding'] || '';
  let encoding = null;
  let compressor = null;

  if (accept.includes('br')) {
    encoding = 'br';
    compressor = zlib.createBrotliCompress({
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 }
    });
  } else if (accept.includes('gzip')) {
    encoding = 'gzip';
    compressor = zlib.createGzip({ level: 6 });
  }

  if (!encoding) return next();

  const MIME = {
    '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html',
    '.json': 'application/json', '.xml': 'application/xml', '.svg': 'image/svg+xml',
    '.txt': 'text/plain', '.ico': 'image/x-icon', '.map': 'application/json',
    '.woff': 'font/woff', '.woff2': 'font/woff2',
  };

  res.setHeader('Content-Encoding', encoding);
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Vary', 'Accept-Encoding');
  res.removeHeader('Content-Length');

  const readStream = fs.createReadStream(filePath);
  pipeline(readStream, compressor, res).catch(() => {});
});

/* ─── Mount Backend API ─────────────────────────────────────────── */
// When running in unified mode, mount the Backend router/app
try {
  const backendApp = require('./Backend/app.js');
  // If Backend/app.js exported the express instance or app
  if (backendApp && typeof backendApp.use === 'function') {
    app.use(backendApp);
    console.log('[Unified Gateway] Backend API and Auth routes mounted successfully');
  }
} catch (backendErr) {
  // If Backend runs as a separate process (e.g. on port 5000), route /api via proxy if available
  console.log('[Unified Gateway] Backend running standalone on PORT 5000');
}

/* ─── Subdomain / Path Routing: Admin Panel ─────────────────────── */
const isAdminRequest = (req) => {
  const host = (req.headers.host || '').toLowerCase();
  return host.startsWith('admin.') || req.path.startsWith('/admin');
};

// Serve Admin Panel Static Assets
if (fs.existsSync(ADMIN_DIST)) {
  app.use('/admin', express.static(ADMIN_DIST, {
    maxAge: '1y',
    etag: true,
    immutable: true
  }));
}

/* ─── Serve Frontend Static Assets (dist & public fallback) ─────── */
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST, {
    maxAge: '1y',
    etag: true,
    immutable: true,
    setHeaders(res, filePath) {
      const ext = path.extname(filePath).toLowerCase();
      if (/\.(png|jpg|jpeg|gif|webp|avif|svg|woff2?|ttf|eot|mp4|webm)$/i.test(ext)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));
}

if (fs.existsSync(FRONTEND_PUBLIC)) {
  app.use(express.static(FRONTEND_PUBLIC, {
    maxAge: '7d',
    etag: true
  }));
}

/* ─── SPA Fallback Routing ──────────────────────────────────────── */
app.get('*', (req, res) => {
  // If request is for admin panel
  if (isAdminRequest(req)) {
    const adminIndex = path.join(ADMIN_DIST, 'index.html');
    if (fs.existsSync(adminIndex)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      return res.sendFile(adminIndex);
    }
  }

  // Frontend SPA fallback
  const frontendIndex = path.join(FRONTEND_DIST, 'index.html');
  if (fs.existsSync(frontendIndex)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.sendFile(frontendIndex);
  }

  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head><title>DM Panda</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:50px;">
        <h2>DM Panda Service Ready</h2>
        <p>Run <code>npm run build-all</code> to compile the frontend and admin panel bundles.</p>
      </body>
    </html>
  `);
});

const server = http.createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`============================================================`);
  console.log(`  DM Panda Unified Hostinger Cloud Server`);
  console.log(`  Listening on port ${PORT}`);
  console.log(`  Frontend: http://localhost:${PORT}/`);
  console.log(`  Admin:    http://localhost:${PORT}/admin`);
  console.log(`  SEO:      http://localhost:${PORT}/sitemap.xml`);
  console.log(`============================================================`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please check Hostinger PORT config or kill conflicting processes.`);
  } else {
    console.error('Server startup error:', err);
  }
  process.exit(1);
});

module.exports = app;

// DM Panda — Unified Production Server for Hostinger Cloud Startup
// Serves Frontend, Admin Panel, and mounts Backend API seamlessly on a single port (process.env.PORT || 3000)
// Supports both Subdomain-based routing (app.*, admin.*, api.*) and Path-based routing (/admin, /api, /)

try { require('dotenv').config(); } catch (_) {}
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

// Support running any individual service directly via APP_MODE env var:
// APP_MODE = 'backend' | 'streamer' | 'worker' | 'admin' | 'frontend' | 'all'
const APP_MODE = String(process.env.APP_MODE || 'all').toLowerCase().trim();

if (APP_MODE === 'backend') {
  console.log('[Hostinger] Starting Standalone Backend API...');
  return require('./Backend/app.js');
}
if (APP_MODE === 'streamer') {
  console.log('[Hostinger] Starting Standalone Streamer Node...');
  return require('./streamer-node/index.js');
}
if (APP_MODE === 'worker') {
  console.log('[Hostinger] Starting Standalone Worker Node...');
  return require('./worker-node/index.js');
}
if (APP_MODE === 'admin') {
  console.log('[Hostinger] Starting Standalone Admin Panel...');
  return require('./serve-admin.js');
}
if (APP_MODE === 'frontend') {
  console.log('[Hostinger] Starting Standalone Frontend...');
  return require('./serve-frontend.js');
}

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

/* ─── Subdomain / Path Routing: Admin Panel & API ─────────────────────── */
const isApiSubdomain = (req) => {
  const host = (req.headers.host || '').toLowerCase();
  return host.startsWith('api.');
};

const isAdminRequest = (req) => {
  const host = (req.headers.host || '').toLowerCase();
  return host.startsWith('admin.') || req.path.startsWith('/admin');
};

// Serve Admin Panel Static Assets (Supports both admin.dmpanda.com and dmpanda.com/admin)
if (fs.existsSync(ADMIN_DIST)) {
  app.use((req, res, next) => {
    const host = (req.headers.host || '').toLowerCase();
    if (host.startsWith('admin.')) {
      return express.static(ADMIN_DIST, {
        maxAge: '1y',
        etag: true,
        immutable: true
      })(req, res, next);
    }
    next();
  });

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

/* ─── Streamer Node Webhook Mounting ───────────────────────────────── */
const streamerRouter = express.Router();
let streamerHub = null;
let streamerDispatcher = null;

try {
  const { registerWebhookRoutes } = require('./streamer-node/src/webhook-server');
  const { splitWebhookPayload } = require('./streamer-node/src/meta-parser');
  const JobStore = require('./streamer-node/src/job-store');
  const Dispatcher = require('./streamer-node/src/dispatcher');

  const streamerStore = new JobStore({
    maxAttempts: Math.max(1, Number(process.env.STREAMER_MAX_JOB_ATTEMPTS || 5) || 5)
  });

  registerWebhookRoutes(streamerRouter, {
    verifyToken: process.env.META_VERIFY_TOKEN || '',
    onWebhook: async (payload) => {
      const allJobs = splitWebhookPayload(payload);
      const accepted = streamerStore.enqueueMany(allJobs);
      if (accepted.length > 0 && streamerDispatcher) streamerDispatcher.trigger();
      return { accepted: accepted.length, forwarded: 0 };
    },
    getStats: () => ({
      role: 'unified-streamer',
      ...streamerStore.getStats(),
      ...(streamerHub ? streamerHub.getStats() : {})
    })
  });

  // Handle requests for webhook.dmpanda.com or /webhook path
  app.use((req, res, next) => {
    const host = (req.headers.host || '').toLowerCase();
    if (host.startsWith('webhook.') || req.path.startsWith('/webhook')) {
      return streamerRouter(req, res, next);
    }
    next();
  });

  console.log('[Unified Gateway] Streamer Webhook mounted on /webhook');
} catch (streamerErr) {
  console.warn('[Unified Gateway] Streamer Webhook mount skipped:', streamerErr.message);
}

/* ─── SPA Fallback Routing ──────────────────────────────────────── */
app.get('*', (req, res) => {
  // If request is for api subdomain and not handled by an API route
  if (isApiSubdomain(req)) {
    return res.status(404).json({ error: 'Endpoint not found', service: 'DM Panda API' });
  }

  // If request is for admin panel (admin.dmpanda.com or /admin)
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

/* ─── WorkerHub WebSocket Mounting on HTTP Server ────────────────── */
try {
  const WorkerHub = require('./streamer-node/src/worker-hub');
  const Dispatcher = require('./streamer-node/src/dispatcher');
  const JobStore = require('./streamer-node/src/job-store');

  const streamerStore = new JobStore({
    maxAttempts: Math.max(1, Number(process.env.STREAMER_MAX_JOB_ATTEMPTS || 5) || 5)
  });

  streamerHub = new WorkerHub({
    server,
    path: '/workers',
    sharedSecret: process.env.WORKER_SHARED_SECRET || '',
    callbacks: {
      onRegistered: () => streamerDispatcher?.trigger(),
      onAccepted: ({ jobId }) => streamerStore.markAccepted(jobId),
      onHeartbeat: ({ jobId }) => streamerStore.markHeartbeat(jobId),
      onCompleted: ({ jobId }) => {
        const job = streamerStore.getJob(jobId);
        if (job?.assignedWorkerId) streamerHub.releaseJob(job.assignedWorkerId, jobId);
        streamerStore.markCompleted(jobId);
        streamerDispatcher?.trigger();
      },
      onFailed: ({ workerId, jobId, error }) => {
        if (workerId) streamerHub.releaseJob(workerId, jobId);
        streamerStore.requeue(jobId, error || 'job_failed');
        streamerDispatcher?.trigger();
      },
      onDisconnected: ({ workerId }) => {
        const results = streamerStore.releaseWorkerJobs(workerId, 'worker_disconnected');
        for (const res of results) {
          if (res.workerId) streamerHub.releaseJob(res.workerId, res.job?.jobId);
        }
        streamerDispatcher?.trigger();
      }
    }
  });

  streamerDispatcher = new Dispatcher({ store: streamerStore, hub: streamerHub });
  console.log('[Unified Gateway] WorkerHub WebSocket server active at /workers');
} catch (hubErr) {
  console.warn('[Unified Gateway] WorkerHub mount skipped:', hubErr.message);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`============================================================`);
  console.log(`  DM Panda Unified Hostinger Cloud Server`);
  console.log(`  Listening on port ${PORT}`);
  console.log(`  Frontend: http://localhost:${PORT}/ (dmpanda.com)`);
  console.log(`  Admin:    http://localhost:${PORT}/admin (admin.dmpanda.com)`);
  console.log(`  API:      http://localhost:${PORT}/api (api.dmpanda.com)`);
  console.log(`  Webhook:  http://localhost:${PORT}/webhook (webhook.dmpanda.com)`);
  console.log(`============================================================`);

  // Start internal background worker only if explicitly enabled
  if (process.env.START_WORKER === 'true') {
    try {
      const DMWorker = require('./worker-node/src/worker');
      const StreamerClient = require('./worker-node/src/streamer-client');
      const workerInstance = new DMWorker();
      const addr = server.address();
      const listenPort = typeof addr === 'object' && addr ? addr.port : PORT;
      process.env.STREAMER_WS_URL = process.env.STREAMER_WS_URL || `ws://127.0.0.1:${listenPort}/workers`;
      const streamerClient = new StreamerClient({ worker: workerInstance });
      streamerClient.start();
      console.log(`[Unified Gateway] Background Worker connected to ${process.env.STREAMER_WS_URL}`);
    } catch (workerErr) {
      console.warn('[Unified Gateway] Background Worker start skipped:', workerErr.message);
    }
  }
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

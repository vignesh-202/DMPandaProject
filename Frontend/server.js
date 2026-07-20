// DM Panda - Frontend Production Server
// Serves the built Vite/React dashboard from ./dist
// Set PORT env var in Hostinger panel (Hostinger default: 3000)

import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { createReadStream, statSync, existsSync } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createBrotliCompress, constants as zlibConstants } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = join(__dirname, 'dist');

/* ─── Security headers ──────────────────────────────────────── */
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

/* ─── On-the-fly compression middleware ──────────────────────── */
const COMPRESSIBLE = /\.(js|css|html|json|xml|svg|txt|ico|map|woff2?)$/i;
const MIN_SIZE = 1024; // only compress >1 KB

app.use((req, res, next) => {
  // Skip if not a GET/HEAD for a static file or if the file isn't compressible
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const filePath = join(DIST_DIR, req.path);
  const ext = extname(req.path);

  if (!COMPRESSIBLE.test(ext) || !existsSync(filePath)) return next();

  let stat;
  try { stat = statSync(filePath); } catch { return next(); }
  if (!stat.isFile() || stat.size < MIN_SIZE) return next();

  const accept = req.headers['accept-encoding'] || '';
  let encoding = null;
  let compressor = null;

  if (accept.includes('br')) {
    encoding = 'br';
    compressor = createBrotliCompress({
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 }  // fast setting
    });
  } else if (accept.includes('gzip')) {
    encoding = 'gzip';
    compressor = createGzip({ level: 6 });
  }

  if (!encoding) return next();

  // Determine content type
  const MIME = {
    '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html',
    '.json': 'application/json', '.xml': 'application/xml', '.svg': 'image/svg+xml',
    '.txt': 'text/plain', '.ico': 'image/x-icon', '.map': 'application/json',
    '.woff': 'font/woff', '.woff2': 'font/woff2',
  };

  // Set caching headers based on whether asset is hashed
  const isHashed = /\-[a-zA-Z0-9]{8,}\.(js|css)$/.test(req.path);
  const cacheControl = isHashed
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=3600, stale-while-revalidate=86400';

  res.setHeader('Content-Encoding', encoding);
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Vary', 'Accept-Encoding');
  res.removeHeader('Content-Length'); // compressed length differs

  const readStream = createReadStream(filePath);
  pipeline(readStream, compressor, res).catch(() => {
    // Client disconnect — safe to ignore
  });
});

/* ─── Static file serving for non-compressible assets (images, etc.) ─ */
app.use(express.static(DIST_DIR, {
  maxAge: '1y',
  etag: true,
  immutable: true,
  setHeaders(res, filePath) {
    const ext = extname(filePath).toLowerCase();
    // Images, fonts, media: immutable long cache
    if (/\.(png|jpg|jpeg|gif|webp|avif|svg|woff2?|ttf|eot|mp4|webm)$/i.test(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

/* ─── SPA fallback — React Router handles client-side routing ─ */
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(join(DIST_DIR, 'index.html'));
});

const server = createServer(app);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[DM Panda Frontend] Production server running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

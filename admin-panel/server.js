// DM Panda - Admin Panel Production Server
// Serves the built Vite/React admin panel from ./dist
// Set PORT env var in Hostinger panel (Hostinger default: 3000)

import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets from dist/ with long-lived caching
app.use(express.static(join(__dirname, 'dist'), {
  maxAge: '1y',
  etag: true,
}));

// SPA fallback — React Router handles all client-side routes
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const server = createServer(app);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[DM Panda Admin Panel] Production server running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

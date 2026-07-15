// DM Panda - Frontend Production Server
// Serves the built Vite/React dashboard from ./dist
// Set PORT env var in Hostinger panel (Hostinger default: 3000)

import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Serve all static files from dist/ with long-lived caching for hashed assets
app.use(express.static(join(__dirname, 'dist'), {
  maxAge: '1y',
  etag: true,
}));

// SPA fallback — all routes return index.html (React Router handles routing)
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(join(__dirname, 'dist', 'index.html'));
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

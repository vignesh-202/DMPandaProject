const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || process.env.ADMIN_PORT || 3000;

app.use(express.static(path.join(__dirname, 'admin-panel/dist'), {
    maxAge: '1y',
    etag: true,
    immutable: true
}));

app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.sendFile(path.join(__dirname, 'admin-panel/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Admin-panel production server running on port ${PORT}`);
});

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || process.env.FRONTEND_PORT || 3000;

app.use(express.static(path.join(__dirname, 'Frontend/dist'), {
    maxAge: '1y',
    etag: true,
    immutable: true
}));

if (require('fs').existsSync(path.join(__dirname, 'Frontend/public'))) {
    app.use(express.static(path.join(__dirname, 'Frontend/public'), {
        maxAge: '7d',
        etag: true
    }));
}

app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.sendFile(path.join(__dirname, 'Frontend/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Frontend production server running on port ${PORT}`);
});

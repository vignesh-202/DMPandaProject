const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.ADMIN_PORT || 5174;

app.use(express.static(path.join(__dirname, 'admin-panel/dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-panel/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Admin-panel production server running on port ${PORT}`);
});

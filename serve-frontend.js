const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.FRONTEND_PORT || 5173;

app.use(express.static(path.join(__dirname, 'Frontend/dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Frontend production server running on port ${PORT}`);
});

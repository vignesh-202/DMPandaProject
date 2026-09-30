/**
 * DM Panda Backend Entry Point
 * Starts HTTP listener on process.env.PORT for Hostinger and standalone Node environments
 */
const app = require('./app.js');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});

server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use.`);
        return;
    }
    console.error('Backend server failed to start:', error);
});

module.exports = server;

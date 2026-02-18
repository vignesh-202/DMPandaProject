const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const DMWorker = require('./src/worker');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());

const worker = new DMWorker();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'worker-node' });
});

// Internal endpoint to process webhooks (called by BackendNode)
app.post('/process-webhook', async (req, res) => {
    try {
        const success = await worker.processMessage(req.body);
        res.json({ success });
    } catch (error) {
        console.error('Error in /process-webhook:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Worker node listening at http://localhost:${port}`);
});

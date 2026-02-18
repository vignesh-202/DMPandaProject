const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const DMWorker = require('./src/worker');

const app = express();
const port = process.env.PORT || 3001;
const verifyToken = process.env.META_VERIFY_TOKEN || '';

app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());

const worker = new DMWorker();

function redactObject(value, seen = new WeakSet()) {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;
    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    if (Array.isArray(value)) {
        return value.map((item) => redactObject(item, seen));
    }

    const sensitiveKeys = new Set([
        'authorization',
        'cookie',
        'x-api-key',
        'access_token',
        'app_secret',
        'client_secret',
        'password',
        'token'
    ]);

    const out = {};
    for (const [k, v] of Object.entries(value)) {
        const keyLower = k.toLowerCase();
        if (sensitiveKeys.has(keyLower) || keyLower.includes('token') || keyLower.includes('secret')) {
            out[k] = '[REDACTED]';
        } else {
            out[k] = redactObject(v, seen);
        }
    }
    return out;
}

function logRequestDetails(req) {
    console.log('--- Incoming Request ---');
    console.log('Method:', req.method);
    console.log('URL:', req.originalUrl);
    console.log('Headers:', redactObject(req.headers));
    console.log('Query:', redactObject(req.query));
    console.log('Payload:', redactObject(req.body));
}

function sendLoggedJson(res, statusCode, payload) {
    console.log('--- Outgoing Response ---');
    console.log('Status:', statusCode);
    console.log('Payload:', redactObject(payload));
    return res.status(statusCode).json(payload);
}

function sendLoggedText(res, statusCode, text) {
    console.log('--- Outgoing Response ---');
    console.log('Status:', statusCode);
    console.log('Payload:', text);
    return res.status(statusCode).send(text);
}

// Health check endpoint
app.get('/health', (req, res) => {
    logRequestDetails(req);
    return sendLoggedJson(res, 200, { status: 'ok', service: 'worker-node' });
});

// Meta webhook verification endpoint
app.get('/webhook', (req, res) => {
    logRequestDetails(req);

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && challenge && token === verifyToken) {
        return sendLoggedText(res, 200, challenge);
    }

    return sendLoggedJson(res, 403, { error: 'Webhook verification failed' });
});

// Meta webhook events endpoint
app.post('/webhook', async (req, res) => {
    logRequestDetails(req);

    try {
        const success = await worker.processMessage(req.body);
        return sendLoggedJson(res, 200, { success });
    } catch (error) {
        console.error('Error in /webhook:', error);
        return sendLoggedJson(res, 500, { error: error.message });
    }
});

// Internal endpoint to process webhooks (called by BackendNode)
app.post('/process-webhook', async (req, res) => {
    logRequestDetails(req);

    try {
        const success = await worker.processMessage(req.body);
        return sendLoggedJson(res, 200, { success });
    } catch (error) {
        console.error('Error in /process-webhook:', error);
        return sendLoggedJson(res, 500, { error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Worker node listening at http://localhost:${port}`);
});

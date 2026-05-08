const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const DMWorker = require('./src/worker');
const StreamerClient = require('./src/streamer-client');

const app = express();
const port = process.env.PORT || 3001;
const verifyToken = process.env.META_VERIFY_TOKEN || '';
const workerWebhookSecret = String(process.env.WORKER_WEBHOOK_SHARED_SECRET || '').trim();
const logRequestBodies = String(process.env.WORKER_LOG_REQUESTS || '').trim().toLowerCase() === 'true';
const jsonBodyLimit = String(process.env.WORKER_JSON_BODY_LIMIT || '512kb').trim() || '512kb';

app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json({ limit: jsonBodyLimit }));

const worker = new DMWorker();
const streamerClient = new StreamerClient({ worker });
const directWebhookProcessingEnabled =
    String(process.env.WORKER_ACCEPT_DIRECT_WEBHOOKS || '').trim().toLowerCase() === 'true'
    || !streamerClient.isEnabled();

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
    if (!logRequestBodies) {
        console.log('--- Incoming Request ---');
        console.log('Method:', req.method);
        console.log('URL:', req.originalUrl);
        return;
    }
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
    if (logRequestBodies) {
        console.log('Payload:', redactObject(payload));
    }
    return res.status(statusCode).json(payload);
}

function sendLoggedText(res, statusCode, text) {
    console.log('--- Outgoing Response ---');
    console.log('Status:', statusCode);
    if (logRequestBodies) {
        console.log('Payload:', text);
    }
    return res.status(statusCode).send(text);
}

function isAuthorizedInternalWorkerRequest(req) {
    if (!workerWebhookSecret) return true;
    const headerSecret = String(req.headers['x-worker-secret'] || '').trim();
    if (headerSecret && headerSecret === workerWebhookSecret) return true;
    const authHeader = String(req.headers.authorization || '').trim();
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7).trim();
        if (token && token === workerWebhookSecret) return true;
    }
    return false;
}

// Health check endpoint
app.get('/health', (req, res) => {
    logRequestDetails(req);
    return sendLoggedJson(res, 200, {
        status: 'ok',
        service: 'worker-node',
        role: streamerClient.isEnabled() ? 'slave' : 'standalone',
        streamer_attached: streamerClient.isEnabled(),
        streamer_connected: streamerClient.isConnected(),
        direct_webhook_processing_enabled: directWebhookProcessingEnabled
    });
});

// Meta webhook verification endpoint
app.get('/webhook', (req, res) => {
    logRequestDetails(req);

    if (!directWebhookProcessingEnabled) {
        return sendLoggedJson(res, 409, {
            error: 'worker_slaves_do_not_accept_webhooks',
            message: 'Send Meta webhooks to the streamer master instead of a worker slave.'
        });
    }

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

    if (!directWebhookProcessingEnabled) {
        return sendLoggedJson(res, 409, {
            error: 'worker_slaves_do_not_accept_webhooks',
            message: 'Send Meta webhooks to the streamer master instead of a worker slave.'
        });
    }

    try {
        const success = await worker.processWebhook(req.body, { throwOnError: false });
        return sendLoggedJson(res, 200, { success });
    } catch (error) {
        console.error('Error in /webhook:', error);
        return sendLoggedJson(res, 500, { error: error.message });
    }
});

// Internal endpoint to process webhooks (called by BackendNode)
app.post('/process-webhook', async (req, res) => {
    logRequestDetails(req);

    if (!directWebhookProcessingEnabled) {
        return sendLoggedJson(res, 409, {
            error: 'worker_slaves_do_not_accept_webhooks',
            message: 'Send internal webhook jobs to the streamer master instead of a worker slave.'
        });
    }
    if (!isAuthorizedInternalWorkerRequest(req)) {
        return sendLoggedJson(res, 401, {
            error: 'unauthorized_worker_request',
            message: 'Missing or invalid worker shared secret.'
        });
    }

    try {
        const success = await worker.processWebhook(req.body, { throwOnError: false });
        return sendLoggedJson(res, 200, { success });
    } catch (error) {
        console.error('Error in /process-webhook:', error);
        return sendLoggedJson(res, 500, { error: error.message });
    }
});

const server = app.listen(port, () => {
    console.log(`Worker node listening at http://localhost:${port}`);
    streamerClient.start();
});

const gracefulShutdown = (signal) => {
    console.log(`Received ${signal}. Shutting down worker node...`);
    streamerClient.stop();
    server.close(() => {
        console.log('Worker HTTP server closed.');
        process.exit(0);
    });
    setTimeout(() => {
        console.warn('Forced shutdown after timeout.');
        process.exit(1);
    }, 10_000).unref();
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

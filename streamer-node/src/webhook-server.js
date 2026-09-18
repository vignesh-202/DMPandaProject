const crypto = require('crypto');

function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
    if (!appSecret) return true; // If secret not configured, bypass
    if (!signatureHeader || !rawBody) return false;

    try {
        const parts = signatureHeader.split('=');
        const hash = parts.length === 2 ? parts[1] : signatureHeader;
        const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
        const hashBuf = Buffer.from(hash, 'utf8');
        const expectedBuf = Buffer.from(expected, 'utf8');
        if (hashBuf.length !== expectedBuf.length) return false;
        return crypto.timingSafeEqual(hashBuf, expectedBuf);
    } catch (_) {
        return false;
    }
}

function registerWebhookRoutes(app, {
    verifyToken = '',
    appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET || '',
    onWebhook = async () => ({ accepted: 0 }),
    getStats = () => ({})
} = {}) {
    app.use(express.json({
        verify: (req, _res, buf) => {
            req.rawBody = buf;
        }
    }));

    app.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            service: 'streamer-node',
            ...getStats()
        });
    });

    app.get('/metrics', (_req, res) => {
        res.json(getStats());
    });

    app.get('/webhook', (req, res) => {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && challenge && token === verifyToken) {
            return res.status(200).send(challenge);
        }
        return res.status(403).json({ error: 'Webhook verification failed' });
    });

    app.post('/webhook', async (req, res) => {
        const signature = req.headers['x-hub-signature-256'] || '';
        const secret = appSecret || process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET || '';

        if (secret && signature) {
            const isValid = verifyMetaSignature(req.rawBody, signature, secret);
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid webhook signature' });
            }
        }

        try {
            const result = await onWebhook(req.body || {});
            return res.status(200).json({
                success: true,
                accepted: Number(result?.accepted || 0)
            });
        } catch (error) {
            return res.status(500).json({
                error: String(error?.message || error || 'webhook_error')
            });
        }
    });
}

module.exports = {
    registerWebhookRoutes
};

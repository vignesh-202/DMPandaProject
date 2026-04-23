const express = require('express');

function registerWebhookRoutes(app, {
    verifyToken = '',
    onWebhook = async () => ({ accepted: 0 }),
    getStats = () => ({})
} = {}) {
    app.use(express.json());

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

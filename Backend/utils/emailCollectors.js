const axios = require('axios');

const sendWebhookPayload = async (webhookUrl, payload) => {
    const safeWebhookUrl = String(webhookUrl || '').trim();
    if (!safeWebhookUrl) {
        throw new Error('Webhook URL is required.');
    }
    try {
        const response = await axios.post(safeWebhookUrl, payload, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            },
            validateStatus: () => true
        });
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Webhook responded with status ${response.status}.`);
        }
        return true;
    } catch (error) {
        throw new Error(error?.message || 'Webhook verification failed.');
    }
};

module.exports = {
    sendWebhookPayload
};

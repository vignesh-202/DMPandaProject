const axios = require('axios');

const sendWebhookPayload = async (webhookUrl, payload) => {
    const response = await axios.post(
        String(webhookUrl || '').trim(),
        payload,
        {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 15000,
            validateStatus: (status) => status >= 200 && status < 300
        }
    );

    return {
        status: response.status,
        data: response.data
    };
};

const deliverCollectedEmail = async (destination, payload) => {
    const destinationType = String(destination?.destination_type || '').trim().toLowerCase();

    if (destinationType === 'webhook') {
        return sendWebhookPayload(destination?.webhook_url, payload);
    }

    throw new Error('Unsupported email collector destination type; expected webhook');
};

module.exports = {
    deliverCollectedEmail,
    sendWebhookPayload
};

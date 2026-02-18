
const axios = require('axios');

const testWebhook = async () => {
    const payload = {
        "object": "instagram",
        "entry": [
            {
                "id": "25892951586974678",
                "time": Date.now(),
                "messaging": [
                    {
                        "sender": { "id": "12345678" },
                        "recipient": { "id": "25892951586974678" },
                        "timestamp": Date.now(),
                        "message": {
                            "mid": "m_123",
                            "text": "hello"
                        }
                    }
                ]
            }
        ]
    };

    try {
        const response = await axios.post('http://localhost:3001/process-webhook', payload);
        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error sending test webhook:', error.response ? error.response.data : error.message);
    }
};

testWebhook();

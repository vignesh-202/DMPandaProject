const axios = require('axios');

class InstagramAPI {
    constructor(accessToken) {
        this.accessToken = accessToken;
        this.apiVersion = process.env.IG_API_VERSION || 'v24.0';
        this.baseUrl = `https://graph.instagram.com/${this.apiVersion}`;
    }

    async sendMessage(recipientId, messageType, payload) {
        const url = `${this.baseUrl}/me/messages`;
        const params = { access_token: this.accessToken };

        const messageData = {
            recipient: { id: recipientId },
            message: this._buildMessagePayload(messageType, payload)
        };

        try {
            const response = await axios.post(url, messageData, { params });
            if (response.status === 200) {
                console.info(`Message sent successfully: ${response.data.message_id}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to send message:', error.response ? error.response.data : error.message);
            return false;
        }
    }

    _buildMessagePayload(messageType, payload) {
        if (messageType === 'text' || messageType === 'template_text') {
            return { text: payload.text || '' };
        }

        if (messageType === 'quick_replies' || messageType === 'template_quick_replies') {
            return {
                text: payload.text || '',
                quick_replies: (payload.replies || []).map(reply => ({
                    content_type: reply.content_type || 'text',
                    title: reply.title || '',
                    payload: reply.payload || ''
                }))
            };
        }

        if (messageType === 'button' || messageType === 'template_buttons') {
            return {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'button',
                        text: payload.text || '',
                        buttons: (payload.buttons || []).map(btn => ({
                            type: btn.type || 'web_url',
                            title: btn.title || '',
                            url: btn.url || ''
                        }))
                    }
                }
            };
        }

        if (messageType === 'carousel' || messageType === 'template_carousel') {
            return {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'generic',
                        elements: (payload.elements || []).map(elem => ({
                            title: elem.title || '',
                            subtitle: elem.subtitle || '',
                            image_url: elem.image_url || '',
                            buttons: (elem.buttons || []).map(btn => ({
                                type: btn.type || 'web_url',
                                title: btn.title || '',
                                url: btn.url || ''
                            }))
                        }))
                    }
                }
            };
        }

        if (messageType === 'media' || messageType === 'template_media') {
            return {
                attachment: {
                    type: payload.media_type || 'image',
                    payload: {
                        url: payload.media_url || '',
                        is_reusable: true
                    }
                }
            };
        }

        // Default to text if unknown
        return { text: payload.text || 'Message type not supported' };
    }
}

module.exports = InstagramAPI;

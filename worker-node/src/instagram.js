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
        const sanitizeText = (value) => {
            const text = String(value || '');
            // Remove legacy provider watermark if present in stored template text.
            return text
                .replace(/\s*Automation Powered by\s*@replyruch\s*/ig, ' ')
                .replace(/\s{2,}/g, ' ')
                .trim();
        };

        if (messageType === 'text' || messageType === 'template_text') {
            return { text: sanitizeText(payload.text) };
        }

        if (messageType === 'quick_replies' || messageType === 'template_quick_replies') {
            return {
                text: sanitizeText(payload.text),
                quick_replies: (payload.replies || []).map(reply => ({
                    content_type: reply.content_type || 'text',
                    title: sanitizeText(reply.title),
                    payload: sanitizeText(reply.payload)
                }))
            };
        }

        if (messageType === 'button' || messageType === 'template_buttons') {
            return {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'button',
                        text: sanitizeText(payload.text),
                        buttons: (payload.buttons || []).map((btn) => {
                            const buttonType = btn.type || 'web_url';
                            const baseButton = {
                                type: buttonType,
                                title: sanitizeText(btn.title)
                            };

                            if (buttonType === 'postback') {
                                return {
                                    ...baseButton,
                                    payload: String(btn.payload || '').trim()
                                };
                            }

                            return {
                                ...baseButton,
                                url: btn.url || ''
                            };
                        })
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
                            title: sanitizeText(elem.title),
                            subtitle: sanitizeText(elem.subtitle),
                            image_url: elem.image_url || '',
                            buttons: (elem.buttons || []).map(btn => ({
                                type: btn.type || 'web_url',
                                title: sanitizeText(btn.title),
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

        if (messageType === 'template_share_post') {
            const postId = payload.media_id || payload.post_id || '';
            if (!postId) {
                // Fallback for incomplete templates; keeps behavior predictable.
                if (payload.media_url) {
                    return {
                        attachment: {
                            type: payload.media_type || 'image',
                            payload: {
                                url: payload.media_url,
                                is_reusable: true
                            }
                        }
                    };
                }
                return { text: 'Shared post is not configured.' };
            }
            return {
                attachment: {
                    type: 'MEDIA_SHARE',
                    payload: {
                        id: postId
                    }
                }
            };
        }

        if (messageType === 'template_media_attachment') {
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

        if (messageType === 'template_url') {
            return { text: payload.text || payload.url || '' };
        }

        // Default to text if unknown
        return { text: payload.text || 'Message type not supported' };
    }

    async replyToComment(commentId, message) {
        const safeCommentId = String(commentId || '').trim();
        const safeMessage = String(message || '').trim();
        if (!safeCommentId || !safeMessage) return false;

        const url = `${this.baseUrl}/${safeCommentId}/replies`;
        const params = {
            access_token: this.accessToken
        };

        try {
            const response = await axios.post(url, { message: safeMessage }, { params });
            return response.status >= 200 && response.status < 300;
        } catch (error) {
            console.error(
                `Failed to reply to comment ${safeCommentId}:`,
                error.response ? error.response.data : error.message
            );
            return false;
        }
    }

    async sendSenderAction(recipientId, action) {
        const safeRecipientId = String(recipientId || '').trim();
        const safeAction = String(action || '').trim().toLowerCase();
        if (!safeRecipientId || !safeAction) return false;

        const url = `${this.baseUrl}/me/messages`;
        const params = { access_token: this.accessToken };

        try {
            const response = await axios.post(url, {
                recipient: { id: safeRecipientId },
                sender_action: safeAction
            }, { params });
            return response.status >= 200 && response.status < 300;
        } catch (error) {
            console.warn(
                `Failed to send sender_action ${safeAction} to ${safeRecipientId}:`,
                error.response ? error.response.data : error.message
            );
            return false;
        }
    }

    async markSeen(recipientId) {
        return this.sendSenderAction(recipientId, 'mark_seen');
    }

    async setTyping(recipientId, isTyping) {
        return this.sendSenderAction(recipientId, isTyping ? 'typing_on' : 'typing_off');
    }

    async getUserProfile(igScopedId) {
        const fields = 'name,username,is_user_follow_business,is_business_follow_user';
        const url = `${this.baseUrl}/${igScopedId}`;
        const params = {
            fields,
            access_token: this.accessToken
        };

        try {
            const response = await axios.get(url, { params });
            return response.data || null;
        } catch (error) {
            console.error(
                `Failed to fetch user profile for ${igScopedId}:`,
                error.response ? error.response.data : error.message
            );
            return null;
        }
    }
}

module.exports = InstagramAPI;

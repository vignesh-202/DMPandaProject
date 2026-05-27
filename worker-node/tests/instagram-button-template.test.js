const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const InstagramAPI = require('../src/instagram');

test('button templates preserve web_url and postback actions', () => {
    const api = new InstagramAPI('demo-token');
    const payload = api._buildMessagePayload('template_buttons', {
        text: 'Choose an option',
        buttons: [
            { type: 'web_url', title: 'Visit Site', url: 'https://example.com' },
            { type: 'postback', title: 'Ask More', payload: 'Tell me more' }
        ]
    });

    assert.equal(payload.attachment.type, 'template');
    assert.equal(payload.attachment.payload.template_type, 'button');
    assert.deepEqual(payload.attachment.payload.buttons, [
        { type: 'web_url', title: 'Visit Site', url: 'https://example.com' },
        { type: 'postback', title: 'Ask More', payload: 'Tell me more' }
    ]);
});

test('blocked requests do not increment account action usage callbacks', async () => {
    const originalPost = axios.post;
    let completionCalls = 0;

    axios.post = async () => ({ status: 200, data: { message_id: 'mid-1' } });

    try {
        const api = new InstagramAPI('demo-token', {
            onBeforeRequest: async () => ({ allowed: false, code: 'daily_action_limit_reached', reason: 'meta_api_daily_limit_reached' }),
            onRequestComplete: async () => {
                completionCalls += 1;
            }
        });

        const sent = await api.sendMessage('recipient-1', 'template_text', { text: 'Hello' });
        assert.equal(sent, false);
        assert.equal(completionCalls, 0);
    } finally {
        axios.post = originalPost;
    }
});

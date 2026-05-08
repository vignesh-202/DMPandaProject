const test = require('node:test');
const assert = require('node:assert/strict');

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

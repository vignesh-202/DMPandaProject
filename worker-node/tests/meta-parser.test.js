const test = require('node:test');
const assert = require('node:assert/strict');

const { splitWebhookPayload } = require('../../streamer-node/src/meta-parser');

test('splitWebhookPayload uses entry id as business account for messaging events', () => {
    const jobs = splitWebhookPayload({
        object: 'instagram',
        entry: [{
            id: '17841452817679462',
            messaging: [{
                sender: { id: '17841452817679462' },
                recipient: { id: '845495078336227' },
                message: { is_echo: true, mid: 'mid-echo-2' }
            }]
        }]
    });

    assert.equal(jobs.length, 1);
    assert.deepEqual(
        {
            eventType: jobs[0].eventType,
            accountId: jobs[0].accountId,
            recipientId: jobs[0].recipientId,
            senderId: jobs[0].senderId,
            conversationKey: jobs[0].conversationKey,
            eventKey: jobs[0].eventKey
        },
        {
            eventType: 'message',
            accountId: '17841452817679462',
            recipientId: '17841452817679462',
            senderId: '17841452817679462',
            conversationKey: '17841452817679462:17841452817679462',
            eventKey: 'mid-echo-2'
        }
    );
});

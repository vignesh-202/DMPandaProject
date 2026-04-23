const test = require('node:test');
const assert = require('node:assert/strict');

const JobStore = require('../src/job-store');
const { splitWebhookPayload } = require('../src/meta-parser');

test('comment webhook jobs share a stable event key', () => {
    const jobs = splitWebhookPayload({
        object: 'instagram',
        entry: [{
            id: 'acct_1',
            changes: [{
                field: 'comments',
                value: {
                    id: 'comment_123',
                    from: { id: 'user_9' },
                    media: { id: 'media_7', media_product_type: 'REELS' },
                    text: 'Hi'
                }
            }]
        }]
    });

    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].eventKey, 'comment:acct_1:user_9:comment_123');
});

test('job store drops duplicate event keys while original is active and after completion', () => {
    const store = new JobStore({ maxAttempts: 3, eventKeyTtlMs: 60_000 });
    const baseJob = {
        payload: { ok: true },
        eventType: 'comment',
        accountId: 'acct_1',
        recipientId: 'acct_1',
        senderId: 'user_9',
        conversationKey: 'acct_1:user_9',
        eventKey: 'comment:acct_1:user_9:comment_123'
    };

    const first = store.enqueueMany([baseJob]);
    assert.equal(first.length, 1);

    const duplicateWhilePending = store.enqueueMany([baseJob]);
    assert.equal(duplicateWhilePending.length, 0);

    store.markAssigned(first[0].jobId, 'worker-1');
    store.markAccepted(first[0].jobId);
    store.markCompleted(first[0].jobId);

    const duplicateAfterCompletion = store.enqueueMany([baseJob]);
    assert.equal(duplicateAfterCompletion.length, 0);
});

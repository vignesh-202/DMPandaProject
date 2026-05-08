const test = require('node:test');
const assert = require('node:assert/strict');

const StreamerClient = require('../src/streamer-client');

test('streamer client reports disconnected state until websocket is active', () => {
    const client = new StreamerClient({ worker: {} });
    assert.equal(client.isConnected(), false);
});

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

test('sendMessage uses comment_id in recipient and passes commentId to _post', async () => {
    const originalPost = axios.post;
    let postUrl = '';
    let postData = null;

    axios.post = async (url, data, config) => {
        postUrl = url;
        postData = data;
        return { status: 200, data: { message_id: 'mid-1' } };
    };

    try {
        const api = new InstagramAPI('demo-token');
        const sent = await api.sendMessage('recipient-1', 'template_text', { text: 'Hello' }, { commentId: 'comment-123' });
        assert.equal(sent, true);
        assert.equal(postUrl, 'https://graph.instagram.com/v24.0/me/messages');
        assert.deepEqual(postData, {
            recipient: { comment_id: 'comment-123' },
            message: { text: 'Hello' }
        });
    } finally {
        axios.post = originalPost;
    }
});

test('replyToComment posts to the Instagram Graph replies edge', async () => {
    const originalPost = axios.post;
    let postUrl = '';
    let postData = null;

    axios.post = async (url, data) => {
        postUrl = url;
        postData = data;
        return { status: 200, data: { id: 'reply-1' } };
    };

    try {
        const api = new InstagramAPI('demo-token');
        const sent = await api.replyToComment('comment-123', 'Thanks! Check your DM.');
        assert.equal(sent, true);
        assert.equal(postUrl, 'https://graph.instagram.com/v24.0/comment-123/replies');
        assert.deepEqual(postData, {
            message: 'Thanks! Check your DM.'
        });
    } finally {
        axios.post = originalPost;
    }
});

test('hideComment updates the IG comment hidden flag', async () => {
    const originalPost = axios.post;
    let postUrl = '';
    let postData = null;
    let postConfig = null;

    axios.post = async (url, data, config) => {
        postUrl = url;
        postData = data;
        postConfig = config;
        return { status: 200, data: { success: true } };
    };

    try {
        const api = new InstagramAPI('demo-token');
        const sent = await api.hideComment('comment-456', true);
        assert.equal(sent, true);
        assert.equal(postUrl, 'https://graph.instagram.com/v24.0/comment-456');
        assert.deepEqual(postData, {});
        assert.deepEqual(postConfig?.params, {
            access_token: 'demo-token',
            hide: true
        });
    } finally {
        axios.post = originalPost;
    }
});

test('deleteComment uses the IG comment delete endpoint', async () => {
    const originalDelete = axios.delete;
    let deleteUrl = '';

    axios.delete = async (url) => {
        deleteUrl = url;
        return { status: 200, data: { success: true } };
    };

    try {
        const api = new InstagramAPI('demo-token');
        const sent = await api.deleteComment('comment-789');
        assert.equal(sent, true);
        assert.equal(deleteUrl, 'https://graph.instagram.com/v24.0/comment-789');
    } finally {
        axios.delete = originalDelete;
    }
});

test('getComment fetches the IG comment hidden status', async () => {
    const originalGet = axios.get;
    let getUrl = '';
    let getConfig = null;

    axios.get = async (url, config) => {
        getUrl = url;
        getConfig = config;
        return { status: 200, data: { id: 'comment-321', hidden: true } };
    };

    try {
        const api = new InstagramAPI('demo-token');
        const comment = await api.getComment('comment-321');
        assert.deepEqual(comment, { id: 'comment-321', hidden: true });
        assert.equal(getUrl, 'https://graph.instagram.com/v24.0/comment-321');
        assert.deepEqual(getConfig?.params, {
            fields: 'id,hidden,text,username',
            access_token: 'demo-token'
        });
    } finally {
        axios.get = originalGet;
    }
});

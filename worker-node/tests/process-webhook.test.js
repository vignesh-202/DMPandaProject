const test = require('node:test');
const assert = require('node:assert/strict');

const DMWorker = require('../src/worker');
const AppwriteClient = require('../src/appwrite');

test('processWebhook delegates to processMessage', async () => {
    const worker = Object.create(DMWorker.prototype);
    const payload = { entry: [{ messaging: [] }] };

    worker.processMessage = async (webhookData) => {
        assert.equal(webhookData, payload);
        return true;
    };

    const result = await worker.processWebhook(payload);
    assert.equal(result, true);
});

test('processMessage ignores echoed outbound messages before text matching', async () => {
    const worker = Object.create(DMWorker.prototype);

    const result = await worker.processMessage({
        entry: [{
            id: '17841452817679462',
            messaging: [{
                sender: { id: '17841452817679462' },
                recipient: { id: '845495078336227' },
                message: { is_echo: true }
            }]
        }]
    });

    assert.equal(result, false);
});

test('event meta extraction keeps business account as recipient for outbound echoes', () => {
    const worker = Object.create(DMWorker.prototype);

    const meta = worker._extractEventMetaFromWebhook({
        entry: [{
            id: '17841452817679462',
            messaging: [{
                sender: { id: '17841452817679462' },
                recipient: { id: '845495078336227' },
                message: { is_echo: true, mid: 'mid-echo-1' }
            }]
        }]
    });

    assert.deepEqual(meta, {
        eventType: 'message',
        accountId: '17841452817679462',
        recipientId: '17841452817679462',
        senderId: '17841452817679462',
        conversationKey: '17841452817679462:17841452817679462',
        eventKey: 'mid-echo-1'
    });
});

test('processMessage ignores Instagram read receipt events', async () => {
    const worker = Object.create(DMWorker.prototype);

    const result = await worker.processMessage({
        entry: [{
            id: '17841452817679462',
            messaging: [{
                sender: { id: '845495078336227' },
                recipient: { id: '17841452817679462' },
                read: { mid: 'mid-read-1' }
            }]
        }]
    });

    assert.equal(result, false);
});

test('processMessage sends suggest more follow-up from automations config', async () => {
    const workerPath = require.resolve('../src/worker');
    const appwritePath = require.resolve('../src/appwrite');
    const instagramPath = require.resolve('../src/instagram');
    const matcherPath = require.resolve('../src/matcher');
    const rendererPath = require.resolve('../src/renderer');
    const watermarkPath = require.resolve('../src/watermark');

    const originalEntries = new Map([
        [workerPath, require.cache[workerPath]],
        [appwritePath, require.cache[appwritePath]],
        [instagramPath, require.cache[instagramPath]],
        [matcherPath, require.cache[matcherPath]],
        [rendererPath, require.cache[rendererPath]],
        [watermarkPath, require.cache[watermarkPath]]
    ]);

    const restore = () => {
        for (const [modulePath, entry] of originalEntries.entries()) {
            if (entry) {
                require.cache[modulePath] = entry;
            } else {
                delete require.cache[modulePath];
            }
        }
    };

    const sentMessages = [];
    const matchedAutomation = {
        $id: 'auto-1',
        title: 'Primary DM',
        template_id: 'tpl-primary',
        account_id: '17841452817679462',
        suggest_more_enabled: true
    };
    const suggestMoreAutomation = {
        $id: 'auto-suggest',
        template_id: 'tpl-suggest',
        account_id: '17841452817679462'
    };

    class MockAppwriteClient {
        constructor() {
            this.calls = {
                getActiveConfigAutomation: [],
                upsertConversationState: [],
                recordCollectedEmail: []
            };
        }

        async getIGAccount() {
            return {
                username: 'demo_account',
                access_token: 'token',
                user_id: 'user-1',
                ig_user_id: '17841452817679462',
                account_id: '17841452817679462',
                effective_access: true,
                access_state: 'active',
                access_reason: null
            };
        }

        async getActiveAutomations(accountIds) {
            assert.ok(Array.isArray(accountIds));
            assert.ok(accountIds.includes('17841452817679462'));
            return [matchedAutomation];
        }

        async getActiveConfigAutomation(accountIds, automationType) {
            this.calls.getActiveConfigAutomation.push({ accountIds, automationType });
            return suggestMoreAutomation;
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-primary') {
                return { type: 'template_text', payload: { text: 'Primary reply' } };
            }
            if (templateId === 'tpl-suggest') {
                return { type: 'template_text', payload: { text: 'Suggest more reply' } };
            }
            return null;
        }

        async getProfile() {
            return null;
        }

        async getExecutionState() {
            return {
                accessState: { kill_switch_enabled: true, automation_locked: false },
                profile: {
                    limits_json: JSON.stringify({ hourly_action_limit: 1000, daily_action_limit: 1000, monthly_action_limit: 1000 }),
                    hourly_actions_used: 0,
                    daily_actions_used: 0,
                    monthly_actions_used: 0
                }
            };
        }

        async getWatermarkPolicy() {
            return { enabled: false };
        }

        async getConversationState() {
            return null;
        }

        async upsertConversationState(payload) {
            this.calls.upsertConversationState.push(payload);
            return payload;
        }

        async clearConversationState() {
            return true;
        }

        async recordCollectedEmail(payload) {
            this.calls.recordCollectedEmail.push(payload);
            return true;
        }

        buildAutomationTemplate(automation) {
            return { type: 'template_text', payload: { text: automation.template_content || '' } };
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload) {
            sentMessages.push({ recipientId, messageType, payload });
            return true;
        }

        async getUserProfile() {
            return { is_user_follow_business: true };
        }
    }

    try {
        delete require.cache[workerPath];
        require.cache[appwritePath] = { id: appwritePath, filename: appwritePath, loaded: true, exports: MockAppwriteClient };
        require.cache[instagramPath] = { id: instagramPath, filename: instagramPath, loaded: true, exports: MockInstagramAPI };
        require.cache[matcherPath] = {
            id: matcherPath,
            filename: matcherPath,
            loaded: true,
            exports: { matchDM: () => matchedAutomation }
        };
        require.cache[rendererPath] = {
            id: rendererPath,
            filename: rendererPath,
            loaded: true,
            exports: { render: (template) => template }
        };
        require.cache[watermarkPath] = {
            id: watermarkPath,
            filename: watermarkPath,
            loaded: true,
            exports: {
                planWatermark: ({ payload }) => ({ primaryPayload: payload, secondaryPayload: null }),
                resolveWatermarkPolicy: () => ({ enabled: false })
            }
        };

        const FreshWorker = require('../src/worker');
        const worker = new FreshWorker();
        const result = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: 'sender-1' },
                    message: { text: 'help' }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'dm' });
        assert.equal(sentMessages.length, 2);
        assert.deepEqual(
            sentMessages.map((message) => message.payload.text),
            ['Primary reply', 'Suggest more reply']
        );
        assert.equal(worker.appwrite.calls.getActiveConfigAutomation.length, 1);
        assert.equal(worker.appwrite.calls.getActiveConfigAutomation[0].automationType, 'suggest_more');
    } finally {
        restore();
    }
});

test('processMessage falls back to welcome message when no DM keyword matches', async () => {
    const workerPath = require.resolve('../src/worker');
    const appwritePath = require.resolve('../src/appwrite');
    const instagramPath = require.resolve('../src/instagram');
    const matcherPath = require.resolve('../src/matcher');
    const rendererPath = require.resolve('../src/renderer');
    const watermarkPath = require.resolve('../src/watermark');

    const originalEntries = new Map([
        [workerPath, require.cache[workerPath]],
        [appwritePath, require.cache[appwritePath]],
        [instagramPath, require.cache[instagramPath]],
        [matcherPath, require.cache[matcherPath]],
        [rendererPath, require.cache[rendererPath]],
        [watermarkPath, require.cache[watermarkPath]]
    ]);

    const restore = () => {
        for (const [modulePath, entry] of originalEntries.entries()) {
            if (entry) {
                require.cache[modulePath] = entry;
            } else {
                delete require.cache[modulePath];
            }
        }
    };

    const sentMessages = [];
    const welcomeAutomation = {
        $id: 'auto-welcome',
        title: 'Welcome Message',
        template_id: 'tpl-welcome',
        account_id: '17841452817679462',
        is_active: true,
        automation_type: 'welcome_message'
    };

    class MockAppwriteClient {
        async getIGAccount() {
            return {
                username: 'demo_account',
                access_token: 'token',
                user_id: 'user-1',
                ig_user_id: '17841452817679462',
                account_id: '17841452817679462',
                effective_access: true,
                access_state: 'active',
                access_reason: null
            };
        }

        async getActiveAutomations() {
            return [];
        }

        async getActiveConfigAutomation(accountIds, automationType) {
            assert.ok(Array.isArray(accountIds));
            assert.equal(automationType, 'welcome_message');
            return welcomeAutomation;
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-welcome') {
                return { type: 'template_text', payload: { text: 'Welcome reply' } };
            }
            return null;
        }

        async getProfile() {
            return null;
        }

        async getExecutionState() {
            return {
                accessState: { kill_switch_enabled: true, automation_locked: false },
                profile: {
                    limits_json: JSON.stringify({ hourly_action_limit: 1000, daily_action_limit: 1000, monthly_action_limit: 1000 }),
                    hourly_actions_used: 0,
                    daily_actions_used: 0,
                    monthly_actions_used: 0
                }
            };
        }

        async getWatermarkPolicy() {
            return { enabled: false };
        }

        async getConversationState() {
            return null;
        }

        async upsertConversationState() {
            return null;
        }

        async clearConversationState() {
            return true;
        }

        async recordCollectedEmail() {
            return true;
        }

        buildAutomationTemplate(automation) {
            return { type: 'template_text', payload: { text: automation.template_content || '' } };
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload) {
            sentMessages.push({ recipientId, messageType, payload });
            return true;
        }

        async getUserProfile() {
            return { is_user_follow_business: true };
        }
    }

    try {
        delete require.cache[workerPath];
        require.cache[appwritePath] = { id: appwritePath, filename: appwritePath, loaded: true, exports: MockAppwriteClient };
        require.cache[instagramPath] = { id: instagramPath, filename: instagramPath, loaded: true, exports: MockInstagramAPI };
        require.cache[matcherPath] = {
            id: matcherPath,
            filename: matcherPath,
            loaded: true,
            exports: { matchDM: () => null }
        };
        require.cache[rendererPath] = {
            id: rendererPath,
            filename: rendererPath,
            loaded: true,
            exports: { render: (template) => template }
        };
        require.cache[watermarkPath] = {
            id: watermarkPath,
            filename: watermarkPath,
            loaded: true,
            exports: {
                planWatermark: ({ payload }) => ({ primaryPayload: payload, secondaryPayload: null }),
                resolveWatermarkPolicy: () => ({ enabled: false })
            }
        };

        const FreshWorker = require('../src/worker');
        const worker = new FreshWorker();
        const result = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: 'sender-1' },
                    message: { text: 'Hi' }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'welcome_message' });
        assert.equal(sentMessages.length, 1);
        assert.equal(sentMessages[0].payload.text, 'Welcome reply');
    } finally {
        restore();
    }
});

test('processMessage sends suggest more after welcome-message fallback when configured', async () => {
    const workerPath = require.resolve('../src/worker');
    const appwritePath = require.resolve('../src/appwrite');
    const instagramPath = require.resolve('../src/instagram');
    const matcherPath = require.resolve('../src/matcher');
    const rendererPath = require.resolve('../src/renderer');
    const watermarkPath = require.resolve('../src/watermark');

    const originalEntries = new Map([
        [workerPath, require.cache[workerPath]],
        [appwritePath, require.cache[appwritePath]],
        [instagramPath, require.cache[instagramPath]],
        [matcherPath, require.cache[matcherPath]],
        [rendererPath, require.cache[rendererPath]],
        [watermarkPath, require.cache[watermarkPath]]
    ]);

    const restore = () => {
        for (const [modulePath, entry] of originalEntries.entries()) {
            if (entry) {
                require.cache[modulePath] = entry;
            } else {
                delete require.cache[modulePath];
            }
        }
    };

    const sentMessages = [];
    const welcomeAutomation = {
        $id: 'auto-welcome',
        title: 'Welcome Message',
        template_id: 'tpl-welcome',
        account_id: '17841452817679462',
        is_active: true,
        automation_type: 'welcome_message',
        suggest_more_enabled: true
    };
    const suggestMoreAutomation = {
        $id: 'auto-suggest',
        title: 'Suggest More',
        template_id: 'tpl-suggest',
        account_id: '17841452817679462',
        is_active: true,
        automation_type: 'suggest_more'
    };

    class MockAppwriteClient {
        constructor() {
            this.calls = {
                getActiveConfigAutomation: []
            };
        }

        async getIGAccount() {
            return {
                username: 'demo_account',
                access_token: 'token',
                user_id: 'user-1',
                ig_user_id: '17841452817679462',
                account_id: '17841452817679462',
                effective_access: true,
                access_state: 'active',
                access_reason: null
            };
        }

        async getActiveAutomations() {
            return [];
        }

        async getActiveConfigAutomation(accountIds, automationType) {
            this.calls.getActiveConfigAutomation.push({ accountIds, automationType });
            if (automationType === 'welcome_message') return welcomeAutomation;
            if (automationType === 'suggest_more') return suggestMoreAutomation;
            return null;
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-welcome') {
                return { type: 'template_text', payload: { text: 'Welcome reply' } };
            }
            if (templateId === 'tpl-suggest') {
                return { type: 'template_text', payload: { text: 'Suggest more reply' } };
            }
            return null;
        }

        async getProfile() {
            return null;
        }

        async getExecutionState() {
            return {
                accessState: { kill_switch_enabled: true, automation_locked: false },
                profile: {
                    limits_json: JSON.stringify({ hourly_action_limit: 1000, daily_action_limit: 1000, monthly_action_limit: 1000 }),
                    hourly_actions_used: 0,
                    daily_actions_used: 0,
                    monthly_actions_used: 0,
                    subscription_plan: 'pro',
                    comparison_json: JSON.stringify([{ key: 'suggest_more', value: true }])
                }
            };
        }

        async getWatermarkPolicy() {
            return { enabled: false };
        }

        async getConversationState() {
            return null;
        }

        async upsertConversationState() {
            return null;
        }

        async clearConversationState() {
            return true;
        }

        async recordCollectedEmail() {
            return true;
        }

        buildAutomationTemplate(automation) {
            return { type: 'template_text', payload: { text: automation.template_content || '' } };
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload) {
            sentMessages.push({ recipientId, messageType, payload });
            return true;
        }

        async getUserProfile() {
            return { is_user_follow_business: true };
        }
    }

    try {
        delete require.cache[workerPath];
        require.cache[appwritePath] = { id: appwritePath, filename: appwritePath, loaded: true, exports: MockAppwriteClient };
        require.cache[instagramPath] = { id: instagramPath, filename: instagramPath, loaded: true, exports: MockInstagramAPI };
        require.cache[matcherPath] = {
            id: matcherPath,
            filename: matcherPath,
            loaded: true,
            exports: { matchDM: () => null }
        };
        require.cache[rendererPath] = {
            id: rendererPath,
            filename: rendererPath,
            loaded: true,
            exports: { render: (template) => template }
        };
        require.cache[watermarkPath] = {
            id: watermarkPath,
            filename: watermarkPath,
            loaded: true,
            exports: {
                planWatermark: ({ payload }) => ({ primaryPayload: payload, secondaryPayload: null }),
                resolveWatermarkPolicy: () => ({ enabled: false })
            }
        };

        const FreshWorker = require('../src/worker');
        const worker = new FreshWorker();
        const result = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: 'sender-1' },
                    message: { text: 'Hi' }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'welcome_message' });
        assert.equal(sentMessages.length, 2);
        assert.deepEqual(
            sentMessages.map((message) => message.payload.text),
            ['Welcome reply', 'Suggest more reply']
        );
        assert.deepEqual(
            worker.appwrite.calls.getActiveConfigAutomation.map((entry) => entry.automationType),
            ['welcome_message', 'suggest_more']
        );
    } finally {
        restore();
    }
});

test('processMessage prefers convo starter matches before welcome-message fallback', async () => {
    const workerPath = require.resolve('../src/worker');
    const appwritePath = require.resolve('../src/appwrite');
    const instagramPath = require.resolve('../src/instagram');
    const matcherPath = require.resolve('../src/matcher');
    const rendererPath = require.resolve('../src/renderer');
    const watermarkPath = require.resolve('../src/watermark');

    const originalEntries = new Map([
        [workerPath, require.cache[workerPath]],
        [appwritePath, require.cache[appwritePath]],
        [instagramPath, require.cache[instagramPath]],
        [matcherPath, require.cache[matcherPath]],
        [rendererPath, require.cache[rendererPath]],
        [watermarkPath, require.cache[watermarkPath]]
    ]);

    const restore = () => {
        for (const [modulePath, entry] of originalEntries.entries()) {
            if (entry) {
                require.cache[modulePath] = entry;
            } else {
                delete require.cache[modulePath];
            }
        }
    };

    const sentMessages = [];
    const convoStarterAutomation = {
        $id: 'auto-convo-1',
        title: 'New Question 1',
        title_normalized: 'new question 1',
        template_id: 'tpl-convo-1',
        template_content: 'tpl-convo-1',
        account_id: '17841452817679462',
        is_active: true,
        automation_type: 'convo_starter',
        trigger_type: 'ice_breakers',
        once_per_user_24h: true
    };

    class MockAppwriteClient {
        constructor() {
            this.calls = { getActiveConfigAutomation: [] };
        }

        async getIGAccount() {
            return {
                username: 'demo_account',
                access_token: 'token',
                user_id: 'user-1',
                ig_user_id: '17841452817679462',
                account_id: '17841452817679462',
                effective_access: true,
                access_state: 'active',
                access_reason: null
            };
        }

        async getActiveAutomations() {
            return [convoStarterAutomation];
        }

        async getActiveConfigAutomation(accountIds, automationType) {
            this.calls.getActiveConfigAutomation.push({ accountIds, automationType });
            return null;
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-convo-1') {
                return { type: 'template_text', payload: { text: 'Convo starter reply' } };
            }
            return null;
        }

        async getProfile() {
            return null;
        }

        async getExecutionState() {
            return {
                accessState: { kill_switch_enabled: true, automation_locked: false },
                profile: {
                    limits_json: JSON.stringify({ hourly_action_limit: 1000, daily_action_limit: 1000, monthly_action_limit: 1000 }),
                    hourly_actions_used: 0,
                    daily_actions_used: 0,
                    monthly_actions_used: 0
                }
            };
        }

        async getWatermarkPolicy() {
            return { enabled: false };
        }

        async getConversationState() {
            return {
                pendingEmail: null,
                automationCooldowns: {
                    'auto-welcome': { expiresAt: new Date(Date.now() + 60_000).toISOString() }
                }
            };
        }

        async upsertConversationState() {
            return null;
        }

        async clearConversationState() {
            return true;
        }

        async recordCollectedEmail() {
            return true;
        }

        buildAutomationTemplate(automation) {
            return { type: 'template_text', payload: { text: automation.template_content || '' } };
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload) {
            sentMessages.push({ recipientId, messageType, payload });
            return true;
        }
    }

    try {
        delete require.cache[appwritePath];
        delete require.cache[instagramPath];
        delete require.cache[matcherPath];
        delete require.cache[rendererPath];
        delete require.cache[watermarkPath];
        delete require.cache[workerPath];

        require.cache[appwritePath] = { exports: MockAppwriteClient };
        require.cache[instagramPath] = { exports: MockInstagramAPI };
        require.cache[rendererPath] = {
            exports: {
                render() {
                    return { type: 'template_text', payload: { text: 'Convo starter reply' } };
                }
            }
        };
        require.cache[watermarkPath] = {
            exports: {
                planWatermark: ({ payload }) => ({ primaryPayload: payload, secondaryPayload: null }),
                resolveWatermarkPolicy: async () => ({ enabled: false })
            }
        };

        const FreshWorker = require('../src/worker');
        const worker = new FreshWorker();
        const result = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: '845495078336227' },
                    message: { text: 'new question 1' }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'convo_starter' });
        assert.equal(sentMessages.length, 1);
        assert.equal(sentMessages[0].payload.text, 'Convo starter reply');
        assert.equal(worker.appwrite.calls.getActiveConfigAutomation.length, 0);
    } finally {
        restore();
    }
});

test('processMessage matches postback payload for convo starters and menu automations before welcome fallback', async () => {
    const workerPath = require.resolve('../src/worker');
    const appwritePath = require.resolve('../src/appwrite');
    const instagramPath = require.resolve('../src/instagram');
    const matcherPath = require.resolve('../src/matcher');
    const rendererPath = require.resolve('../src/renderer');
    const watermarkPath = require.resolve('../src/watermark');

    const originalEntries = new Map([
        [workerPath, require.cache[workerPath]],
        [appwritePath, require.cache[appwritePath]],
        [instagramPath, require.cache[instagramPath]],
        [matcherPath, require.cache[matcherPath]],
        [rendererPath, require.cache[rendererPath]],
        [watermarkPath, require.cache[watermarkPath]]
    ]);

    const restore = () => {
        for (const [modulePath, entry] of originalEntries.entries()) {
            if (entry) {
                require.cache[modulePath] = entry;
            } else {
                delete require.cache[modulePath];
            }
        }
    };

    const sentMessages = [];
    const convoStarterAutomation = {
        $id: 'auto-convo-payload',
        title: 'Question Label',
        title_normalized: 'question label',
        payload: 'CONVO_PAYLOAD_1',
        template_id: 'tpl-postback-1',
        template_content: 'tpl-postback-1',
        account_id: '17841452817679462',
        is_active: true,
        automation_type: 'convo_starter',
        trigger_type: 'ice_breakers'
    };

    class MockAppwriteClient {
        constructor() {
            this.calls = { getActiveConfigAutomation: [] };
        }

        async getIGAccount() {
            return {
                username: 'demo_account',
                access_token: 'token',
                user_id: 'user-1',
                ig_user_id: '17841452817679462',
                account_id: '17841452817679462',
                effective_access: true,
                access_state: 'active',
                access_reason: null
            };
        }

        async getActiveAutomations() {
            return [convoStarterAutomation];
        }

        async getActiveConfigAutomation(accountIds, automationType) {
            this.calls.getActiveConfigAutomation.push({ accountIds, automationType });
            return null;
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-postback-1') {
                return { type: 'template_text', payload: { text: 'Postback reply' } };
            }
            return null;
        }

        async getProfile() { return null; }
        async getExecutionState() {
            return {
                accessState: { kill_switch_enabled: true, automation_locked: false },
                profile: {
                    limits_json: JSON.stringify({ hourly_action_limit: 1000, daily_action_limit: 1000, monthly_action_limit: 1000 }),
                    hourly_actions_used: 0,
                    daily_actions_used: 0,
                    monthly_actions_used: 0
                }
            };
        }
        async getWatermarkPolicy() { return { enabled: false }; }
        async getConversationState() { return null; }
        async upsertConversationState() { return null; }
        async clearConversationState() { return true; }
        async recordCollectedEmail() { return true; }
        buildAutomationTemplate(automation) {
            return { type: 'template_text', payload: { text: automation.template_content || '' } };
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload) {
            sentMessages.push({ recipientId, messageType, payload });
            return true;
        }
    }

    try {
        delete require.cache[appwritePath];
        delete require.cache[instagramPath];
        delete require.cache[matcherPath];
        delete require.cache[rendererPath];
        delete require.cache[watermarkPath];
        delete require.cache[workerPath];

        require.cache[appwritePath] = { exports: MockAppwriteClient };
        require.cache[instagramPath] = { exports: MockInstagramAPI };
        require.cache[rendererPath] = {
            exports: {
                render() {
                    return { type: 'template_text', payload: { text: 'Postback reply' } };
                }
            }
        };
        require.cache[watermarkPath] = {
            exports: {
                planWatermark: ({ payload }) => ({ primaryPayload: payload, secondaryPayload: null }),
                resolveWatermarkPolicy: async () => ({ enabled: false })
            }
        };

        const FreshWorker = require('../src/worker');
        const worker = new FreshWorker();
        const result = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: '845495078336227' },
                    postback: { payload: 'CONVO_PAYLOAD_1', title: 'Different Label' }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'convo_starter' });
        assert.equal(sentMessages.length, 1);
        assert.equal(sentMessages[0].payload.text, 'Postback reply');
        assert.equal(worker.appwrite.calls.getActiveConfigAutomation.length, 0);
    } finally {
        restore();
    }
});

test('processMessage sends button postback payload as text reply when no automation matches', async () => {
    const workerPath = require.resolve('../src/worker');
    const appwritePath = require.resolve('../src/appwrite');
    const instagramPath = require.resolve('../src/instagram');
    const matcherPath = require.resolve('../src/matcher');
    const rendererPath = require.resolve('../src/renderer');
    const watermarkPath = require.resolve('../src/watermark');

    const originalEntries = new Map([
        [workerPath, require.cache[workerPath]],
        [appwritePath, require.cache[appwritePath]],
        [instagramPath, require.cache[instagramPath]],
        [matcherPath, require.cache[matcherPath]],
        [rendererPath, require.cache[rendererPath]],
        [watermarkPath, require.cache[watermarkPath]]
    ]);

    const restore = () => {
        for (const [modulePath, entry] of originalEntries.entries()) {
            if (entry) {
                require.cache[modulePath] = entry;
            } else {
                delete require.cache[modulePath];
            }
        }
    };

    const sentMessages = [];

    class MockAppwriteClient {
        async getIGAccount() {
            return {
                username: 'demo_account',
                access_token: 'token',
                user_id: 'user-1',
                ig_user_id: '17841452817679462',
                account_id: '17841452817679462',
                effective_access: true,
                access_state: 'active',
                access_reason: null
            };
        }

        async getActiveAutomations() {
            return [];
        }

        async getActiveConfigAutomation() {
            return null;
        }

        async getProfile() {
            return null;
        }

        async getExecutionState() {
            return {
                accessState: { kill_switch_enabled: true, automation_locked: false },
                profile: {
                    limits_json: JSON.stringify({ hourly_action_limit: 1000, daily_action_limit: 1000, monthly_action_limit: 1000 }),
                    hourly_actions_used: 0,
                    daily_actions_used: 0,
                    monthly_actions_used: 0
                }
            };
        }

        async getWatermarkPolicy() {
            return { enabled: false };
        }

        async getConversationState() {
            return null;
        }

        async clearConversationState() {
            return true;
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload) {
            sentMessages.push({ recipientId, messageType, payload });
            return true;
        }
    }

    try {
        delete require.cache[workerPath];
        require.cache[appwritePath] = { id: appwritePath, filename: appwritePath, loaded: true, exports: MockAppwriteClient };
        require.cache[instagramPath] = { id: instagramPath, filename: instagramPath, loaded: true, exports: MockInstagramAPI };
        require.cache[matcherPath] = {
            id: matcherPath,
            filename: matcherPath,
            loaded: true,
            exports: { matchDM: () => null }
        };
        require.cache[rendererPath] = {
            id: rendererPath,
            filename: rendererPath,
            loaded: true,
            exports: { render: (template) => template }
        };
        require.cache[watermarkPath] = {
            id: watermarkPath,
            filename: watermarkPath,
            loaded: true,
            exports: {
                planWatermark: ({ payload }) => ({ primaryPayload: payload, secondaryPayload: null }),
                resolveWatermarkPolicy: () => ({ enabled: false })
            }
        };

        const FreshWorker = require('../src/worker');
        const worker = new FreshWorker();
        const result = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: '845495078336227' },
                    recipient: { id: '17841452817679462' },
                    postback: { payload: 'hi' }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'postback_text_reply' });
        assert.deepEqual(sentMessages, [{
            recipientId: '845495078336227',
            messageType: 'template_text',
            payload: { text: 'hi' }
        }]);
    } finally {
        restore();
    }
});

test('processMessage prompts for email collection and stores a valid reply on the next message', async () => {
    const workerPath = require.resolve('../src/worker');
    const appwritePath = require.resolve('../src/appwrite');
    const instagramPath = require.resolve('../src/instagram');
    const matcherPath = require.resolve('../src/matcher');
    const rendererPath = require.resolve('../src/renderer');
    const watermarkPath = require.resolve('../src/watermark');
    const emailDestinationsPath = require.resolve('../src/emailDestinations');

    const originalEntries = new Map([
        [workerPath, require.cache[workerPath]],
        [appwritePath, require.cache[appwritePath]],
        [instagramPath, require.cache[instagramPath]],
        [matcherPath, require.cache[matcherPath]],
        [rendererPath, require.cache[rendererPath]],
        [watermarkPath, require.cache[watermarkPath]],
        [emailDestinationsPath, require.cache[emailDestinationsPath]]
    ]);

    const restore = () => {
        for (const [modulePath, entry] of originalEntries.entries()) {
            if (entry) {
                require.cache[modulePath] = entry;
            } else {
                delete require.cache[modulePath];
            }
        }
    };

    const sentMessages = [];
    let savedState = null;
    const matchedAutomation = {
        $id: 'auto-email',
        title: 'Lead Capture',
        template_id: 'tpl-primary',
        account_id: '17841452817679462',
        automation_type: 'dm',
        collect_email_enabled: true,
        collect_email_prompt_message: 'Share your email',
        collect_email_fail_retry_message: 'Please send a valid email',
        collect_email_success_reply_message: 'Saved your email',
        collect_email_only_gmail: false
    };

    class MockAppwriteClient {
        constructor() {
            this.calls = {
                recordCollectedEmail: []
            };
        }

        async getIGAccount() {
            return {
                username: 'demo_account',
                access_token: 'token',
                user_id: 'user-1',
                ig_user_id: '17841452817679462',
                account_id: '17841452817679462',
                effective_access: true,
                access_state: 'active',
                access_reason: null
            };
        }

        async getActiveAutomations() {
            return [matchedAutomation];
        }

        async getActiveConfigAutomation() {
            return null;
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-primary') {
                return { type: 'template_text', payload: { text: 'Primary reply' } };
            }
            return null;
        }

        async getProfile() {
            return null;
        }

        async getExecutionState() {
            return {
                accessState: { kill_switch_enabled: true, automation_locked: false },
                profile: {
                    limits_json: JSON.stringify({ hourly_action_limit: 1000, daily_action_limit: 1000, monthly_action_limit: 1000 }),
                    hourly_actions_used: 0,
                    daily_actions_used: 0,
                    monthly_actions_used: 0
                }
            };
        }

        async getWatermarkPolicy() {
            return { enabled: false };
        }

        async getConversationState() {
            return savedState ? { state_json: savedState } : null;
        }

        async upsertConversationState({ stateData }) {
            savedState = stateData;
            return { state_json: stateData };
        }

        async clearConversationState() {
            savedState = null;
            return true;
        }

        async recordCollectedEmail(payload) {
            this.calls.recordCollectedEmail.push(payload);
            return true;
        }

        buildAutomationTemplate(automation) {
            return { type: 'template_text', payload: { text: automation.template_content || '' } };
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload) {
            sentMessages.push({ recipientId, messageType, payload });
            return true;
        }

        async getUserProfile() {
            return { is_user_follow_business: true };
        }
    }

    try {
        delete require.cache[workerPath];
        require.cache[appwritePath] = { id: appwritePath, filename: appwritePath, loaded: true, exports: MockAppwriteClient };
        require.cache[instagramPath] = { id: instagramPath, filename: instagramPath, loaded: true, exports: MockInstagramAPI };
        require.cache[matcherPath] = {
            id: matcherPath,
            filename: matcherPath,
            loaded: true,
            exports: { matchDM: () => matchedAutomation }
        };
        require.cache[rendererPath] = {
            id: rendererPath,
            filename: rendererPath,
            loaded: true,
            exports: { render: (template) => template }
        };
        require.cache[watermarkPath] = {
            id: watermarkPath,
            filename: watermarkPath,
            loaded: true,
            exports: {
                planWatermark: ({ payload }) => ({ primaryPayload: payload, secondaryPayload: null }),
                resolveWatermarkPolicy: () => ({ enabled: false })
            }
        };
        require.cache[emailDestinationsPath] = {
            id: emailDestinationsPath,
            filename: emailDestinationsPath,
            loaded: true,
            exports: {
                deliverCollectedEmail: async () => true
            }
        };

        const FreshWorker = require('../src/worker');
        const worker = new FreshWorker();

        const firstResult = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: 'sender-1' },
                    message: { text: 'help' }
                }]
            }]
        });

        const secondResult = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: 'sender-1' },
                    message: { text: 'person@example.com' }
                }]
            }]
        });

        assert.deepEqual(firstResult, { handled: true, automationType: 'dm' });
        assert.deepEqual(secondResult, { handled: true, automationType: 'dm' });
        assert.deepEqual(
            sentMessages.map((message) => message.payload.text),
            ['Share your email', 'Saved your email', 'Primary reply']
        );
        assert.equal(worker.appwrite.calls.recordCollectedEmail.length, 1);
        assert.equal(worker.appwrite.calls.recordCollectedEmail[0].normalizedEmail, 'person@example.com');
    } finally {
        restore();
    }
});

test('processMessage rejects non-gmail replies when collect email is gmail-only', async () => {
    const workerPath = require.resolve('../src/worker');
    const appwritePath = require.resolve('../src/appwrite');
    const instagramPath = require.resolve('../src/instagram');
    const matcherPath = require.resolve('../src/matcher');
    const rendererPath = require.resolve('../src/renderer');
    const watermarkPath = require.resolve('../src/watermark');
    const emailDestinationsPath = require.resolve('../src/emailDestinations');

    const originalEntries = new Map([
        [workerPath, require.cache[workerPath]],
        [appwritePath, require.cache[appwritePath]],
        [instagramPath, require.cache[instagramPath]],
        [matcherPath, require.cache[matcherPath]],
        [rendererPath, require.cache[rendererPath]],
        [watermarkPath, require.cache[watermarkPath]],
        [emailDestinationsPath, require.cache[emailDestinationsPath]]
    ]);

    const restore = () => {
        for (const [modulePath, entry] of originalEntries.entries()) {
            if (entry) {
                require.cache[modulePath] = entry;
            } else {
                delete require.cache[modulePath];
            }
        }
    };

    const sentMessages = [];
    let savedState = null;
    const matchedAutomation = {
        $id: 'auto-email',
        title: 'Lead Capture',
        template_id: 'tpl-primary',
        account_id: '17841452817679462',
        automation_type: 'dm',
        collect_email_enabled: true,
        collect_email_prompt_message: 'Share your gmail',
        collect_email_fail_retry_message: 'Please send a valid gmail',
        collect_email_success_reply_message: 'Saved your email',
        collect_email_only_gmail: true
    };

    class MockAppwriteClient {
        constructor() {
            this.calls = {
                recordCollectedEmail: []
            };
        }

        async getIGAccount() {
            return {
                username: 'demo_account',
                access_token: 'token',
                user_id: 'user-1',
                ig_user_id: '17841452817679462',
                account_id: '17841452817679462',
                effective_access: true,
                access_state: 'active',
                access_reason: null
            };
        }

        async getActiveAutomations() {
            return [matchedAutomation];
        }

        async getActiveConfigAutomation() {
            return null;
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-primary') {
                return { type: 'template_text', payload: { text: 'Primary reply' } };
            }
            return null;
        }

        async getProfile() {
            return null;
        }

        async getExecutionState() {
            return {
                accessState: { kill_switch_enabled: true, automation_locked: false },
                profile: {
                    limits_json: JSON.stringify({ hourly_action_limit: 1000, daily_action_limit: 1000, monthly_action_limit: 1000 }),
                    hourly_actions_used: 0,
                    daily_actions_used: 0,
                    monthly_actions_used: 0
                }
            };
        }

        async getWatermarkPolicy() {
            return { enabled: false };
        }

        async getConversationState() {
            return savedState ? { state_json: savedState } : null;
        }

        async upsertConversationState({ stateData }) {
            savedState = stateData;
            return { state_json: stateData };
        }

        async clearConversationState() {
            savedState = null;
            return true;
        }

        async recordCollectedEmail(payload) {
            this.calls.recordCollectedEmail.push(payload);
            return true;
        }

        buildAutomationTemplate(automation) {
            return { type: 'template_text', payload: { text: automation.template_content || '' } };
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload) {
            sentMessages.push({ recipientId, messageType, payload });
            return true;
        }

        async getUserProfile() {
            return { is_user_follow_business: true };
        }
    }

    try {
        delete require.cache[workerPath];
        require.cache[appwritePath] = { id: appwritePath, filename: appwritePath, loaded: true, exports: MockAppwriteClient };
        require.cache[instagramPath] = { id: instagramPath, filename: instagramPath, loaded: true, exports: MockInstagramAPI };
        require.cache[matcherPath] = {
            id: matcherPath,
            filename: matcherPath,
            loaded: true,
            exports: { matchDM: () => matchedAutomation }
        };
        require.cache[rendererPath] = {
            id: rendererPath,
            filename: rendererPath,
            loaded: true,
            exports: { render: (template) => template }
        };
        require.cache[watermarkPath] = {
            id: watermarkPath,
            filename: watermarkPath,
            loaded: true,
            exports: {
                planWatermark: ({ payload }) => ({ primaryPayload: payload, secondaryPayload: null }),
                resolveWatermarkPolicy: () => ({ enabled: false })
            }
        };
        require.cache[emailDestinationsPath] = {
            id: emailDestinationsPath,
            filename: emailDestinationsPath,
            loaded: true,
            exports: {
                deliverCollectedEmail: async () => true
            }
        };

        const FreshWorker = require('../src/worker');
        const worker = new FreshWorker();

        const firstResult = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: 'sender-1' },
                    message: { text: 'help' }
                }]
            }]
        });

        const secondResult = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: 'sender-1' },
                    message: { text: 'person@yahoo.com' }
                }]
            }]
        });

        assert.deepEqual(firstResult, { handled: true, automationType: 'dm' });
        assert.deepEqual(secondResult, { handled: true, automationType: 'dm' });
        assert.deepEqual(
            sentMessages.map((message) => message.payload.text),
            ['Share your gmail', 'Please send a valid gmail']
        );
        assert.equal(worker.appwrite.calls.recordCollectedEmail.length, 0);
        assert.equal(savedState.pendingEmail.collectEmailOnlyGmail, true);
    } finally {
        restore();
    }
});

test('processMessage delivers collected emails to verified webhook destinations', async () => {
    const workerPath = require.resolve('../src/worker');
    const appwritePath = require.resolve('../src/appwrite');
    const instagramPath = require.resolve('../src/instagram');
    const matcherPath = require.resolve('../src/matcher');
    const rendererPath = require.resolve('../src/renderer');
    const watermarkPath = require.resolve('../src/watermark');
    const emailDestinationsPath = require.resolve('../src/emailDestinations');

    const originalEntries = new Map([
        [workerPath, require.cache[workerPath]],
        [appwritePath, require.cache[appwritePath]],
        [instagramPath, require.cache[instagramPath]],
        [matcherPath, require.cache[matcherPath]],
        [rendererPath, require.cache[rendererPath]],
        [watermarkPath, require.cache[watermarkPath]],
        [emailDestinationsPath, require.cache[emailDestinationsPath]]
    ]);

    const restore = () => {
        for (const [modulePath, entry] of originalEntries.entries()) {
            if (entry) {
                require.cache[modulePath] = entry;
            } else {
                delete require.cache[modulePath];
            }
        }
    };

    const sentMessages = [];
    const deliveredPayloads = [];
    let savedState = null;
    const matchedAutomation = {
        $id: 'auto-email',
        title: 'Lead Capture',
        template_id: 'tpl-primary',
        account_id: '17841452817679462',
        automation_type: 'dm',
        collect_email_enabled: true,
        collect_email_prompt_message: 'Share your email',
        collect_email_fail_retry_message: 'Please send a valid email',
        collect_email_success_reply_message: 'Saved your email',
        collect_email_only_gmail: false
    };

    class MockAppwriteClient {
        constructor() {
            this.calls = {
                recordCollectedEmail: []
            };
        }

        async getIGAccount() {
            return {
                username: 'demo_account',
                access_token: 'token',
                user_id: 'user-1',
                ig_user_id: '17841452817679462',
                account_id: '17841452817679462',
                effective_access: true,
                access_state: 'active',
                access_reason: null
            };
        }

        async getActiveAutomations() {
            return [matchedAutomation];
        }

        async getActiveConfigAutomation() {
            return null;
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-primary') {
                return { type: 'template_text', payload: { text: 'Primary reply' } };
            }
            return null;
        }

        async getProfile() {
            return null;
        }

        async getExecutionState() {
            return {
                accessState: { kill_switch_enabled: true, automation_locked: false },
                profile: {
                    limits_json: JSON.stringify({ hourly_action_limit: 1000, daily_action_limit: 1000, monthly_action_limit: 1000 }),
                    hourly_actions_used: 0,
                    daily_actions_used: 0,
                    monthly_actions_used: 0
                }
            };
        }

        async getWatermarkPolicy() {
            return { enabled: false };
        }

        async getConversationState() {
            return savedState ? { state_json: savedState } : null;
        }

        async upsertConversationState({ stateData }) {
            savedState = stateData;
            return { state_json: stateData };
        }

        async clearConversationState() {
            savedState = null;
            return true;
        }

        async getEmailCollectorDestination() {
            return {
                destination_type: 'webhook',
                webhook_url: 'https://example.com/webhook',
                verified: true,
                destination_json: { verified: true }
            };
        }

        async recordCollectedEmail(payload) {
            this.calls.recordCollectedEmail.push(payload);
            return true;
        }

        buildAutomationTemplate(automation) {
            return { type: 'template_text', payload: { text: automation.template_content || '' } };
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload) {
            sentMessages.push({ recipientId, messageType, payload });
            return true;
        }

        async getUserProfile() {
            return { is_user_follow_business: true };
        }
    }

    try {
        delete require.cache[workerPath];
        require.cache[appwritePath] = { id: appwritePath, filename: appwritePath, loaded: true, exports: MockAppwriteClient };
        require.cache[instagramPath] = { id: instagramPath, filename: instagramPath, loaded: true, exports: MockInstagramAPI };
        require.cache[matcherPath] = {
            id: matcherPath,
            filename: matcherPath,
            loaded: true,
            exports: { matchDM: () => matchedAutomation }
        };
        require.cache[rendererPath] = {
            id: rendererPath,
            filename: rendererPath,
            loaded: true,
            exports: { render: (template) => template }
        };
        require.cache[watermarkPath] = {
            id: watermarkPath,
            filename: watermarkPath,
            loaded: true,
            exports: {
                planWatermark: ({ payload }) => ({ primaryPayload: payload, secondaryPayload: null }),
                resolveWatermarkPolicy: () => ({ enabled: false })
            }
        };
        require.cache[emailDestinationsPath] = {
            id: emailDestinationsPath,
            filename: emailDestinationsPath,
            loaded: true,
            exports: {
                deliverCollectedEmail: async (destination, payload) => {
                    deliveredPayloads.push({ destination, payload });
                    return true;
                }
            }
        };

        const FreshWorker = require('../src/worker');
        const worker = new FreshWorker();

        await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: 'sender-1' },
                    message: { text: 'help' }
                }]
            }]
        });

        const result = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: 'sender-1' },
                    message: { text: 'person@example.com' }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'dm' });
        assert.equal(deliveredPayloads.length, 1);
        assert.equal(deliveredPayloads[0].destination.webhook_url, 'https://example.com/webhook');
        assert.equal(deliveredPayloads[0].payload.normalized_email, 'person@example.com');
        assert.deepEqual(
            sentMessages.map((message) => message.payload.text),
            ['Share your email', 'Saved your email', 'Primary reply']
        );
    } finally {
        restore();
    }
});

test('appwrite automation reads normalize legacy special meta toggles', async () => {
    const client = new AppwriteClient();
    client.databases = {
        async listDocuments() {
            return {
                documents: [
                    {
                        $id: 'auto-legacy',
                        automation_type: 'inbox_menu',
                        comment_reply: '__special_meta__:{"menu_item_type":"auto_reply","once_per_user_24h":true,"collect_email_enabled":true,"collect_email_only_gmail":true,"seen_typing_enabled":true}'
                    }
                ]
            };
        }
    };

    const [automation] = await client.getActiveAutomations(['acct-1'], ['inbox_menu']);
    assert.equal(automation.menu_item_type, 'auto_reply');
    assert.equal(automation.once_per_user_24h, true);
    assert.equal(automation.collect_email_enabled, true);
    assert.equal(automation.collect_email_only_gmail, true);
    assert.equal(automation.seen_typing_enabled, true);
    assert.equal(automation.comment_reply, '');
});

test('appwrite active automation lookup falls back to legacy records without is_active', async () => {
    const client = new AppwriteClient();
    let callCount = 0;
    client.databases = {
        async listDocuments() {
            callCount += 1;
            if (callCount === 1) {
                return { documents: [] };
            }
            return {
                documents: [
                    {
                        $id: 'auto-legacy-dm',
                        account_id: 'acct-1',
                        automation_type: 'dm',
                        title: 'Legacy DM'
                    }
                ]
            };
        }
    };

    const automations = await client.getActiveAutomations(['acct-1'], ['dm']);
    assert.equal(callCount, 2);
    assert.equal(automations.length, 1);
    assert.equal(automations[0].$id, 'auto-legacy-dm');
});

test('appwrite config automation lookup falls back to legacy records without is_active', async () => {
    const client = new AppwriteClient();
    let callCount = 0;
    client.databases = {
        async listDocuments() {
            callCount += 1;
            if (callCount === 1) {
                return { documents: [] };
            }
            return {
                documents: [
                    {
                        $id: 'auto-welcome-legacy',
                        account_id: 'acct-1',
                        automation_type: 'welcome_message',
                        title: 'Welcome Message'
                    }
                ]
            };
        }
    };

    const automation = await client.getActiveConfigAutomation(['acct-1'], 'welcome_message');
    assert.equal(callCount, 2);
    assert.equal(automation.$id, 'auto-welcome-legacy');
});

test('instagram client bootstraps a missing meta api tracker', async () => {
    const worker = Object.create(DMWorker.prototype);
    worker._trackMetaApiAction = DMWorker.prototype._trackMetaApiAction;
    worker._initializeMetaApiBudget = DMWorker.prototype._initializeMetaApiBudget;
    worker._canConsumeMetaApiAction = DMWorker.prototype._canConsumeMetaApiAction;
    worker._ensureMetaApiUsageTracker = DMWorker.prototype._ensureMetaApiUsageTracker;

    const profile = {
        limits_json: JSON.stringify({
            hourly_action_limit: 100,
            daily_action_limit: 100,
            monthly_action_limit: 100
        }),
        hourly_actions_used: 0,
        daily_actions_used: 0,
        monthly_actions_used: 0
    };

    const instagram = DMWorker.prototype._createInstagramClient.call(
        worker,
        'token',
        'user-1',
        null,
        profile
    );

    const decision = await instagram.onBeforeRequest({ method: 'GET', path: '/test' });
    assert.deepEqual(decision, { allowed: true, code: null, reason: null });
});

test('share post templates resolve latest media id before sending', async () => {
    const worker = Object.create(DMWorker.prototype);
    worker._resolveSharePostPayload = DMWorker.prototype._resolveSharePostPayload;
    worker._isReelMedia = DMWorker.prototype._isReelMedia;

    const instagram = {
        async getRecentMedia() {
            return [
                { id: 'media-post-1', media_type: 'IMAGE', permalink: 'https://instagram.com/p/1' }
            ];
        },
        async sendMessage(recipientId, messageType, payload) {
            assert.equal(recipientId, 'sender-1');
            assert.equal(messageType, 'template_share_post');
            assert.equal(payload.media_id, 'media-post-1');
            return true;
        }
    };

    const success = await DMWorker.prototype.sendRenderedTemplate.call(
        worker,
        instagram,
        'sender-1',
        {
            type: 'template_share_post',
            payload: {
                media_id: '',
                use_latest_post: true,
                latest_post_type: 'post',
                permalink: 'https://instagram.com/p/fallback'
            }
        },
        {},
        { enabled: false }
    );

    assert.equal(success, true);
});

test('share post templates fall back to text when no media id can be resolved', async () => {
    const worker = Object.create(DMWorker.prototype);
    worker._resolveSharePostPayload = DMWorker.prototype._resolveSharePostPayload;
    worker._isReelMedia = DMWorker.prototype._isReelMedia;

    const instagram = {
        async getRecentMedia() {
            return [];
        },
        async sendMessage(recipientId, messageType, payload) {
            assert.equal(recipientId, 'sender-1');
            assert.equal(messageType, 'template_text');
            assert.match(payload.text, /https:\/\/instagram\.com\/p\/fallback/);
            return true;
        }
    };

    const success = await DMWorker.prototype.sendRenderedTemplate.call(
        worker,
        instagram,
        'sender-1',
        {
            type: 'template_share_post',
            payload: {
                media_id: '',
                use_latest_post: true,
                latest_post_type: 'post',
                caption: 'Latest post',
                permalink: 'https://instagram.com/p/fallback'
            }
        },
        {},
        { enabled: false }
    );

    assert.equal(success, true);
});

test('chat state reads and writes support legacy schema without conversation_key', async () => {
    const client = new AppwriteClient();
    const calls = {
        listDocuments: [],
        createDocument: []
    };

    client.databases = {
        async listAttributes() {
            return {
                attributes: [
                    { key: 'account_id', required: true },
                    { key: 'sender_id', required: false },
                    { key: 'recipient_id', required: false },
                    { key: 'state_json', required: false },
                    { key: 'last_seen_at', required: true }
                ]
            };
        },
        async listDocuments(databaseId, collectionId, queries) {
            calls.listDocuments.push({ databaseId, collectionId, queries });
            return {
                documents: [
                    {
                        $id: 'state-1',
                        account_id: 'acct-1',
                        sender_id: 'sender-1',
                        recipient_id: 'recipient-1',
                        state_json: JSON.stringify({ pendingEmail: null, automationCooldowns: {} })
                    }
                ]
            };
        },
        async createDocument(databaseId, collectionId, documentId, payload) {
            calls.createDocument.push({ databaseId, collectionId, documentId, payload });
            return {
                $id: 'state-2',
                ...payload
            };
        }
    };

    const state = await client.getConversationState('acct-1', 'recipient-1:sender-1');
    assert.deepEqual(state.state_json, { pendingEmail: null, automationCooldowns: {} });

    await client.upsertConversationState({
        userId: 'user-1',
        accountId: 'acct-1',
        conversationKey: 'recipient-1:sender-1',
        senderId: 'sender-1',
        recipientId: 'recipient-1',
        stateData: { pendingEmail: null, automationCooldowns: {} }
    });

    assert.equal(calls.listDocuments.length >= 1, true);
    const queryText = calls.listDocuments[0].queries.map(String).join(' ');
    assert.equal(queryText.includes('conversation_key'), false);
    assert.equal(calls.createDocument.length, 0);
});

test('worker resolves template id from legacy template_content references', async () => {
    const worker = Object.create(DMWorker.prototype);
    worker.appwrite = {
        async getTemplate(templateId) {
            if (templateId === 'legacy-template-id') {
                return { type: 'template_text', payload: { text: 'Welcome reply' } };
            }
            return null;
        },
        buildAutomationTemplate() {
            throw new Error('inline fallback should not be used');
        }
    };

    const template = await worker._resolveAutomationTemplate({
        automation_type: 'welcome_message',
        template_id: '',
        template_type: 'template_share_post',
        template_content: 'legacy-template-id'
    }, 'acct-1');

    assert.deepEqual(template, { type: 'template_text', payload: { text: 'Welcome reply' } });
});

test('comment events honor all-comments global automations alongside specific matches', async () => {
    const workerPath = require.resolve('../src/worker');
    const appwritePath = require.resolve('../src/appwrite');
    const instagramPath = require.resolve('../src/instagram');
    const rendererPath = require.resolve('../src/renderer');
    const watermarkPath = require.resolve('../src/watermark');

    const originalEntries = new Map([
        [workerPath, require.cache[workerPath]],
        [appwritePath, require.cache[appwritePath]],
        [instagramPath, require.cache[instagramPath]],
        [rendererPath, require.cache[rendererPath]],
        [watermarkPath, require.cache[watermarkPath]]
    ]);

    const restore = () => {
        for (const [modulePath, entry] of originalEntries.entries()) {
            if (entry) {
                require.cache[modulePath] = entry;
            } else {
                delete require.cache[modulePath];
            }
        }
    };

    const sentMessages = [];
    const specificAutomation = {
        $id: 'auto-post-keyword',
        title: 'Post keyword',
        template_id: 'tpl-post',
        account_id: '17841452817679462',
        automation_type: 'post',
        trigger_type: 'keywords',
        media_id: 'media-1',
        trigger_keyword: ['price']
    };
    const globalAutomation = {
        $id: 'auto-global-all',
        title: 'Global all comments',
        template_id: 'tpl-global',
        account_id: '17841452817679462',
        automation_type: 'global',
        trigger_type: 'all_comments'
    };

    class MockAppwriteClient {
        async getIGAccount() {
            return {
                username: 'demo_account',
                access_token: 'token',
                user_id: 'user-1',
                ig_user_id: '17841452817679462',
                account_id: '17841452817679462',
                effective_access: true,
                access_state: 'active',
                access_reason: null
            };
        }

        async getActiveAutomations() {
            return [specificAutomation, globalAutomation];
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-post') {
                return { type: 'template_text', payload: { text: 'Post reply' } };
            }
            if (templateId === 'tpl-global') {
                return { type: 'template_text', payload: { text: 'Global reply' } };
            }
            return null;
        }

        async getProfile() {
            return null;
        }

        async getExecutionState() {
            return {
                accessState: { kill_switch_enabled: true, automation_locked: false },
                profile: {
                    limits_json: JSON.stringify({ hourly_action_limit: 1000, daily_action_limit: 1000, monthly_action_limit: 1000 }),
                    hourly_actions_used: 0,
                    daily_actions_used: 0,
                    monthly_actions_used: 0
                }
            };
        }

        async getWatermarkPolicy() {
            return { enabled: false };
        }

        async getConversationState() {
            return null;
        }

        async upsertConversationState() {
            return null;
        }

        async clearConversationState() {
            return true;
        }

        async getActiveConfigAutomation() {
            return null;
        }

        async getEmailCollectorDestination() {
            return null;
        }

        buildAutomationTemplate(automation) {
            return { type: 'template_text', payload: { text: automation.title } };
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload) {
            sentMessages.push({ recipientId, messageType, payload });
            return true;
        }

        async replyToComment() {
            return true;
        }

        async getUserProfile() {
            return { is_user_follow_business: true };
        }

        async markSeen() {
            return true;
        }

        async setTyping() {
            return true;
        }
    }

    try {
        delete require.cache[workerPath];
        require.cache[appwritePath] = { id: appwritePath, filename: appwritePath, loaded: true, exports: MockAppwriteClient };
        require.cache[instagramPath] = { id: instagramPath, filename: instagramPath, loaded: true, exports: MockInstagramAPI };
        require.cache[rendererPath] = {
            id: rendererPath,
            filename: rendererPath,
            loaded: true,
            exports: { render: (template) => template }
        };
        require.cache[watermarkPath] = {
            id: watermarkPath,
            filename: watermarkPath,
            loaded: true,
            exports: {
                planWatermark: ({ payload }) => ({ primaryPayload: payload, secondaryPayload: null }),
                resolveWatermarkPolicy: () => ({ enabled: false })
            }
        };

        const FreshWorker = require('../src/worker');
        const worker = new FreshWorker();
        const result = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                changes: [{
                    field: 'comments',
                    value: {
                        id: 'comment-1',
                        media: { id: 'media-1' },
                        from: { id: 'sender-1' },
                        text: 'price'
                    }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'global' });
        assert.deepEqual(
            sentMessages.map((message) => message.payload.text),
            ['Post reply', 'Global reply']
        );
    } finally {
        restore();
    }
});

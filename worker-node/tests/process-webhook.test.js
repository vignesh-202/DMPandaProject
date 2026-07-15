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

test('processMessage ignores DMs sent from another managed Instagram account to avoid automation loops', async () => {
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

    let sendCount = 0;
    let automationLookupCount = 0;

    class MockAppwriteClient {
        async getIGAccount(accountId) {
            if (accountId === 'recipient-account') {
                return {
                    $id: 'doc-recipient',
                    username: 'recipient_account',
                    access_token: 'token',
                    user_id: 'user-recipient',
                    ig_user_id: 'recipient-account',
                    account_id: 'recipient-account',
                    effective_access: true,
                    access_state: 'active',
                    access_reason: null
                };
            }

            if (accountId === 'sender-managed-account') {
                return {
                    $id: 'doc-sender',
                    username: 'sender_account',
                    access_token: 'sender-token',
                    user_id: 'user-sender',
                    ig_user_id: 'sender-managed-account',
                    account_id: 'sender-managed-account',
                    effective_access: true,
                    access_state: 'active',
                    access_reason: null
                };
            }

            return null;
        }

        async isManagedInstagramAccount(accountId) {
            return accountId === 'sender-managed-account';
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

        async getActiveAutomations() {
            automationLookupCount += 1;
            return [];
        }

        async getActiveConfigAutomation() {
            automationLookupCount += 1;
            return null;
        }

        async getProfile() {
            return null;
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

        async recordActionUsage() {
            return true;
        }
    }

    class MockInstagramAPI {
        async sendMessage() {
            sendCount += 1;
            return true;
        }

        async markSeen() {}
        async setTyping() {}
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
            exports: { matchDM: () => ({ $id: 'auto-loop', template_id: 'tpl-loop', automation_type: 'dm' }) }
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
                id: 'recipient-account',
                messaging: [{
                    sender: { id: 'sender-managed-account' },
                    recipient: { id: 'recipient-account' },
                    message: { text: 'hello from another managed account' }
                }]
            }]
        });

        assert.equal(result, false);
        assert.equal(sendCount, 0);
        assert.equal(automationLookupCount, 0);
    } finally {
        restore();
    }
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

test('processMessage ignores legacy collect-email flags on convo starters', async () => {
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
    const convoStarterAutomation = {
        $id: 'auto-convo-legacy-email',
        title: 'Legacy Starter',
        title_normalized: 'legacy starter',
        template_id: 'tpl-convo-legacy',
        template_content: 'tpl-convo-legacy',
        account_id: '17841452817679462',
        is_active: true,
        automation_type: 'convo_starter',
        trigger_type: 'ice_breakers',
        collect_email_enabled: true,
        collect_email_prompt_message: 'Share your email'
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
            return [convoStarterAutomation];
        }

        async getActiveConfigAutomation() {
            return null;
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-convo-legacy') {
                return { type: 'template_text', payload: { text: 'Legacy convo reply' } };
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
        async upsertConversationState() {
            throw new Error('Convo starters should not enter pending email collection.');
        }
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
        delete require.cache[rendererPath];
        delete require.cache[watermarkPath];
        delete require.cache[workerPath];

        require.cache[appwritePath] = { exports: MockAppwriteClient };
        require.cache[instagramPath] = { exports: MockInstagramAPI };
        require.cache[rendererPath] = {
            exports: {
                render() {
                    return { type: 'template_text', payload: { text: 'Legacy convo reply' } };
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
                    message: { text: 'legacy starter' }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'convo_starter' });
        assert.equal(sentMessages.length, 1);
        assert.equal(sentMessages[0].payload.text, 'Legacy convo reply');
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

test('appwrite convo starter fallback disables repeated legacy collection lookups when the collection is unavailable', async () => {
    const client = new AppwriteClient();
    let listCalls = 0;
    const originalWarn = console.warn;
    const warnings = [];

    console.warn = (...args) => {
        warnings.push(args.map((item) => String(item)).join(' '));
    };

    client.databases = {
        async listDocuments(_databaseId, collectionId) {
            listCalls += 1;
            if (collectionId === process.env.AUTOMATIONS_COLLECTION_ID) {
                return { documents: [] };
            }
            const error = new Error(`Collection with the requested ID '${collectionId}' could not be found.`);
            error.code = 404;
            throw error;
        }
    };

    try {
        const first = await client.getActiveAutomations(['acct-1'], ['convo_starter']);
        const second = await client.getActiveAutomations(['acct-1'], ['convo_starter']);

        assert.deepEqual(first, []);
        assert.deepEqual(second, []);
        assert.equal(client._convoStarterFallbackUnavailable, true);
        assert.equal(listCalls, 7);
        assert.equal(
            warnings.filter((message) => message.includes('legacy fallback lookups are disabled')).length,
            1
        );
    } finally {
        console.warn = originalWarn;
    }
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

test('processMessage handles quick reply clicks by fetching and sending the template directly if the payload is a valid template ID', async () => {
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
    const templateId = '699a9d980030b6ff8be9';

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

        async getTemplate(id, accountId) {
            assert.equal(id, templateId);
            assert.equal(accountId, '17841452817679462');
            return { type: 'template_text', payload: { text: 'Direct reply from quick reply template!' } };
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
                    sender: { id: 'sender-1' },
                    recipient: { id: '17841452817679462' },
                    message: {
                        text: 'Click here',
                        quick_reply: {
                            payload: templateId
                        }
                    }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'quick_reply_template' });
        assert.equal(sentMessages.length, 1);
        assert.deepEqual(sentMessages[0], {
            recipientId: 'sender-1',
            messageType: 'template_text',
            payload: { text: 'Direct reply from quick reply template!' }
        });
    } finally {
        restore();
    }
});

test('processWebhook handles quick reply clicks end-to-end and increments action usage in Appwrite', async () => {
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
    const templateId = '699a9d980030b6ff8be9';
    let incrementActionUsageArgs = null;

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

        async getTemplate(id, accountId) {
            assert.equal(id, templateId);
            assert.equal(accountId, '17841452817679462');
            return { type: 'template_text', payload: { text: 'Direct reply from quick reply template!' } };
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

        async incrementActionUsage(userId, incrementBy) {
            incrementActionUsageArgs = { userId, incrementBy };
            return { $id: 'account-1' };
        }
    }

    class MockInstagramAPI {
        constructor(accessToken, options = {}) {
            this.accessToken = accessToken;
            this.onBeforeRequest = options.onBeforeRequest;
            this.onRequestComplete = options.onRequestComplete;
        }

        async sendMessage(recipientId, messageType, payload) {
            sentMessages.push({ recipientId, messageType, payload });
            if (this.onBeforeRequest) await this.onBeforeRequest();
            if (this.onRequestComplete) await this.onRequestComplete();
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
        const result = await worker.processWebhook({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: 'sender-1' },
                    recipient: { id: '17841452817679462' },
                    message: {
                        text: 'Click here',
                        quick_reply: {
                            payload: templateId
                        }
                    }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'quick_reply_template' });
        assert.equal(sentMessages.length, 1);
        assert.deepEqual(sentMessages[0], {
            recipientId: 'sender-1',
            messageType: 'template_text',
            payload: { text: 'Direct reply from quick reply template!' }
        });

        assert.ok(incrementActionUsageArgs, 'incrementActionUsage was not called');
        assert.equal(incrementActionUsageArgs.userId, '17841452817679462');
        assert.equal(incrementActionUsageArgs.incrementBy, 1);
    } finally {
        restore();
    }
});

test('processMessage sends quick reply payload as text reply when no automation matches', async () => {
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
                access_reason: null,
                hourly_actions_used: 0,
                daily_actions_used: 0,
                monthly_actions_used: 0
            };
        }

        async getActiveAutomations() {
            return [];
        }

        async getActiveConfigAutomation() {
            return null;
        }

        async getExecutionState() {
            return {
                accessState: { kill_switch_enabled: true, automation_locked: false },
                profile: {
                    limits_json: JSON.stringify({ hourly_action_limit: 1000, daily_action_limit: 1000, monthly_action_limit: 1000 })
                }
            };
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
                    sender: { id: 'sender-1' },
                    recipient: { id: '17841452817679462' },
                    message: {
                        text: 'gfg',
                        quick_reply: {
                            payload: 'You selected: gfg'
                        }
                    }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'quick_reply_payload_reply' });
        assert.equal(sentMessages.length, 1);
        assert.deepEqual(sentMessages[0], {
            recipientId: 'sender-1',
            messageType: 'template_text',
            payload: { text: 'You selected: gfg' }
        });
    } finally {
        restore();
    }
});

test('comment events send private reply by passing commentId in options', async () => {
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
    const commentAutomation = {
        $id: 'auto-comment-reply',
        title: 'Comment Automation',
        template_id: 'tpl-comment',
        account_id: '17841452817679462',
        automation_type: 'post',
        trigger_type: 'keywords',
        media_id: 'media-1',
        trigger_keyword: ['promo']
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
            return [commentAutomation];
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-comment') {
                return { type: 'template_text', payload: { text: 'Promo code: HELLO' } };
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

        buildAutomationTemplate(automation) {
            return { type: 'template_text', payload: { text: automation.title } };
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload, options) {
            sentMessages.push({ recipientId, messageType, payload, options });
            return true;
        }

        async replyToComment() {
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
                        id: 'comment-123',
                        media: { id: 'media-1' },
                        from: { id: 'sender-1' },
                        text: 'promo'
                    }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'post' });
        assert.equal(sentMessages.length, 1);
        assert.deepEqual(sentMessages[0], {
            recipientId: 'sender-1',
            messageType: 'template_text',
            payload: { text: 'Promo code: HELLO' },
            options: { commentId: 'comment-123' }
        });
    } finally {
        restore();
    }
});

test('comment events fall back to public reply when private reply fails', async () => {
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

    const publicReplies = [];
    const commentAutomation = {
        $id: 'auto-comment-reply-fallback',
        title: 'Comment Automation Fallback',
        template_id: 'tpl-comment-fallback',
        account_id: '17841452817679462',
        automation_type: 'post',
        trigger_type: 'keywords',
        media_id: 'media-2',
        trigger_keyword: ['fallback_keyword']
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
            return [commentAutomation];
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-comment-fallback') {
                return { type: 'template_text', payload: { text: 'Public Fallback Content' } };
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

        buildAutomationTemplate(automation) {
            return { type: 'template_text', payload: { text: automation.title } };
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload, options) {
            // Simulate failure (e.g. outside allowed window error)
            return false;
        }

        async replyToComment(commentId, message) {
            publicReplies.push({ commentId, message });
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
                        id: 'comment-fallback-123',
                        media: { id: 'media-2' },
                        from: { id: 'sender-1' },
                        text: 'fallback_keyword'
                    }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'post' });
        assert.equal(publicReplies.length, 1);
        assert.deepEqual(publicReplies[0], {
            commentId: 'comment-fallback-123',
            message: 'Public Fallback Content'
        });
    } finally {
        restore();
    }
});

test('global trigger comments: send comment reply first, then DM, and consume action budget correctly', async () => {
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

    const callOrder = [];
    const incrementedCounts = new Map();
    const globalAutomation = {
        $id: 'auto-global-keyword',
        title: 'Global Keyword',
        template_id: 'tpl-global-dm',
        account_id: '17841452817679462',
        automation_type: 'global',
        trigger_type: 'keywords',
        trigger_keyword: ['global_key'],
        comment_reply: '',
        comment_reply_text: 'Thanks! Check DMs.'
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
            return [globalAutomation];
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-global-dm') {
                return { type: 'template_text', payload: { text: 'DM Content' } };
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

        async incrementActionUsage(userId, count) {
            incrementedCounts.set(userId, (incrementedCounts.get(userId) || 0) + count);
        }

        buildAutomationTemplate(automation) {
            return { type: 'template_text', payload: { text: automation.title } };
        }
    }

    class MockInstagramAPI {
        constructor(accessToken, options = {}) {
            this.accessToken = accessToken;
            this.onBeforeRequest = options.onBeforeRequest;
            this.onRequestComplete = options.onRequestComplete;
        }

        async replyToComment(commentId, message) {
            if (this.onBeforeRequest) await this.onBeforeRequest();
            callOrder.push({ type: 'public_reply', commentId, message });
            if (this.onRequestComplete) await this.onRequestComplete();
            return true;
        }

        async sendMessage(recipientId, messageType, payload, options) {
            if (this.onBeforeRequest) await this.onBeforeRequest();
            callOrder.push({ type: 'private_dm', recipientId, messageType, payload, options });
            if (this.onRequestComplete) await this.onRequestComplete();
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
        const result = await worker.processWebhook({
            entry: [{
                id: '17841452817679462',
                changes: [{
                    field: 'comments',
                    value: {
                        id: 'comment-global-123',
                        media: { id: 'media-reel-1' },
                        from: { id: 'sender-1' },
                        text: 'global_key'
                    }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'global' });
        
        // Assert execution order: public reply first, then private DM
        assert.equal(callOrder.length, 2);
        assert.deepEqual(callOrder[0], {
            type: 'public_reply',
            commentId: 'comment-global-123',
            message: 'Thanks! Check DMs.'
        });
        assert.deepEqual(callOrder[1], {
            type: 'private_dm',
            recipientId: 'sender-1',
            messageType: 'template_text',
            payload: { text: 'DM Content' },
            options: { commentId: 'comment-global-123' }
        });

        // Assert action budget consumption: 2 actions consumed (1 for public comment reply, 1 for private DM)
        assert.equal(incrementedCounts.get('17841452817679462'), 2);

    } finally {
        restore();
    }
});

test('comment moderation hides matching comments before automation replies run', async () => {
    const workerPath = require.resolve('../src/worker');
    const appwritePath = require.resolve('../src/appwrite');
    const instagramPath = require.resolve('../src/instagram');

    const originalEntries = new Map([
        [workerPath, require.cache[workerPath]],
        [appwritePath, require.cache[appwritePath]],
        [instagramPath, require.cache[instagramPath]]
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

    const calls = [];

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

        async getCommentModerationRules() {
            return [{ action: 'hide', keywords: ['spam'] }];
        }

        async getConversationState() {
            return null;
        }

        async getActiveAutomations() {
            calls.push({ type: 'get_automations' });
            return [];
        }

        async getActiveConfigAutomation() {
            return null;
        }

        async getWatermarkPolicy() {
            return { enabled: false };
        }

        async getProfile() {
            return null;
        }
    }

    class MockInstagramAPI {
        async hideComment(commentId, hidden) {
            calls.push({ type: 'hide_comment', commentId, hidden });
            return true;
        }

        async getComment(commentId) {
            calls.push({ type: 'get_comment', commentId });
            return { id: commentId, hidden: true };
        }

        async deleteComment(commentId) {
            calls.push({ type: 'delete_comment', commentId });
            return true;
        }
    }

    try {
        delete require.cache[workerPath];
        require.cache[appwritePath] = { id: appwritePath, filename: appwritePath, loaded: true, exports: MockAppwriteClient };
        require.cache[instagramPath] = { id: instagramPath, filename: instagramPath, loaded: true, exports: MockInstagramAPI };

        const FreshWorker = require('../src/worker');
        const worker = new FreshWorker();
        const result = await worker.processWebhook({
            entry: [{
                id: '17841452817679462',
                changes: [{
                    field: 'comments',
                    value: {
                        id: 'comment-moderation-hide-1',
                        media: { id: 'media-1' },
                        from: { id: 'sender-1' },
                        text: 'this is spam content'
                    }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'moderation_hide' });
        assert.deepEqual(calls, [
            {
                type: 'hide_comment',
                commentId: 'comment-moderation-hide-1',
                hidden: true
            },
            {
                type: 'get_comment',
                commentId: 'comment-moderation-hide-1'
            }
        ]);
    } finally {
        restore();
    }
});

test('comment moderation deletes matching comments before automation replies run', async () => {
    const workerPath = require.resolve('../src/worker');
    const appwritePath = require.resolve('../src/appwrite');
    const instagramPath = require.resolve('../src/instagram');

    const originalEntries = new Map([
        [workerPath, require.cache[workerPath]],
        [appwritePath, require.cache[appwritePath]],
        [instagramPath, require.cache[instagramPath]]
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

    const calls = [];

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

        async getCommentModerationRules() {
            return [{ action: 'delete', keywords: ['banword'] }];
        }

        async getConversationState() {
            return null;
        }

        async getActiveAutomations() {
            calls.push({ type: 'get_automations' });
            return [];
        }

        async getActiveConfigAutomation() {
            return null;
        }

        async getWatermarkPolicy() {
            return { enabled: false };
        }

        async getProfile() {
            return null;
        }
    }

    class MockInstagramAPI {
        async hideComment(commentId, hidden) {
            calls.push({ type: 'hide_comment', commentId, hidden });
            return true;
        }

        async deleteComment(commentId) {
            calls.push({ type: 'delete_comment', commentId });
            return true;
        }
    }

    try {
        delete require.cache[workerPath];
        require.cache[appwritePath] = { id: appwritePath, filename: appwritePath, loaded: true, exports: MockAppwriteClient };
        require.cache[instagramPath] = { id: instagramPath, filename: instagramPath, loaded: true, exports: MockInstagramAPI };

        const FreshWorker = require('../src/worker');
        const worker = new FreshWorker();
        const result = await worker.processWebhook({
            entry: [{
                id: '17841452817679462',
                changes: [{
                    field: 'comments',
                    value: {
                        id: 'comment-moderation-delete-1',
                        media: { id: 'media-1' },
                        from: { id: 'sender-1' },
                        text: 'contains banword inside'
                    }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'moderation_delete' });
        assert.deepEqual(calls, [{
            type: 'delete_comment',
            commentId: 'comment-moderation-delete-1'
        }]);
    } finally {
        restore();
    }
});

test('comment moderation uses whole-keyword matching so overlapping hide/delete rules do not conflict', async () => {
    const workerPath = require.resolve('../src/worker');
    const appwritePath = require.resolve('../src/appwrite');
    const instagramPath = require.resolve('../src/instagram');

    const originalEntries = new Map([
        [workerPath, require.cache[workerPath]],
        [appwritePath, require.cache[appwritePath]],
        [instagramPath, require.cache[instagramPath]]
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

    const calls = [];

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

        async getCommentModerationRules() {
            return [
                { action: 'hide', keywords: ['ladu'] },
                { action: 'delete', keywords: ['lad'] }
            ];
        }

        async getConversationState() {
            return null;
        }

        async getActiveAutomations() {
            return [];
        }

        async getActiveConfigAutomation() {
            return null;
        }

        async getWatermarkPolicy() {
            return { enabled: false };
        }

        async getProfile() {
            return null;
        }
    }

    class MockInstagramAPI {
        async hideComment(commentId, hidden) {
            calls.push({ type: 'hide_comment', commentId, hidden });
            return true;
        }

        async getComment(commentId) {
            calls.push({ type: 'get_comment', commentId });
            return { id: commentId, hidden: true };
        }

        async deleteComment(commentId) {
            calls.push({ type: 'delete_comment', commentId });
            return true;
        }
    }

    try {
        delete require.cache[workerPath];
        require.cache[appwritePath] = { id: appwritePath, filename: appwritePath, loaded: true, exports: MockAppwriteClient };
        require.cache[instagramPath] = { id: instagramPath, filename: instagramPath, loaded: true, exports: MockInstagramAPI };

        const FreshWorker = require('../src/worker');
        const worker = new FreshWorker();
        const result = await worker.processWebhook({
            entry: [{
                id: '17841452817679462',
                changes: [{
                    field: 'comments',
                    value: {
                        id: 'comment-overlap-1',
                        media: { id: 'media-1' },
                        from: { id: 'sender-1' },
                        text: 'ladu'
                    }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'moderation_hide' });
        assert.deepEqual(calls, [
            { type: 'hide_comment', commentId: 'comment-overlap-1', hidden: true },
            { type: 'get_comment', commentId: 'comment-overlap-1' }
        ]);
    } finally {
        restore();
    }
});

test('mediaShareSent: prevents duplicate dispatches in DM, comments, and email collection workflows', async () => {
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

    let sentMessages = [];
    let savedState = null;

    const matchedAutomation = {
        $id: 'auto-share-1',
        title: 'Share Admin Post',
        template_id: 'tpl-share-1',
        account_id: '17841452817679462',
        automation_type: 'dm',
        trigger_type: 'keywords',
        trigger_keyword: ['share'],
        template_type: 'template_share_post',
        share_to_admin_enabled: true
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
            return [matchedAutomation];
        }

        async getActiveConfigAutomation() {
            return null;
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-share-1') {
                return { type: 'template_share_post', payload: { media_id: 'media-123' } };
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

        buildAutomationTemplate(automation) {
            return { type: 'template_share_post', payload: { media_id: 'media-123' } };
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

        // 1. Initial run: mediaShareSent is false. It should send the template.
        let result = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: 'sender-1' },
                    message: { text: 'share' }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'dm' });
        assert.equal(sentMessages.length, 1);
        assert.equal(savedState.mediaShareSent, true);

        // Reset sent messages
        sentMessages = [];

        // 2. Second run: mediaShareSent is true in savedState. It should skip sending the template.
        result = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: 'sender-1' },
                    message: { text: 'share' }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'dm' });
        assert.equal(sentMessages.length, 0); // No message sent!
    } finally {
        restore();
    }
});

test('share_to_admin: matches and dispatches when a post/reel is shared to the admin (even if self-authored)', async () => {
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

    let sentMessages = [];
    const sharedMediaId = 'media-share-123';

    const matchedAutomation = {
        $id: 'auto-share-to-admin-1',
        title: 'Share To Admin Auto',
        template_id: 'tpl-share-to-admin-1',
        account_id: '17841452817679462',
        automation_type: 'dm',
        trigger_type: 'share_to_admin',
        is_active: true,
        media_id: sharedMediaId,
        share_to_admin_enabled: true
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
            return [matchedAutomation];
        }

        async getActiveConfigAutomation() {
            return null;
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-share-to-admin-1') {
                return { type: 'template_share_post', payload: { media_id: sharedMediaId } };
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
            return true;
        }

        async recordActionUsage() {
            return true;
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload) {
            sentMessages.push({ recipientId, messageType, payload });
            return true;
        }
        async markSeen() {}
        async setTyping() {}
    }

    delete require.cache[workerPath];
    delete require.cache[appwritePath];
    delete require.cache[instagramPath];
    delete require.cache[matcherPath];
    delete require.cache[rendererPath];
    delete require.cache[watermarkPath];

    require.cache[appwritePath] = {
        id: appwritePath,
        filename: appwritePath,
        loaded: true,
        exports: MockAppwriteClient
    };
    require.cache[instagramPath] = {
        id: instagramPath,
        filename: instagramPath,
        loaded: true,
        exports: MockInstagramAPI
    };
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

    try {
        const result = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: '17841452817679462' }, // self-authored
                    recipient: { id: '17841452817679462' },
                    message: {
                        mid: 'mid-share-admin-123',
                        attachments: [{
                            type: 'share',
                            payload: {
                                ig_post_media_id: sharedMediaId,
                                url: `https://instagram.com/p/shortcode`
                            }
                        }]
                    }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'dm' });
        assert.equal(sentMessages.length, 1);
        assert.equal(sentMessages[0].messageType, 'template_share_post');
        assert.equal(sentMessages[0].recipientId, '17841452817679462');
        assert.deepEqual(sentMessages[0].payload, { media_id: sharedMediaId });
    } finally {
        restore();
    }
});

test('share_to_admin: matches and dispatches when a post/reel is shared to the admin using message.share payload', async () => {
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

    let sentMessages = [];
    const sharedMediaId = 'media-share-567';

    const matchedAutomation = {
        $id: 'auto-share-to-admin-2',
        title: 'Share To Admin Auto 2',
        template_id: 'tpl-share-to-admin-2',
        account_id: '17841452817679462',
        automation_type: 'dm',
        trigger_type: 'share_to_admin',
        is_active: true,
        media_id: sharedMediaId,
        share_to_admin_enabled: true
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
            return [matchedAutomation];
        }

        async getActiveConfigAutomation() {
            return null;
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-share-to-admin-2') {
                return { type: 'template_share_post', payload: { media_id: sharedMediaId } };
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
            return true;
        }

        async recordActionUsage() {
            return true;
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload) {
            sentMessages.push({ recipientId, messageType, payload });
            return true;
        }
        async markSeen() {}
        async setTyping() {}
    }

    delete require.cache[workerPath];
    delete require.cache[appwritePath];
    delete require.cache[instagramPath];
    delete require.cache[matcherPath];
    delete require.cache[rendererPath];
    delete require.cache[watermarkPath];

    require.cache[appwritePath] = {
        id: appwritePath,
        filename: appwritePath,
        loaded: true,
        exports: MockAppwriteClient
    };
    require.cache[instagramPath] = {
        id: instagramPath,
        filename: instagramPath,
        loaded: true,
        exports: MockInstagramAPI
    };
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

    try {
        const result = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: '17841452817679462' }, // self-authored
                    recipient: { id: '17841452817679462' },
                    message: {
                        mid: 'mid-share-admin-567',
                        share: {
                            id: sharedMediaId,
                            link: `https://instagram.com/p/shortcode`
                        }
                    }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'dm' });
        assert.equal(sentMessages.length, 1);
        assert.equal(sentMessages[0].messageType, 'template_share_post');
        assert.equal(sentMessages[0].recipientId, '17841452817679462');
        assert.deepEqual(sentMessages[0].payload, { media_id: sharedMediaId });
    } finally {
        restore();
    }
});

test('share_to_admin: matches by permalink when Instagram share webhook omits media id', async () => {
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

    let sentMessages = [];

    const matchedAutomation = {
        $id: 'auto-share-to-admin-url-1',
        title: 'Share To Admin Permalink',
        template_id: 'tpl-share-to-admin-url-1',
        account_id: '17841452817679462',
        automation_type: 'dm',
        trigger_type: 'share_to_admin',
        is_active: true,
        media_id: '1789-not-in-webhook',
        permalink: 'https://www.instagram.com/p/C8SharePostAbc/',
        linked_media_url: 'https://www.instagram.com/p/C8SharePostAbc/',
        share_to_admin_enabled: true
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
            return [matchedAutomation];
        }

        async getActiveConfigAutomation() {
            return null;
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-share-to-admin-url-1') {
                return { type: 'template_text', payload: { text: 'Share reply template sent.' } };
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
            return true;
        }

        async recordActionUsage() {
            return true;
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload) {
            sentMessages.push({ recipientId, messageType, payload });
            return true;
        }
        async markSeen() {}
        async setTyping() {}
    }

    delete require.cache[workerPath];
    delete require.cache[appwritePath];
    delete require.cache[instagramPath];
    delete require.cache[matcherPath];
    delete require.cache[rendererPath];
    delete require.cache[watermarkPath];

    require.cache[appwritePath] = {
        id: appwritePath,
        filename: appwritePath,
        loaded: true,
        exports: MockAppwriteClient
    };
    require.cache[instagramPath] = {
        id: instagramPath,
        filename: instagramPath,
        loaded: true,
        exports: MockInstagramAPI
    };
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

    try {
        const result = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: '893292439759295' },
                    recipient: { id: '17841452817679462' },
                    message: {
                        mid: 'mid-share-admin-permalink-1',
                        attachments: [{
                            type: 'share',
                            payload: {
                                url: 'https://instagram.com/p/C8SharePostAbc/?igsh=tracking'
                            }
                        }]
                    }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'dm' });
        assert.equal(sentMessages.length, 1);
        assert.equal(sentMessages[0].messageType, 'template_text');
        assert.equal(sentMessages[0].recipientId, '893292439759295');
        assert.deepEqual(sentMessages[0].payload, { text: 'Share reply template sent.' });
    } finally {
        restore();
    }
});

test('share_to_admin: falls back to the sole active share automation when webhook only includes opaque CDN url', async () => {
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

    let sentMessages = [];

    const matchedAutomation = {
        $id: 'auto-share-to-admin-cdn-1',
        title: 'Share To Admin CDN Fallback',
        template_id: 'tpl-share-to-admin-cdn-1',
        account_id: '17841452817679462',
        automation_type: 'dm',
        trigger_type: 'share_to_admin',
        is_active: true,
        media_id: 'configured-media-id-not-in-webhook',
        share_to_admin_enabled: true
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
            return [matchedAutomation];
        }

        async getActiveConfigAutomation() {
            return null;
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-share-to-admin-cdn-1') {
                return { type: 'template_text', payload: { text: 'Opaque share URL still triggers reply.' } };
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
            return true;
        }

        async recordActionUsage() {
            return true;
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload) {
            sentMessages.push({ recipientId, messageType, payload });
            return true;
        }
        async markSeen() {}
        async setTyping() {}
    }

    delete require.cache[workerPath];
    delete require.cache[appwritePath];
    delete require.cache[instagramPath];
    delete require.cache[matcherPath];
    delete require.cache[rendererPath];
    delete require.cache[watermarkPath];

    require.cache[appwritePath] = {
        id: appwritePath,
        filename: appwritePath,
        loaded: true,
        exports: MockAppwriteClient
    };
    require.cache[instagramPath] = {
        id: instagramPath,
        filename: instagramPath,
        loaded: true,
        exports: MockInstagramAPI
    };
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

    try {
        const result = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: '893292439759295' },
                    recipient: { id: '17841452817679462' },
                    message: {
                        mid: 'mid-share-admin-cdn-1',
                        attachments: [{
                            type: 'share',
                            payload: {
                                url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=18109567273171822&signature=test'
                            }
                        }]
                    }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'dm' });
        assert.equal(sentMessages.length, 1);
        assert.equal(sentMessages[0].messageType, 'template_text');
        assert.equal(sentMessages[0].recipientId, '893292439759295');
        assert.deepEqual(sentMessages[0].payload, { text: 'Opaque share URL still triggers reply.' });
    } finally {
        restore();
    }
});

test('share_to_admin: loads post and reel automations during share-event processing without affecting normal DM lookups', async () => {
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

    let sentMessages = [];
    const getActiveAutomationsCalls = [];
    const shareAutomation = {
        $id: 'auto-share-post-lookup-1',
        title: 'Post Share Automation',
        template_id: 'tpl-share-post-lookup-1',
        account_id: '17841452817679462',
        automation_type: 'post',
        trigger_type: 'share_to_admin',
        is_active: true,
        share_to_admin_enabled: true
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

        async getActiveAutomations(accountIds, automationTypes = ['dm', 'global', 'convo_starter', 'inbox_menu']) {
            getActiveAutomationsCalls.push({
                accountIds: Array.isArray(accountIds) ? [...accountIds] : accountIds,
                automationTypes: Array.isArray(automationTypes) ? [...automationTypes] : automationTypes
            });

            const normalizedTypes = Array.isArray(automationTypes) ? automationTypes : [automationTypes];
            if (normalizedTypes.includes('post') || normalizedTypes.includes('reel')) {
                return [shareAutomation];
            }
            return [];
        }

        async getActiveConfigAutomation() {
            return null;
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-share-post-lookup-1') {
                return { type: 'template_text', payload: { text: 'Share reply through post lookup.' } };
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
            return true;
        }

        async recordActionUsage() {
            return true;
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload) {
            sentMessages.push({ recipientId, messageType, payload });
            return true;
        }
        async markSeen() {}
        async setTyping() {}
    }

    delete require.cache[workerPath];
    delete require.cache[appwritePath];
    delete require.cache[instagramPath];
    delete require.cache[matcherPath];
    delete require.cache[rendererPath];
    delete require.cache[watermarkPath];

    require.cache[appwritePath] = {
        id: appwritePath,
        filename: appwritePath,
        loaded: true,
        exports: MockAppwriteClient
    };
    require.cache[instagramPath] = {
        id: instagramPath,
        filename: instagramPath,
        loaded: true,
        exports: MockInstagramAPI
    };
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

    try {
        const result = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: '893292439759295' },
                    recipient: { id: '17841452817679462' },
                    message: {
                        mid: 'mid-share-post-lookup-1',
                        attachments: [{
                            type: 'share',
                            payload: {
                                url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=18109567273171822&signature=test'
                            }
                        }]
                    }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'post' });
        assert.equal(sentMessages.length, 1);
        assert.equal(sentMessages[0].messageType, 'template_text');
        assert.deepEqual(sentMessages[0].payload, { text: 'Share reply through post lookup.' });
        assert.deepEqual(getActiveAutomationsCalls, [
            {
                accountIds: ['17841452817679462'],
                automationTypes: ['dm', 'global', 'convo_starter', 'inbox_menu']
            },
            {
                accountIds: ['17841452817679462'],
                automationTypes: ['post', 'reel']
            }
        ]);
    } finally {
        restore();
    }
});

test('share_to_admin: real share webhooks are not blocked by stale mediaShareSent conversation state', async () => {
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

    let sentMessages = [];
    let savedState = { mediaShareSent: true, automationCooldowns: {} };

    const matchedAutomation = {
        $id: 'auto-share-real-event-1',
        title: 'Post 011250',
        template_id: 'tpl-share-real-event-1',
        account_id: '17841452817679462',
        automation_type: 'post',
        trigger_type: 'share_to_admin',
        is_active: true,
        media_id: '18031795967011250',
        share_to_admin_enabled: true
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

        async getActiveAutomations(accountIds, automationTypes = ['dm', 'global', 'convo_starter', 'inbox_menu']) {
            const normalizedTypes = Array.isArray(automationTypes) ? automationTypes : [automationTypes];
            if (normalizedTypes.includes('post') || normalizedTypes.includes('reel')) {
                return [matchedAutomation];
            }
            return [];
        }

        async getActiveConfigAutomation() {
            return null;
        }

        async getTemplate(templateId) {
            if (templateId === 'tpl-share-real-event-1') {
                return { type: 'template_text', payload: { text: 'Real share event should send.' } };
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
            return { state_json: savedState };
        }

        async upsertConversationState({ stateData }) {
            savedState = stateData;
            return { state_json: stateData };
        }

        async clearConversationState() {
            savedState = null;
            return true;
        }

        async recordActionUsage() {
            return true;
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload) {
            sentMessages.push({ recipientId, messageType, payload });
            return true;
        }
        async markSeen() {}
        async setTyping() {}
    }

    delete require.cache[workerPath];
    delete require.cache[appwritePath];
    delete require.cache[instagramPath];
    delete require.cache[matcherPath];
    delete require.cache[rendererPath];
    delete require.cache[watermarkPath];

    require.cache[appwritePath] = {
        id: appwritePath,
        filename: appwritePath,
        loaded: true,
        exports: MockAppwriteClient
    };
    require.cache[instagramPath] = {
        id: instagramPath,
        filename: instagramPath,
        loaded: true,
        exports: MockInstagramAPI
    };
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

    try {
        const result = await worker.processMessage({
            entry: [{
                id: '17841452817679462',
                messaging: [{
                    sender: { id: '893292439759295' },
                    recipient: { id: '17841452817679462' },
                    message: {
                        mid: 'mid-share-real-event-1',
                        attachments: [{
                            type: 'share',
                            payload: {
                                ig_post_media_id: '18031795967011250'
                            }
                        }]
                    }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'post' });
        assert.equal(sentMessages.length, 1);
        assert.equal(sentMessages[0].messageType, 'template_text');
        assert.deepEqual(sentMessages[0].payload, { text: 'Real share event should send.' });
        assert.equal(savedState.mediaShareSent, true);
    } finally {
        restore();
    }
});

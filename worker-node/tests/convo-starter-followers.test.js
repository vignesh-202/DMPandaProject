const test = require('node:test');
const assert = require('node:assert/strict');

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

test('processMessage triggers followers_only prompt when convo_starter has followers_only enabled and user does not follow', async () => {
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
        followers_only: true,
        followers_only_message: 'Please follow us first!',
        once_per_user_24h: false
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
        
        async getAutomationDefaults() {
            return {
                followers_only_message: 'Follow us to unlock this content!',
                followers_only_primary_button_text: '👤 Follow Account',
                followers_only_secondary_button_text: "✅ I've Followed"
            };
        }
    }

    class MockInstagramAPI {
        async sendMessage(recipientId, messageType, payload) {
            sentMessages.push({ recipientId, messageType, payload });
            return true;
        }

        async getUserProfile() {
            return { is_user_follow_business: false };
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
            exports: { matchDM: () => convoStarterAutomation }
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
                    postback: { payload: 'new question 1', title: 'new question 1' }
                }]
            }]
        });

        assert.deepEqual(result, { handled: true, automationType: 'convo_starter' });
        assert.equal(sentMessages.length, 1);
        assert.equal(sentMessages[0].messageType, 'template_buttons');
        assert.equal(sentMessages[0].payload.text, 'Please follow us first!');
        assert.equal(sentMessages[0].payload.buttons[0].title, '👤 Follow Account');
        assert.equal(sentMessages[0].payload.buttons[0].url, 'https://www.instagram.com/demo_account/');
    } finally {
        restore();
    }
});

const { Client, Databases, Query, ID } = require('node-appwrite');
require('dotenv').config();

const CHAT_STATES_COLLECTION_ID = process.env.CHAT_STATES_COLLECTION_ID || 'chat_states';
const AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID = process.env.AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID || 'automation_collect_destinations';
const AUTOMATION_COLLECTED_EMAILS_COLLECTION_ID = process.env.AUTOMATION_COLLECTED_EMAILS_COLLECTION_ID || 'automation_collected_emails';

class AppwriteClient {
    constructor() {
        this.client = new Client();
        this.client
            .setEndpoint(process.env.APPWRITE_ENDPOINT)
            .setProject(process.env.APPWRITE_PROJECT_ID)
            .setKey(process.env.APPWRITE_API_KEY);
        this.databases = new Databases(this.client);
        this.databaseId = process.env.APPWRITE_DATABASE_ID;
        this._automationDefaultsCache = null;
        this._automationDefaultsExpiresAt = 0;
        this._chatStatesSchemaCache = null;
        this._chatStatesSchemaExpiresAt = 0;
    }

    normalizeAccountIds(accountIds) {
        const values = Array.isArray(accountIds) ? accountIds : [accountIds];
        return Array.from(new Set(
            values
                .map((value) => String(value || '').trim())
                .filter(Boolean)
        ));
    }

    _toBoolean(value, fallback = false) {
        if (value === null || value === undefined || value === '') return fallback;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        const normalized = String(value).trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'off'].includes(normalized)) return false;
        return fallback;
    }

    _extractSpecialMeta(value) {
        const raw = String(value || '').trim();
        const prefix = '__special_meta__:';
        if (!raw.startsWith(prefix)) return null;
        return this._parseJson(raw.slice(prefix.length), null);
    }

    _splitConversationKey(conversationKey) {
        const safeKey = String(conversationKey || '').trim();
        if (!safeKey) {
            return { senderId: '', recipientId: '' };
        }

        const [recipientId = '', ...rest] = safeKey.split(':');
        return {
            recipientId: String(recipientId || '').trim(),
            senderId: String(rest.join(':') || '').trim()
        };
    }

    async _getChatStatesSchema() {
        const now = Date.now();
        if (this._chatStatesSchemaCache && this._chatStatesSchemaExpiresAt > now) {
            return this._chatStatesSchemaCache;
        }

        const fallback = {
            attributeKeys: new Set(['account_id', 'conversation_key', 'sender_id', 'recipient_id', 'state_json', 'updated_at', 'expires_at']),
            requiredKeys: new Set(['account_id', 'conversation_key'])
        };

        try {
            const response = await this.databases.listAttributes(
                this.databaseId,
                CHAT_STATES_COLLECTION_ID,
                [Query.limit(100)]
            );
            const attributes = Array.isArray(response?.attributes) ? response.attributes : [];
            if (attributes.length > 0) {
                const schema = {
                    attributeKeys: new Set(attributes.map((attribute) => String(attribute?.key || '').trim()).filter(Boolean)),
                    requiredKeys: new Set(
                        attributes
                            .filter((attribute) => attribute?.required === true)
                            .map((attribute) => String(attribute?.key || '').trim())
                            .filter(Boolean)
                    )
                };
                this._chatStatesSchemaCache = schema;
                this._chatStatesSchemaExpiresAt = now + (5 * 60 * 1000);
                return schema;
            }
        } catch (error) {
            console.warn('Failed to load chat_states schema metadata:', error?.message || error);
        }

        this._chatStatesSchemaCache = fallback;
        this._chatStatesSchemaExpiresAt = now + (60 * 1000);
        return fallback;
    }

    _normalizeAutomation(automation) {
        if (!automation || typeof automation !== 'object') return automation;

        const specialMeta = this._extractSpecialMeta(automation.comment_reply);
        const normalizedCommentReply = specialMeta
            ? ''
            : String(automation.comment_reply || '').trim();

        return {
            ...automation,
            menu_item_type: String(
                automation.menu_item_type
                || specialMeta?.menu_item_type
                || ''
            ).trim(),
            followers_only: this._toBoolean(automation.followers_only),
            suggest_more_enabled: this._toBoolean(automation.suggest_more_enabled),
            share_to_admin_enabled: this._toBoolean(automation.share_to_admin_enabled),
            once_per_user_24h: this._toBoolean(
                automation.once_per_user_24h,
                this._toBoolean(specialMeta?.once_per_user_24h)
            ),
            collect_email_enabled: this._toBoolean(
                automation.collect_email_enabled,
                this._toBoolean(specialMeta?.collect_email_enabled)
            ),
            collect_email_only_gmail: this._toBoolean(
                automation.collect_email_only_gmail,
                this._toBoolean(specialMeta?.collect_email_only_gmail)
            ),
            seen_typing_enabled: this._toBoolean(
                automation.seen_typing_enabled,
                this._toBoolean(specialMeta?.seen_typing_enabled)
            ),
            comment_reply: normalizedCommentReply
        };
    }

    async getIGAccount(accountId) {
        try {
            let response = await this.databases.listDocuments(
                this.databaseId,
                process.env.IG_ACCOUNTS_COLLECTION_ID,
                [Query.equal('ig_user_id', accountId)]
            );
            if (response.documents.length === 0) {
                response = await this.databases.listDocuments(
                    this.databaseId,
                    process.env.IG_ACCOUNTS_COLLECTION_ID,
                    [Query.equal('account_id', accountId)]
                );
            }
            if (response.documents.length === 0) {
                response = await this.databases.listDocuments(
                    this.databaseId,
                    process.env.IG_ACCOUNTS_COLLECTION_ID,
                    [Query.equal('ig_user_id', accountId)]
                );
            }
            return response.documents.length > 0 ? this._normalizeAccountAccess(response.documents[0]) : null;
        } catch (error) {
            console.error(`Error fetching IG account ${accountId}:`, error);
            return null;
        }
    }

    async getActiveAutomations(accountIds, automationTypes = ['dm', 'global', 'convo_starter', 'inbox_menu']) {
        try {
            const normalizedAccountIds = this.normalizeAccountIds(accountIds);
            const normalizedTypes = this.normalizeAccountIds(automationTypes);
            if (normalizedAccountIds.length === 0) return [];
            if (normalizedTypes.length === 0) return [];

            const response = await this.databases.listDocuments(
                this.databaseId,
                process.env.AUTOMATIONS_COLLECTION_ID,
                [
                    Query.equal('account_id', normalizedAccountIds),
                    Query.equal('automation_type', normalizedTypes),
                    Query.equal('is_active', true)
                ]
            );
            return response.documents.map((document) => this._normalizeAutomation(document));
        } catch (error) {
            console.error(`Error fetching automations for ${JSON.stringify(accountIds)}:`, error);
            return [];
        }
    }

    async getActiveConfigAutomation(accountIds, automationType) {
        try {
            const normalizedAccountIds = this.normalizeAccountIds(accountIds);
            if (normalizedAccountIds.length === 0) return null;

            const response = await this.databases.listDocuments(
                this.databaseId,
                process.env.AUTOMATIONS_COLLECTION_ID,
                [
                    Query.equal('account_id', normalizedAccountIds),
                    Query.equal('automation_type', String(automationType || '').trim()),
                    Query.equal('is_active', true),
                    Query.limit(1)
                ]
            );
            return response.documents[0] ? this._normalizeAutomation(response.documents[0]) : null;
        } catch (error) {
            console.error(
                `Error fetching ${automationType} config automation for ${JSON.stringify(accountIds)}:`,
                error
            );
            return null;
        }
    }

    async getTemplate(templateId, accountId = null) {
        try {
            const template = await this.databases.getDocument(
                this.databaseId,
                'reply_templates',
                templateId
            );
            if (accountId && template.account_id && String(template.account_id) !== String(accountId)) {
                return null;
            }
            return this._normalizeTemplate(template);
        } catch (error) {
            if (error.code !== 404) {
                console.error(`Error fetching template ${templateId}:`, error);
            }
            return null;
        }
    }

    _parseJson(value, fallback = {}) {
        if (value === null || value === undefined) return fallback;
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch (_) {
                return fallback;
            }
        }
        if (typeof value === 'object') return value;
        return fallback;
    }

    _normalizeAccountAccess(account = null) {
        const adminDisabled = this._toBoolean(account?.admin_disabled, false);
        const planLocked = this._toBoolean(account?.plan_locked, false);
        const accessOverrideEnabled = this._toBoolean(account?.access_override_enabled, false);
        const linkedActive = this._toBoolean(account?.is_active, String(account?.status || 'active').trim().toLowerCase() === 'active')
            && String(account?.status || 'active').trim().toLowerCase() === 'active';
        const effectiveAccess = linkedActive && !adminDisabled && (!planLocked || accessOverrideEnabled);
        const accessState = !linkedActive
            ? 'inactive'
            : (adminDisabled ? 'admin_disabled' : ((planLocked && !accessOverrideEnabled) ? 'plan_locked' : (accessOverrideEnabled ? 'override_enabled' : 'active')));

        return {
            ...account,
            admin_disabled: adminDisabled,
            plan_locked: planLocked,
            access_override_enabled: accessOverrideEnabled,
            effective_access: effectiveAccess,
            access_state: accessState,
            access_reason: effectiveAccess ? (accessOverrideEnabled ? 'override_enabled' : null) : accessState
        };
    }

    _normalizeTemplate(template) {
        const type = template.template_type || template.type || 'template_text';
        const data = this._parseJson(template.template_data, template.payload || {});

        let payload = {};
        switch (type) {
            case 'template_text':
                payload = { text: data.text || template.content || '' };
                break;
            case 'template_buttons':
                payload = { text: data.text || '', buttons: Array.isArray(data.buttons) ? data.buttons : [] };
                break;
            case 'template_quick_replies':
                payload = { text: data.text || '', replies: Array.isArray(data.replies) ? data.replies : [] };
                break;
            case 'template_carousel':
                payload = { elements: Array.isArray(data.elements) ? data.elements : [] };
                break;
            case 'template_media':
            case 'template_media_attachment':
                payload = {
                    media_url: data.media_url || data.url || '',
                    media_type: data.media_type || 'image',
                    buttons: Array.isArray(data.buttons) ? data.buttons : []
                };
                break;
            case 'template_share_post':
                payload = {
                    media_id: data.media_id || data.post_id || '',
                    media_url: data.media_url || data.thumbnail_url || '',
                    media_type: 'image'
                };
                break;
            case 'template_url':
                payload = { text: data.text || data.url || '' };
                break;
            default:
                payload = { text: data.text || template.content || '' };
                break;
        }

        return {
            ...template,
            type,
            payload
        };
    }

    buildAutomationTemplate(automation = {}) {
        const type = String(automation.template_type || automation.type || 'template_text').trim() || 'template_text';
        const buttons = this._parseJson(automation.buttons, []);
        const replies = this._parseJson(automation.replies, []);
        const elements = this._parseJson(automation.template_elements, []);
        const textContent = String(automation.template_content || automation.text || automation.title || '').trim();
        const menuItemType = String(automation.menu_item_type || '').trim().toLowerCase();

        if (menuItemType === 'web_url' && automation.media_url) {
            return {
                ...automation,
                type: 'template_buttons',
                payload: {
                    text: textContent || 'Open this link',
                    buttons: [
                        {
                            type: 'web_url',
                            title: String(automation.title || 'Open').trim() || 'Open',
                            url: String(automation.media_url || '').trim()
                        }
                    ]
                }
            };
        }

        switch (type) {
            case 'template_buttons':
                return {
                    ...automation,
                    type,
                    payload: {
                        text: textContent,
                        buttons: Array.isArray(buttons) ? buttons : []
                    }
                };
            case 'template_quick_replies':
                return {
                    ...automation,
                    type,
                    payload: {
                        text: textContent,
                        replies: Array.isArray(replies) ? replies : []
                    }
                };
            case 'template_carousel':
                return {
                    ...automation,
                    type,
                    payload: {
                        elements: Array.isArray(elements) ? elements : []
                    }
                };
            case 'template_media':
            case 'template_media_attachment':
                return {
                    ...automation,
                    type,
                    payload: {
                        media_url: String(automation.media_url || automation.template_content || '').trim(),
                        media_type: String(automation.media_type || 'image').trim() || 'image',
                        buttons: Array.isArray(buttons) ? buttons : []
                    }
                };
            case 'template_share_post':
                return {
                    ...automation,
                    type,
                    payload: {
                        media_id: String(automation.media_id || '').trim(),
                        media_url: String(automation.media_url || automation.thumbnail_url || '').trim(),
                        media_type: 'image'
                    }
                };
            case 'template_url':
                return {
                    ...automation,
                    type,
                    payload: {
                        text: textContent || String(automation.media_url || '').trim()
                    }
                };
            case 'template_text':
            default:
                return {
                    ...automation,
                    type: 'template_text',
                    payload: {
                        text: textContent
                    }
                };
        }
    }

    async getProfile(userId) {
        try {
            const response = await this.databases.listDocuments(
                this.databaseId,
                process.env.PROFILES_COLLECTION_ID || 'profiles',
                [Query.equal('user_id', String(userId)), Query.limit(1)]
            );
            return response.documents[0] || null;
        } catch (error) {
            console.error(`Error fetching profile ${userId}:`, error);
            return null;
        }
    }

    async getUser(userId) {
        try {
            return await this.databases.getDocument(
                this.databaseId,
                process.env.USERS_COLLECTION_ID || 'users',
                String(userId || '').trim()
            );
        } catch (error) {
            console.error(`Error fetching user ${userId}:`, error);
            return null;
        }
    }

    async getUserAccessState(userId) {
        const [profile, user] = await Promise.all([
            this.getProfile(userId),
            this.getUser(userId)
        ]);
        const killSwitchEnabled = this._toBoolean(
            user?.kill_switch_enabled ?? profile?.kill_switch_enabled,
            true
        );
        const banMode = String(user?.ban_mode || 'none').trim().toLowerCase();
        const normalizedBanMode = ['soft', 'hard'].includes(banMode) ? banMode : 'none';
        const automationLockReason = normalizedBanMode === 'hard'
            ? 'hard_ban'
            : (normalizedBanMode === 'soft'
                ? 'soft_ban'
                : (killSwitchEnabled ? null : 'kill_switch_disabled'));
        return {
            ban_mode: normalizedBanMode,
            ban_message: String(user?.ban_reason || '').trim() || null,
            kill_switch_enabled: killSwitchEnabled,
            automation_lock_reason: automationLockReason,
            automation_locked: Boolean(automationLockReason)
        };
    }

    async getExecutionState(userId) {
        const [profile, user] = await Promise.all([
            this.getProfile(userId),
            this.getUser(userId)
        ]);
        const killSwitchEnabled = this._toBoolean(
            user?.kill_switch_enabled ?? profile?.kill_switch_enabled,
            true
        );
        const banMode = String(user?.ban_mode || 'none').trim().toLowerCase();
        const normalizedBanMode = ['soft', 'hard'].includes(banMode) ? banMode : 'none';
        const automationLockReason = normalizedBanMode === 'hard'
            ? 'hard_ban'
            : (normalizedBanMode === 'soft'
                ? 'soft_ban'
                : (killSwitchEnabled ? null : 'kill_switch_disabled'));
        const accessState = {
            ban_mode: normalizedBanMode,
            ban_message: String(user?.ban_reason || '').trim() || null,
            kill_switch_enabled: killSwitchEnabled,
            automation_lock_reason: automationLockReason,
            automation_locked: Boolean(automationLockReason)
        };

        return {
            profile,
            user,
            accessState
        };
    }

    async getAutomation(automationId, accountId = null) {
        try {
            const automation = await this.databases.getDocument(
                this.databaseId,
                process.env.AUTOMATIONS_COLLECTION_ID,
                String(automationId || '').trim()
            );
            if (accountId && String(automation.account_id || '').trim() !== String(accountId || '').trim()) {
                return null;
            }
            return this._normalizeAutomation(automation);
        } catch (error) {
            if (error.code !== 404) {
                console.error(`Error fetching automation ${automationId}:`, error);
            }
            return null;
        }
    }

    async getWatermarkPolicy() {
        try {
            const document = await this.databases.getDocument(
                this.databaseId,
                process.env.ADMIN_SETTINGS_COLLECTION_ID || 'admin_settings',
                'global_watermark_policy'
            );
            return {
                enabled: document.enabled !== false,
                default_text: document.default_text || 'Automation made by DMPanda',
                enforcement_mode: document.enforcement_mode || 'fallback_secondary_message',
                allow_user_override: document.allow_user_override !== false
            };
        } catch (_) {
            return {
                enabled: true,
                default_text: 'Automation made by DMPanda',
                enforcement_mode: 'fallback_secondary_message',
                allow_user_override: true
            };
        }
    }

    async getAutomationDefaults() {
        const now = Date.now();
        if (this._automationDefaultsCache && this._automationDefaultsExpiresAt > now) {
            return this._automationDefaultsCache;
        }

        const defaults = {
            followers_only_message: 'Please follow this account first, then send your message again.',
            followers_only_primary_button_text: '👤 Follow Account',
            followers_only_secondary_button_text: "✅ I've Followed",
            collect_email_prompt_message: '📧 Could you share your best email so we can send the details and updates ✨',
            collect_email_fail_retry_message: '⚠️ That email looks invalid. Please send a valid email like name@example.com.',
            collect_email_success_reply_message: 'Perfect, thank you! Your email has been saved ✅'
        };

        try {
            const response = await this.databases.listAttributes(
                this.databaseId,
                process.env.AUTOMATIONS_COLLECTION_ID,
                [Query.limit(100)]
            );
            const attributes = Array.isArray(response?.attributes) ? response.attributes : [];
            for (const attribute of attributes) {
                const key = String(attribute?.key || '').trim();
                if (!key || !(key in defaults)) continue;
                const nextDefault = String(attribute?.default || '').trim();
                if (nextDefault) {
                    defaults[key] = nextDefault;
                }
            }
        } catch (error) {
            console.warn('Failed to load automation attribute defaults:', error?.message || error);
        }

        this._automationDefaultsCache = defaults;
        this._automationDefaultsExpiresAt = now + (5 * 60 * 1000);
        return defaults;
    }

    async getConversationState(accountId, conversationKey) {
        try {
            const schema = await this._getChatStatesSchema();
            const { senderId, recipientId } = this._splitConversationKey(conversationKey);
            const queries = [Query.equal('account_id', String(accountId || '').trim())];

            if (schema.attributeKeys.has('conversation_key')) {
                queries.push(Query.equal('conversation_key', String(conversationKey || '').trim()));
            } else {
                if (schema.attributeKeys.has('sender_id') && senderId) {
                    queries.push(Query.equal('sender_id', senderId));
                }
                if (schema.attributeKeys.has('recipient_id') && recipientId) {
                    queries.push(Query.equal('recipient_id', recipientId));
                }
            }
            queries.push(Query.limit(1));

            const response = await this.databases.listDocuments(
                this.databaseId,
                CHAT_STATES_COLLECTION_ID,
                queries
            );

            const document = response.documents?.[0] || null;
            if (!document) return null;

            return {
                ...document,
                state_json: this._parseJson(document.state_json, {})
            };
        } catch (error) {
            console.warn(
                `Conversation state lookup failed for ${String(accountId || '').trim()}:${String(conversationKey || '').trim()}:`,
                error?.message || error
            );
            return null;
        }
    }

    async upsertConversationState({
        userId,
        accountId,
        conversationKey,
        senderId,
        recipientId,
        stateData,
        expiresAt = null
    }) {
        const safeAccountId = String(accountId || '').trim();
        const safeConversationKey = String(conversationKey || '').trim();
        if (!safeAccountId || !safeConversationKey) return null;

        const schema = await this._getChatStatesSchema();
        const nowIso = new Date().toISOString();
        const payload = {};

        if (schema.attributeKeys.has('user_id')) payload.user_id = String(userId || '').trim();
        if (schema.attributeKeys.has('account_id')) payload.account_id = safeAccountId;
        if (schema.attributeKeys.has('conversation_key')) payload.conversation_key = safeConversationKey;
        if (schema.attributeKeys.has('sender_id')) payload.sender_id = String(senderId || '').trim();
        if (schema.attributeKeys.has('recipient_id')) payload.recipient_id = String(recipientId || '').trim();
        if (schema.attributeKeys.has('state_json')) payload.state_json = JSON.stringify(stateData || {});
        if (schema.attributeKeys.has('updated_at')) payload.updated_at = nowIso;
        if (schema.attributeKeys.has('expires_at')) payload.expires_at = expiresAt || null;
        if (schema.attributeKeys.has('last_seen_at')) payload.last_seen_at = nowIso;

        if (schema.requiredKeys.has('last_seen_at') && !payload.last_seen_at) {
            payload.last_seen_at = nowIso;
        }

        try {
            const existing = await this.getConversationState(safeAccountId, safeConversationKey);
            const document = existing
                ? await this.databases.updateDocument(this.databaseId, CHAT_STATES_COLLECTION_ID, existing.$id, payload)
                : await this.databases.createDocument(this.databaseId, CHAT_STATES_COLLECTION_ID, ID.unique(), payload);

            return {
                ...document,
                state_json: this._parseJson(document.state_json, {})
            };
        } catch (error) {
            console.warn(
                `Conversation state upsert failed for ${safeAccountId}:${safeConversationKey}:`,
                error?.message || error
            );
            return null;
        }
    }

    async clearConversationState(accountId, conversationKey) {
        try {
            const existing = await this.getConversationState(accountId, conversationKey);
            if (!existing?.$id) return true;
            await this.databases.deleteDocument(this.databaseId, CHAT_STATES_COLLECTION_ID, existing.$id);
            return true;
        } catch (error) {
            console.warn(
                `Conversation state delete failed for ${String(accountId || '').trim()}:${String(conversationKey || '').trim()}:`,
                error?.message || error
            );
            return false;
        }
    }

    async getEmailCollectorDestination(automationId, accountId) {
        try {
            const response = await this.databases.listDocuments(
                this.databaseId,
                AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID,
                [
                    Query.equal('automation_id', String(automationId || '').trim()),
                    Query.equal('account_id', String(accountId || '').trim()),
                    Query.limit(1)
                ]
            );

            const document = response.documents?.[0] || null;
            if (!document) return null;

            let destinationJson = {};
            try {
                destinationJson = typeof document.destination_json === 'string'
                    ? JSON.parse(document.destination_json)
                    : (document.destination_json || {});
            } catch (_) {
                destinationJson = {};
            }

            return {
                ...document,
                destination_json: destinationJson,
                verified: destinationJson?.verified === true
            };
        } catch (error) {
            console.warn(
                `Email collector destination lookup failed for ${String(accountId || '').trim()}:${String(automationId || '').trim()}:`,
                error?.message || error
            );
            return null;
        }
    }

    async ensureCollectedEmailsCollection() {
        if (this._collectedEmailsCollectionReady === true) {
            return true;
        }

        try {
            await this.databases.getCollection(this.databaseId, AUTOMATION_COLLECTED_EMAILS_COLLECTION_ID);
            this._collectedEmailsCollectionReady = true;
            return true;
        } catch (error) {
            const missing = String(error?.message || '').includes('Collection with the requested ID could not be found.')
                || Number(error?.code) === 404;
            if (!missing) {
                console.warn('Collected emails collection lookup failed:', error?.message || error);
                return false;
            }
        }

        try {
            await this.databases.createCollection(
                this.databaseId,
                AUTOMATION_COLLECTED_EMAILS_COLLECTION_ID,
                'Automation Collected Emails'
            );

            const attributes = [
                ['user_id', 255, true],
                ['account_id', 255, true],
                ['automation_id', 255, true],
                ['conversation_key', 255, true],
                ['sender_id', 255, true],
                ['recipient_id', 255, true],
                ['email', 255, true],
                ['normalized_email', 255, true],
                ['send_to', 50, false],
                ['sender_profile_url', 500, false],
                ['receiver_name', 255, false],
                ['automation_title', 255, false],
                ['automation_type', 50, false]
            ];

            for (const [key, size, required] of attributes) {
                await this.databases.createStringAttribute(
                    this.databaseId,
                    AUTOMATION_COLLECTED_EMAILS_COLLECTION_ID,
                    key,
                    size,
                    required
                );
            }

            await this.databases.createDatetimeAttribute(
                this.databaseId,
                AUTOMATION_COLLECTED_EMAILS_COLLECTION_ID,
                'collected_at',
                true
            );
            await this.databases.createDatetimeAttribute(
                this.databaseId,
                AUTOMATION_COLLECTED_EMAILS_COLLECTION_ID,
                'updated_at',
                true
            );

            await this.databases.createIndex(
                this.databaseId,
                AUTOMATION_COLLECTED_EMAILS_COLLECTION_ID,
                'idx_normalized_email',
                'key',
                ['normalized_email']
            );
            await this.databases.createIndex(
                this.databaseId,
                AUTOMATION_COLLECTED_EMAILS_COLLECTION_ID,
                'idx_account_collected_at',
                'key',
                ['account_id', 'collected_at']
            );
            await this.databases.createIndex(
                this.databaseId,
                AUTOMATION_COLLECTED_EMAILS_COLLECTION_ID,
                'idx_automation_collected_at',
                'key',
                ['automation_id', 'collected_at']
            );

            this._collectedEmailsCollectionReady = true;
            return true;
        } catch (error) {
            console.warn('Collected emails collection create failed:', error?.message || error);
            return false;
        }
    }

    async recordCollectedEmail({
        userId,
        accountId,
        automationId,
        conversationKey,
        senderId,
        recipientId,
        email,
        normalizedEmail,
        sendTo = 'everyone',
        senderProfileUrl = '',
        receiverName = '',
        automationTitle = '',
        automationType = ''
    }) {
        try {
            const collectionReady = await this.ensureCollectedEmailsCollection();
            if (!collectionReady) {
                return false;
            }

            await this.databases.createDocument(
                this.databaseId,
                AUTOMATION_COLLECTED_EMAILS_COLLECTION_ID,
                ID.unique(),
                {
                    user_id: String(userId || '').trim(),
                    account_id: String(accountId || '').trim(),
                    automation_id: String(automationId || '').trim(),
                    conversation_key: String(conversationKey || '').trim(),
                    sender_id: String(senderId || '').trim(),
                    recipient_id: String(recipientId || '').trim(),
                    email: String(email || '').trim(),
                    normalized_email: String(normalizedEmail || '').trim(),
                    send_to: String(sendTo || 'everyone').trim() || 'everyone',
                    sender_profile_url: String(senderProfileUrl || '').trim(),
                    receiver_name: String(receiverName || '').trim(),
                    automation_title: String(automationTitle || '').trim(),
                    automation_type: String(automationType || '').trim(),
                    collected_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            );
            return true;
        } catch (error) {
            console.warn(
                `Collected email save failed for ${String(accountId || '').trim()}:${String(conversationKey || '').trim()}:`,
                error?.message || error
            );
            return false;
        }
    }
}

module.exports = AppwriteClient;



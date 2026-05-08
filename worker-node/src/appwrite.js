const crypto = require('crypto');
const { Client, Databases, Query, ID } = require('node-appwrite');
require('dotenv').config();
const { withAppwriteRetry } = require('./appwriteSafety');
const { buildActionUsageIncrementPatch } = require('../../shared/actionRateLimiter');
const sharedPlanFeatures = require('../../shared/planFeatures.json');

const CHAT_STATES_COLLECTION_ID = process.env.CHAT_STATES_COLLECTION_ID || 'chat_states';
const AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID = process.env.AUTOMATION_COLLECT_DESTINATIONS_COLLECTION_ID || 'automation_collect_destinations';
const CONVO_STARTERS_COLLECTION_ID = process.env.CONVO_STARTERS_COLLECTION_ID || 'convo_starters';
const PRICING_COLLECTION_ID = process.env.PRICING_COLLECTION_ID || 'pricing';
const SYSTEM_CONFIG_COLLECTION_ID = process.env.SYSTEM_CONFIG_COLLECTION_ID || 'system_config';
const LOGS_COLLECTION_ID = process.env.LOGS_COLLECTION_ID || 'logs';
const WATERMARK_POLICY_DOCUMENT_ID = 'watermark_policy';
const PLAN_BENEFIT_KEYS = Object.freeze(sharedPlanFeatures.benefitKeys || []);
const PLAN_BENEFIT_STORAGE_KEYS = Object.freeze(sharedPlanFeatures.benefitStorageKeys || {});
const LEGACY_PLAN_BENEFIT_STORAGE_KEYS = Object.freeze(sharedPlanFeatures.legacyBenefitStorageKeys || {});
const benefitFieldForKey = (key) => `benefit_${PLAN_BENEFIT_STORAGE_KEYS[key] || key}`;
const benefitFieldsForKey = (key) => [
    benefitFieldForKey(key),
    ...(LEGACY_PLAN_BENEFIT_STORAGE_KEYS[key] || []).map((legacyKey) => `benefit_${legacyKey}`)
];

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
        this._pricingCache = null;
        this._pricingExpiresAt = 0;
        this._watermarkPolicyCache = null;
        this._watermarkPolicyExpiresAt = 0;
        this.workerInstanceId = String(
            process.env.WORKER_INSTANCE_ID
            || process.env.HOSTNAME
            || `worker-${process.pid}`
        ).trim();
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

    _hashToken(value, length = 32) {
        const digest = crypto
            .createHash('sha256')
            .update(String(value || '').trim())
            .digest('hex');
        return digest.slice(0, Math.max(8, Math.min(64, Number(length || 32))));
    }

    _buildEventLockDocumentId({ accountId, eventKey, eventType = 'message' }) {
        const token = `${String(accountId || '').trim()}|${String(eventType || 'message').trim()}|${String(eventKey || '').trim()}`;
        return `evt_${this._hashToken(token, 32)}`;
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

    _toArray(value) {
        if (Array.isArray(value)) return value;
        if (value === null || value === undefined || value === '') return [];
        return [value];
    }

    _parseJson(value, fallback = null) {
        if (value === null || value === undefined || value === '') return fallback;
        if (typeof value === 'object') return value;
        try {
            return JSON.parse(String(value));
        } catch (_) {
            return fallback;
        }
    }

    async _loadConvoStarterFallbacks(accountIds) {
        const normalizedAccountIds = this.normalizeAccountIds(accountIds);
        if (normalizedAccountIds.length === 0) return [];
        try {
            const response = await withAppwriteRetry(() => this.databases.listDocuments(
                this.databaseId,
                CONVO_STARTERS_COLLECTION_ID,
                [
                    Query.equal('account_id', normalizedAccountIds),
                    Query.limit(25)
                ]
            ), {
                operationName: 'get_convo_starter_fallbacks',
                context: { account_ids: normalizedAccountIds }
            });

            const documents = Array.isArray(response?.documents) ? response.documents : [];
            const automations = [];
            for (const doc of documents) {
                const starters = this._parseJson(doc?.starters, []);
                if (!Array.isArray(starters)) continue;
                starters.forEach((starter, index) => {
                    const normalized = this._normalizeAutomation({
                        $id: `${String(doc?.$id || 'convo').trim()}:starter:${index + 1}`,
                        account_id: String(doc?.account_id || '').trim(),
                        automation_type: 'convo_starter',
                        trigger_type: 'ice_breakers',
                        title: String(starter?.question || '').trim(),
                        title_normalized: String(starter?.question || '').trim().toLowerCase(),
                        payload: String(starter?.payload || starter?.template_id || '').trim(),
                        template_id: String(starter?.template_id || starter?.payload || '').trim(),
                        template_content: String(starter?.template_id || starter?.payload || '').trim(),
                        template_type: String(starter?.template_type || '').trim() || null,
                        is_active: true,
                        followers_only: starter?.followers_only === true,
                        followers_only_message: String(starter?.followers_only_message || '').trim(),
                        followers_only_primary_button_text: String(starter?.followers_only_primary_button_text || '').trim(),
                        followers_only_secondary_button_text: String(starter?.followers_only_secondary_button_text || '').trim(),
                        suggest_more_enabled: starter?.suggest_more_enabled === true,
                        once_per_user_24h: starter?.once_per_user_24h === true,
                        collect_email_enabled: starter?.collect_email_enabled === true,
                        collect_email_only_gmail: starter?.collect_email_only_gmail === true,
                        collect_email_prompt_message: String(starter?.collect_email_prompt_message || '').trim(),
                        collect_email_fail_retry_message: String(starter?.collect_email_fail_retry_message || '').trim(),
                        collect_email_success_reply_message: String(starter?.collect_email_success_reply_message || '').trim(),
                        seen_typing_enabled: starter?.seen_typing_enabled === true
                    });
                    automations.push(normalized);
                });
            }
            return automations;
        } catch (error) {
            console.warn(`Failed convo starter fallback lookup for ${JSON.stringify(normalizedAccountIds)}:`, error?.message || error);
            return [];
        }
    }

    async getIGAccount(accountId) {
        try {
            let response = await withAppwriteRetry(() => this.databases.listDocuments(
                this.databaseId,
                process.env.IG_ACCOUNTS_COLLECTION_ID,
                [Query.equal('ig_user_id', accountId)]
            ), {
                operationName: 'get_ig_account_by_ig_user_id',
                context: { account_id: accountId }
            });
            if (response.documents.length === 0) {
                response = await withAppwriteRetry(() => this.databases.listDocuments(
                    this.databaseId,
                    process.env.IG_ACCOUNTS_COLLECTION_ID,
                    [Query.equal('account_id', accountId)]
                ), {
                    operationName: 'get_ig_account_by_account_id',
                    context: { account_id: accountId }
                });
            }
            if (response.documents.length === 0) {
                response = await withAppwriteRetry(() => this.databases.listDocuments(
                    this.databaseId,
                    process.env.IG_ACCOUNTS_COLLECTION_ID,
                    [Query.equal('ig_user_id', accountId)]
                ), {
                    operationName: 'retry_get_ig_account_by_ig_user_id',
                    context: { account_id: accountId }
                });
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

            let response = await withAppwriteRetry(() => this.databases.listDocuments(
                this.databaseId,
                process.env.AUTOMATIONS_COLLECTION_ID,
                [
                    Query.equal('account_id', normalizedAccountIds),
                    Query.equal('automation_type', normalizedTypes),
                    Query.equal('is_active', true)
                ]
            ), {
                operationName: 'get_active_automations',
                context: { account_ids: normalizedAccountIds, automation_types: normalizedTypes }
            });
            let documents = response.documents || [];

            if (documents.length === 0) {
                response = await withAppwriteRetry(() => this.databases.listDocuments(
                    this.databaseId,
                    process.env.AUTOMATIONS_COLLECTION_ID,
                    [
                        Query.equal('account_id', normalizedAccountIds),
                        Query.equal('automation_type', normalizedTypes),
                        Query.limit(200)
                    ]
                ), {
                    operationName: 'get_active_automations_legacy_fallback',
                    context: { account_ids: normalizedAccountIds, automation_types: normalizedTypes }
                });
                documents = (response.documents || []).filter((document) => this._toBoolean(document?.is_active, true));
            }

            let normalizedAutomations = documents.map((document) => this._normalizeAutomation(document));

            if (normalizedTypes.includes('convo_starter')) {
                const hasConvoStarter = normalizedAutomations.some(
                    (document) => String(document?.automation_type || '').trim().toLowerCase() === 'convo_starter'
                );
                if (!hasConvoStarter) {
                    const fallbackConvoStarters = await this._loadConvoStarterFallbacks(normalizedAccountIds);
                    normalizedAutomations = normalizedAutomations.concat(fallbackConvoStarters);
                }
            }

            return normalizedAutomations;
        } catch (error) {
            console.error(`Error fetching automations for ${JSON.stringify(accountIds)}:`, error);
            return [];
        }
    }

    async getActiveConfigAutomation(accountIds, automationType) {
        try {
            const normalizedAccountIds = this.normalizeAccountIds(accountIds);
            if (normalizedAccountIds.length === 0) return null;

            let response = await withAppwriteRetry(() => this.databases.listDocuments(
                this.databaseId,
                process.env.AUTOMATIONS_COLLECTION_ID,
                [
                    Query.equal('account_id', normalizedAccountIds),
                    Query.equal('automation_type', String(automationType || '').trim()),
                    Query.equal('is_active', true),
                    Query.limit(1)
                ]
            ), {
                operationName: 'get_active_config_automation',
                context: { account_ids: normalizedAccountIds, automation_type: automationType }
            });
            let document = response.documents[0] || null;

            if (!document) {
                response = await withAppwriteRetry(() => this.databases.listDocuments(
                    this.databaseId,
                    process.env.AUTOMATIONS_COLLECTION_ID,
                    [
                        Query.equal('account_id', normalizedAccountIds),
                        Query.equal('automation_type', String(automationType || '').trim()),
                        Query.limit(25)
                    ]
                ), {
                    operationName: 'get_active_config_automation_legacy_fallback',
                    context: { account_ids: normalizedAccountIds, automation_type: automationType }
                });
                document = (response.documents || []).find((entry) => this._toBoolean(entry?.is_active, true)) || null;
            }

            return document ? this._normalizeAutomation(document) : null;
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
        const normalizedStatus = String(account?.status || 'active').trim().toLowerCase() || 'active';
        const normalizedAdminStatus = String(account?.admin_status || 'active').trim().toLowerCase() || 'active';
        const adminActive = normalizedAdminStatus === 'active';
        const userActive = normalizedStatus === 'active';
        const linkedActive = adminActive && userActive;
        const effectiveAccess = linkedActive;
        const accessReason = !adminActive ? 'admin_inactive' : (!userActive ? 'inactive' : null);
        const accessState = linkedActive ? 'active' : 'inactive';

        return {
            ...account,
            status: normalizedStatus,
            admin_status: normalizedAdminStatus,
            effective_access: effectiveAccess,
            access_state: accessState,
            access_reason: effectiveAccess ? null : accessReason,
            is_active: linkedActive,
            admin_is_active: adminActive,
            user_is_active: userActive,
            disabled_by_admin: !adminActive,
            disabled_by_user: !userActive
        };
    }

    _getAccountSortKey(account = null) {
        return [
            String(account?.linked_at || '').trim(),
            String(account?.$id || '').trim()
        ];
    }

    async getIGAccountsForUser(userId) {
        const safeUserId = String(userId || '').trim();
        if (!safeUserId) return [];

        try {
            const response = await withAppwriteRetry(() => this.databases.listDocuments(
                this.databaseId,
                process.env.IG_ACCOUNTS_COLLECTION_ID,
                [
                    Query.equal('user_id', safeUserId),
                    Query.limit(100)
                ]
            ), {
                operationName: 'get_ig_accounts_for_user',
                context: { user_id: safeUserId }
            });

            return (response.documents || []).map((document) => this._normalizeAccountAccess(document));
        } catch (error) {
            console.error(`Error fetching IG accounts for user ${safeUserId}:`, error);
            return [];
        }
    }

    async getAccountExecutionAccess(userId, account = null, profile = null) {
        const safeAccountId = String(account?.$id || '').trim();
        const normalizedStatus = String(account?.status || 'active').trim().toLowerCase() || 'active';
        const normalizedAdminStatus = String(account?.admin_status || 'active').trim().toLowerCase() || 'active';
        const adminActive = normalizedAdminStatus === 'active';
        const userActive = normalizedStatus === 'active';
        const linkedActive = adminActive && userActive;
        if (!safeAccountId) {
            return {
                admin_active: adminActive,
                user_active: userActive,
                linked_active: linkedActive,
                plan_locked: false,
                effective_access: linkedActive,
                access_reason: !adminActive ? 'admin_inactive' : (linkedActive ? null : (normalizedStatus || 'inactive'))
            };
        }

        const activeLimit = Math.max(0, Number(profile?.instagram_connections_limit || 0) || 0);
        const accounts = await this.getIGAccountsForUser(userId);
        const activeAccounts = accounts
            .filter((item) => {
                const itemStatus = String(item?.status || 'active').trim().toLowerCase() || 'active';
                const itemAdminStatus = String(item?.admin_status || 'active').trim().toLowerCase() || 'active';
                return itemStatus === 'active' && itemAdminStatus === 'active';
            })
            .sort((left, right) => {
                const [leftLinkedAt, leftId] = this._getAccountSortKey(left);
                const [rightLinkedAt, rightId] = this._getAccountSortKey(right);
                if (leftLinkedAt !== rightLinkedAt) return leftLinkedAt.localeCompare(rightLinkedAt);
                return leftId.localeCompare(rightId);
            });

        const allowedIds = new Set(
            activeAccounts
                .slice(0, activeLimit)
                .map((item) => String(item?.$id || '').trim())
                .filter(Boolean)
        );
        const planLocked = linkedActive && !allowedIds.has(safeAccountId);

        return {
            admin_active: adminActive,
            user_active: userActive,
            linked_active: linkedActive,
            plan_locked: planLocked,
            effective_access: linkedActive && !planLocked,
            access_reason: !adminActive ? 'admin_inactive' : (!userActive ? (normalizedStatus || 'inactive') : (planLocked ? 'plan_locked' : null))
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
                    media_type: 'image',
                    linked_media_url: data.linked_media_url || '',
                    permalink: data.permalink || '',
                    use_latest_post: data.use_latest_post === true,
                    latest_post_type: String(data.latest_post_type || 'post').trim() || 'post',
                    caption: data.caption || ''
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
                        media_type: 'image',
                        linked_media_url: String(automation.linked_media_url || '').trim(),
                        permalink: String(automation.permalink || '').trim(),
                        use_latest_post: automation.use_latest_post === true,
                        latest_post_type: String(automation.latest_post_type || 'post').trim() || 'post',
                        caption: String(automation.caption || '').trim()
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

    async _listPricingPlans() {
        const now = Date.now();
        if (this._pricingCache && this._pricingExpiresAt > now) {
            return this._pricingCache;
        }
        const response = await withAppwriteRetry(() => this.databases.listDocuments(
            this.databaseId,
            PRICING_COLLECTION_ID,
            [Query.limit(100)]
        ), {
            operationName: 'list_pricing_plans',
            context: {}
        });
        const documents = Array.isArray(response?.documents) ? response.documents : [];
        this._pricingCache = documents;
        this._pricingExpiresAt = now + (60 * 1000);
        return documents;
    }

    async _getPricingPlan(planCode) {
        const normalizedPlanCode = String(planCode || '').trim().toLowerCase() || 'free';
        const plans = await this._listPricingPlans();
        return plans.find((plan) => String(plan?.plan_code || plan?.name || '').trim().toLowerCase() === normalizedPlanCode) || null;
    }

    async _hydrateProfilePlan(profile) {
        if (!profile || typeof profile !== 'object') return profile;
        const plan = await this._getPricingPlan(profile.plan_code);
        if (!plan) return profile;
        const hydrated = { ...profile };
        hydrated.__plan_code = String(plan.plan_code || profile.plan_code || 'free').trim().toLowerCase() || 'free';
        if (hydrated.__plan_code === 'free') {
            hydrated.expiry_date = null;
        }
        hydrated.__plan_features = {};
        PLAN_BENEFIT_KEYS.forEach((key) => {
            const profileOverride = benefitFieldsForKey(key).find((field) => hydrated[field] !== undefined);
            const enabled = profileOverride
                ? hydrated[profileOverride] === true
                : benefitFieldsForKey(key).some((field) => plan?.[field] === true);
            hydrated[benefitFieldForKey(key)] = enabled;
            hydrated.__plan_features[key] = enabled;
        });
        const hasOwnMonthlyLimit = Object.prototype.hasOwnProperty.call(hydrated, 'monthly_action_limit');
        hydrated.instagram_link_limit = Number(
            hydrated.instagram_link_limit
            ?? plan.instagram_link_limit
            ?? plan.instagram_connections_limit
            ?? 0
        );
        hydrated.instagram_connections_limit = Number(
            hydrated.instagram_connections_limit
            ?? plan.instagram_connections_limit
            ?? 0
        );
        hydrated.hourly_action_limit = Number(
            hydrated.hourly_action_limit
            ?? plan.actions_per_hour_limit
            ?? 0
        );
        hydrated.daily_action_limit = Number(
            hydrated.daily_action_limit
            ?? plan.actions_per_day_limit
            ?? 0
        );
        hydrated.monthly_action_limit = hasOwnMonthlyLimit
            ? hydrated.monthly_action_limit
            : Number(plan.actions_per_month_limit ?? 0);
        return hydrated;
    }

    async getProfile(userId) {
        try {
            const response = await withAppwriteRetry(() => this.databases.listDocuments(
                this.databaseId,
                process.env.PROFILES_COLLECTION_ID || 'profiles',
                [Query.equal('user_id', String(userId)), Query.limit(1)]
            ), {
                operationName: 'get_profile',
                context: { user_id: userId }
            });
            return this._hydrateProfilePlan(response.documents[0] || null);
        } catch (error) {
            console.error(`Error fetching profile ${userId}:`, error);
            return null;
        }
    }

    async incrementActionUsage(userId, incrementBy = 1) {
        const profile = await this.getProfile(userId);
        if (!profile?.$id) return null;
        const patch = buildActionUsageIncrementPatch(profile, incrementBy);
        return withAppwriteRetry(() => this.databases.updateDocument(
            this.databaseId,
            process.env.PROFILES_COLLECTION_ID || 'profiles',
            profile.$id,
            patch
        ), {
            operationName: 'increment_action_usage',
            context: { user_id: userId, profile_id: profile.$id, increment_by: incrementBy }
        });
    }

    async getUser(userId) {
        try {
            return await withAppwriteRetry(() => this.databases.getDocument(
                this.databaseId,
                process.env.USERS_COLLECTION_ID || 'users',
                String(userId || '').trim()
            ), {
                operationName: 'get_user',
                context: { user_id: userId }
            });
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
        const now = Date.now();
        if (this._watermarkPolicyCache && this._watermarkPolicyExpiresAt > now) {
            return { ...this._watermarkPolicyCache };
        }

        const fallback = {
            enabled: String(process.env.DEFAULT_WATERMARK_ENABLED || 'true').trim().toLowerCase() !== 'false',
            type: 'text',
            position: ['inline_when_possible', 'secondary_message'].includes(String(process.env.DEFAULT_WATERMARK_POSITION || '').trim().toLowerCase())
                ? String(process.env.DEFAULT_WATERMARK_POSITION).trim().toLowerCase()
                : 'secondary_message',
            opacity: Number.isFinite(Number(process.env.DEFAULT_WATERMARK_OPACITY))
                ? Math.max(0, Math.min(1, Number(process.env.DEFAULT_WATERMARK_OPACITY)))
                : 1
        };

        try {
            const document = await this.databases.getDocument(
                this.databaseId,
                SYSTEM_CONFIG_COLLECTION_ID,
                WATERMARK_POLICY_DOCUMENT_ID
            );
            const policy = {
                enabled: document.enabled !== false,
                type: 'text',
                position: ['inline_when_possible', 'secondary_message'].includes(String(document.position || '').trim().toLowerCase())
                    ? String(document.position).trim().toLowerCase()
                    : fallback.position,
                opacity: Number.isFinite(Number(document.opacity))
                    ? Math.max(0, Math.min(1, Number(document.opacity)))
                    : fallback.opacity
            };
            this._watermarkPolicyCache = policy;
            this._watermarkPolicyExpiresAt = now + (30 * 1000);
            return { ...policy };
        } catch (_) {
            this._watermarkPolicyCache = fallback;
            this._watermarkPolicyExpiresAt = now + (30 * 1000);
            return { ...fallback };
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

    async claimProcessingEvent({
        eventType = 'message',
        accountId,
        conversationKey = '',
        senderId = '',
        recipientId = '',
        eventKey
    }, options = {}) {
        const safeEventKey = String(eventKey || '').trim();
        const safeAccountId = String(accountId || '').trim();
        if (!safeEventKey || !safeAccountId) {
            return { claimed: true, bypassed: true, reason: 'missing_event_identity' };
        }

        const schema = await this._getChatStatesSchema();
        const now = Date.now();
        const nowIso = new Date(now).toISOString();
        const processingTtlMs = Math.max(30_000, Number(options.processingTtlMs || 5 * 60 * 1000) || (5 * 60 * 1000));
        const dedupeTtlMs = Math.max(processingTtlMs, Number(options.dedupeTtlMs || 60 * 60 * 1000) || (60 * 60 * 1000));
        const eventConversationKey = `event:${String(eventType || 'message').trim()}:${safeEventKey}`;
        const lockRecipientId = `evt_${this._hashToken(`${String(eventType || 'message').trim()}:${safeEventKey}`, 24)}`;
        const documentId = this._buildEventLockDocumentId({
            eventType,
            accountId: safeAccountId,
            eventKey: safeEventKey
        });
        const expiresAtIso = new Date(now + processingTtlMs).toISOString();
        const stateJson = JSON.stringify({
            type: 'event_lock',
            status: 'processing',
            event_type: String(eventType || 'message').trim() || 'message',
            event_key: safeEventKey,
            owner: this.workerInstanceId,
            updated_at: nowIso
        });

        const payload = {};
        if (schema.attributeKeys.has('user_id') && options.userId) payload.user_id = String(options.userId || '').trim();
        if (schema.attributeKeys.has('account_id')) payload.account_id = safeAccountId;
        if (schema.attributeKeys.has('conversation_key')) payload.conversation_key = eventConversationKey;
        if (schema.attributeKeys.has('sender_id')) payload.sender_id = String(senderId || '').trim();
        if (schema.attributeKeys.has('recipient_id')) payload.recipient_id = lockRecipientId;
        if (schema.attributeKeys.has('state_json')) payload.state_json = stateJson;
        if (schema.attributeKeys.has('updated_at')) payload.updated_at = nowIso;
        if (schema.attributeKeys.has('expires_at')) payload.expires_at = expiresAtIso;
        if (schema.attributeKeys.has('last_seen_at')) payload.last_seen_at = nowIso;
        if (schema.requiredKeys.has('last_seen_at') && !payload.last_seen_at) payload.last_seen_at = nowIso;

        try {
            await withAppwriteRetry(() => this.databases.createDocument(
                this.databaseId,
                CHAT_STATES_COLLECTION_ID,
                documentId,
                payload
            ), {
                operationName: 'claim_processing_event',
                context: {
                    event_type: eventType,
                    account_id: safeAccountId
                }
            });
            return {
                claimed: true,
                eventType,
                eventKey: safeEventKey,
                accountId: safeAccountId,
                documentId,
                conversationKey: eventConversationKey,
                dedupeUntil: new Date(now + dedupeTtlMs).toISOString()
            };
        } catch (error) {
            const code = Number(error?.code || error?.response?.code || 0);
            if (code !== 409) {
                throw error;
            }
        }

        const resolveExistingLock = async () => {
            const queries = [Query.equal('account_id', safeAccountId), Query.limit(1)];
            if (schema.attributeKeys.has('conversation_key')) {
                queries.push(Query.equal('conversation_key', eventConversationKey));
            } else if (schema.attributeKeys.has('recipient_id')) {
                queries.push(Query.equal('recipient_id', lockRecipientId));
            }
            const response = await withAppwriteRetry(() => this.databases.listDocuments(
                this.databaseId,
                CHAT_STATES_COLLECTION_ID,
                queries
            ), {
                operationName: 'find_processing_event_lock',
                context: { event_type: eventType, account_id: safeAccountId }
            });
            return response.documents?.[0] || null;
        };

        let existing = null;
        try {
            existing = await resolveExistingLock();
        } catch (error) {
            console.warn('Failed to locate existing processing lock after conflict:', error?.message || error);
            return {
                claimed: false,
                duplicate: true,
                reason: 'conflict_without_lock_lookup',
                eventType,
                eventKey: safeEventKey,
                accountId: safeAccountId
            };
        }

        if (!existing) {
            return {
                claimed: false,
                duplicate: true,
                reason: 'conflict_without_existing_doc',
                eventType,
                eventKey: safeEventKey,
                accountId: safeAccountId
            };
        }

        const existingState = this._parseJson(existing?.state_json, {});
        const existingExpiresAt = Date.parse(String(existing?.expires_at || ''));
        const isLockLive = Number.isFinite(existingExpiresAt) && existingExpiresAt > now;
        const completed = String(existingState?.status || '').trim().toLowerCase() === 'completed';

        if (completed || isLockLive) {
            return {
                claimed: false,
                duplicate: true,
                reason: completed ? 'already_completed' : 'processing_in_progress',
                eventType,
                eventKey: safeEventKey,
                accountId: safeAccountId,
                documentId: String(existing?.$id || '').trim() || documentId
            };
        }

        const existingDocumentId = String(existing?.$id || '').trim() || documentId;
        const takeoverStateJson = JSON.stringify({
            type: 'event_lock',
            status: 'processing',
            event_type: String(eventType || 'message').trim() || 'message',
            event_key: safeEventKey,
            owner: this.workerInstanceId,
            taken_over: true,
            updated_at: nowIso
        });
        const takeoverPatch = {};
        if (schema.attributeKeys.has('state_json')) takeoverPatch.state_json = takeoverStateJson;
        if (schema.attributeKeys.has('updated_at')) takeoverPatch.updated_at = nowIso;
        if (schema.attributeKeys.has('expires_at')) takeoverPatch.expires_at = expiresAtIso;
        if (schema.attributeKeys.has('last_seen_at')) takeoverPatch.last_seen_at = nowIso;
        if (schema.attributeKeys.has('sender_id') && senderId) takeoverPatch.sender_id = String(senderId || '').trim();
        if (schema.attributeKeys.has('recipient_id')) takeoverPatch.recipient_id = lockRecipientId;

        try {
            await withAppwriteRetry(() => this.databases.updateDocument(
                this.databaseId,
                CHAT_STATES_COLLECTION_ID,
                existingDocumentId,
                takeoverPatch
            ), {
                operationName: 'takeover_processing_event_lock',
                context: {
                    event_type: eventType,
                    account_id: safeAccountId
                }
            });
            return {
                claimed: true,
                takenOver: true,
                eventType,
                eventKey: safeEventKey,
                accountId: safeAccountId,
                documentId: existingDocumentId,
                conversationKey: eventConversationKey,
                dedupeUntil: new Date(now + dedupeTtlMs).toISOString()
            };
        } catch (error) {
            return {
                claimed: false,
                duplicate: true,
                reason: 'takeover_failed',
                eventType,
                eventKey: safeEventKey,
                accountId: safeAccountId
            };
        }
    }

    async finalizeProcessingEvent(claim = {}, { status = 'completed', error = null, dedupeTtlMs = 60 * 60 * 1000 } = {}) {
        const documentId = String(claim?.documentId || '').trim();
        if (!documentId) return false;

        const schema = await this._getChatStatesSchema();
        const now = Date.now();
        const nowIso = new Date(now).toISOString();
        const normalizedStatus = status === 'failed' ? 'failed' : 'completed';
        const patch = {};
        if (schema.attributeKeys.has('state_json')) {
            patch.state_json = JSON.stringify({
                type: 'event_lock',
                status: normalizedStatus,
                event_type: String(claim?.eventType || 'message').trim() || 'message',
                event_key: String(claim?.eventKey || '').trim(),
                owner: this.workerInstanceId,
                error: error ? String(error).slice(0, 500) : null,
                updated_at: nowIso
            });
        }
        if (schema.attributeKeys.has('updated_at')) patch.updated_at = nowIso;
        if (schema.attributeKeys.has('last_seen_at')) patch.last_seen_at = nowIso;
        if (schema.attributeKeys.has('expires_at')) {
            const ttl = normalizedStatus === 'completed'
                ? Math.max(60_000, Number(dedupeTtlMs || 60 * 60 * 1000) || (60 * 60 * 1000))
                : 1000;
            patch.expires_at = new Date(now + ttl).toISOString();
        }

        try {
            await withAppwriteRetry(() => this.databases.updateDocument(
                this.databaseId,
                CHAT_STATES_COLLECTION_ID,
                documentId,
                patch
            ), {
                operationName: 'finalize_processing_event',
                context: {
                    event_type: claim?.eventType || 'message',
                    account_id: claim?.accountId || ''
                }
            });
            return true;
        } catch (error) {
            console.warn('Failed to finalize processing event lock:', error?.message || error);
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
        // Collected emails are routed to external destinations (Google Sheets / APIs).
        // Keep this as a compatibility no-op to avoid recreating DB storage.
        return false;
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
        await this.ensureCollectedEmailsCollection();
        return true;
    }

    async createAutomationLog({
        accountId,
        recipientId = null,
        senderName = null,
        automationId = null,
        automationType = null,
        eventType = 'message',
        source = 'worker_node',
        message = null,
        payload = null,
        status = 'success',
        sentAt = new Date().toISOString()
    } = {}) {
        const safeAccountId = String(accountId || '').trim();
        if (!safeAccountId) return null;

        const safeStatus = ['success', 'failed', 'skipped'].includes(String(status || '').trim().toLowerCase())
            ? String(status || '').trim().toLowerCase()
            : 'failed';
        const safeEventType = String(eventType || 'message').trim().toLowerCase() || 'message';

        let serializedPayload = null;
        if (payload !== null && payload !== undefined) {
            try {
                serializedPayload = typeof payload === 'string'
                    ? payload
                    : JSON.stringify(payload);
            } catch (_) {
                serializedPayload = null;
            }
        }
        if (serializedPayload && serializedPayload.length > 20000) {
            serializedPayload = serializedPayload.slice(0, 20000);
        }

        const document = {
            account_id: safeAccountId,
            event_type: safeEventType.slice(0, 50),
            source: String(source || 'worker_node').trim().slice(0, 50) || 'worker_node',
            message: message ? String(message).trim().slice(0, 2000) : null,
            payload: serializedPayload,
            sent_at: String(sentAt || new Date().toISOString()).trim() || new Date().toISOString(),
            status: safeStatus
        };

        if (recipientId) {
            document.recipient_id = String(recipientId).trim().slice(0, 255);
        }
        if (senderName) {
            document.sender_name = String(senderName).trim().slice(0, 255);
        }
        if (automationId) {
            document.automation_id = String(automationId).trim().slice(0, 255);
        }
        if (automationType) {
            document.automation_type = String(automationType).trim().slice(0, 50);
        }

        return withAppwriteRetry(() => this.databases.createDocument(
            this.databaseId,
            LOGS_COLLECTION_ID,
            ID.unique(),
            document
        ), {
            operationName: 'create_automation_log',
            context: {
                account_id: safeAccountId,
                automation_id: document.automation_id || null,
                status: safeStatus,
                event_type: safeEventType
            }
        });
    }
}

module.exports = AppwriteClient;

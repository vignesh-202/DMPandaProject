const crypto = require('crypto');
const AppwriteClient = require('./appwrite');
const InstagramAPI = require('./instagram');
const AutomationMatcher = require('./matcher');
const TemplateRenderer = require('./renderer');
const sharedPlanFeatures = require('../../shared/planFeatures.json');
const { evaluateActionRateLimit, normalizeActionLimits } = require('../../shared/actionRateLimiter');
const { planWatermark, resolveWatermarkPolicy } = require('./watermark');
const { deliverCollectedEmail } = require('./emailDestinations');

const DEFAULT_FOLLOWERS_ONLY_MESSAGE = 'Please follow this account first, then send your message again.';
const DEFAULT_COLLECT_EMAIL_PROMPT = '📧 Could you share your best email so we can send the details and updates ✨';
const DEFAULT_COLLECT_EMAIL_FAIL_RETRY = '⚠️ That email looks invalid. Please send a valid email like name@example.com.';
const DEFAULT_COLLECT_EMAIL_SUCCESS = 'Perfect, thank you! Your email has been saved ✅';
const AUTOMATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const EVENT_DEDUPE_TTL_MS = Math.max(
    60_000,
    Number(process.env.WORKER_EVENT_DEDUPE_TTL_MS || 60 * 60 * 1000) || (60 * 60 * 1000)
);
const PROCESSING_LOCK_TTL_MS = Math.max(
    30_000,
    Number(process.env.WORKER_EVENT_PROCESSING_LOCK_TTL_MS || 5 * 60 * 1000) || (5 * 60 * 1000)
);
const getTriggerType = (automation) => String(automation?.trigger_type || 'keywords').trim().toLowerCase();
const isKeywordTrigger = (automation) => getTriggerType(automation) === 'keywords';
const isAllCommentsTrigger = (automation) => getTriggerType(automation) === 'all_comments';
const FEATURE_ALIASES = Object.freeze(sharedPlanFeatures.benefitAliases || {});
const TOGGLE_FEATURE_MAP = Object.freeze(sharedPlanFeatures.toggleFeatureMap || {});
const AUTOMATION_TYPE_FEATURE_MAP = Object.freeze(sharedPlanFeatures.automationTypeFeatureMap || {});
const COMMENT_REPLY_FEATURE_MAP = Object.freeze(sharedPlanFeatures.commentReplyFeatureMap || {});
const SHARE_TRIGGER_FEATURE_MAP = Object.freeze(sharedPlanFeatures.shareTriggerFeatureMap || {});
const USE_NEW_GATING = String(process.env.USE_NEW_GATING ?? 'true').trim().toLowerCase() !== 'false';
const LEGACY_TOGGLE_FEATURE_MAP = Object.freeze({
    suggest_more_enabled: 'suggest_more',
    collect_email_enabled: 'collect_email',
    seen_typing_enabled: 'seen_typing',
    followers_only: 'followers_only'
});
const LEGACY_AUTOMATION_TYPE_FEATURE_MAP = Object.freeze({
    dm: 'dm_automation',
    global: 'global_trigger',
    comment: 'post_comment_dm_reply',
    post: 'post_comment_dm_reply',
    reel: 'reel_comment_dm_reply',
    story: 'story_automation',
    live: 'instagram_live_automation',
    mention: 'mentions',
    mentions: 'mentions',
    welcome_message: 'welcome_message',
    inbox_menu: 'inbox_menu',
    convo_starter: 'convo_starters',
    suggest_more: 'suggest_more',
    comment_moderation: 'comment_moderation',
    moderation_hide: 'comment_moderation',
    moderation_delete: 'comment_moderation'
});

const normalizeFeatureKey = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[+/\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const resolveCanonicalFeatureKey = (value) => {
    const normalized = normalizeFeatureKey(value);
    if (!normalized) return '';
    return FEATURE_ALIASES[normalized] || normalized;
};

class DMWorker {
    constructor() {
        this.appwrite = new AppwriteClient();
        this.localWelcomeCooldownMs = Math.max(
            60_000,
            Number(process.env.WELCOME_MESSAGE_WINDOW_MS || 24 * 60 * 60 * 1000) || (24 * 60 * 60 * 1000)
        );
        this.localWelcomeCooldown = new Map();
        this.localConversationStates = new Map();
        this.localProcessedEvents = new Map();
    }

    _hashToken(value, length = 24) {
        const digest = crypto
            .createHash('sha256')
            .update(String(value || '').trim())
            .digest('hex');
        return digest.slice(0, Math.max(8, Math.min(64, Number(length || 24))));
    }

    _cleanupProcessedEvents(now = Date.now()) {
        if (!(this.localProcessedEvents instanceof Map)) {
            this.localProcessedEvents = new Map();
        }
        for (const [key, expiresAt] of this.localProcessedEvents.entries()) {
            if (!Number.isFinite(expiresAt) || expiresAt <= now) {
                this.localProcessedEvents.delete(key);
            }
        }
    }

    _rememberProcessedEvent(meta, ttlMs = EVENT_DEDUPE_TTL_MS) {
        const eventKey = String(meta?.eventKey || '').trim();
        const accountId = String(meta?.accountId || '').trim();
        const eventType = String(meta?.eventType || 'message').trim() || 'message';
        if (!eventKey || !accountId) return;
        this._cleanupProcessedEvents();
        const compositeKey = `${accountId}:${eventType}:${eventKey}`;
        this.localProcessedEvents.set(compositeKey, Date.now() + Math.max(30_000, Number(ttlMs || EVENT_DEDUPE_TTL_MS)));
    }

    _wasProcessedRecently(meta) {
        const eventKey = String(meta?.eventKey || '').trim();
        const accountId = String(meta?.accountId || '').trim();
        const eventType = String(meta?.eventType || 'message').trim() || 'message';
        if (!eventKey || !accountId) return false;
        this._cleanupProcessedEvents();
        const compositeKey = `${accountId}:${eventType}:${eventKey}`;
        const expiresAt = Number(this.localProcessedEvents.get(compositeKey) || 0);
        return Number.isFinite(expiresAt) && expiresAt > Date.now();
    }

    _extractEventMetaFromWebhook(webhookData, options = {}) {
        const optionMeta = options?.meta && typeof options.meta === 'object' ? options.meta : {};
        const safeOptionMeta = options && typeof options === 'object' ? options : {};
        const mergedMeta = { ...safeOptionMeta, ...optionMeta };
        const entry = webhookData?.entry?.[0];
        const messaging = entry?.messaging?.[0];
        const change = entry?.changes?.[0];

        let eventType = String(mergedMeta.eventType || '').trim().toLowerCase();
        let accountId = String(mergedMeta.accountId || mergedMeta.recipientId || '').trim();
        let recipientId = String(mergedMeta.recipientId || '').trim();
        let senderId = String(mergedMeta.senderId || '').trim();
        let conversationKey = String(mergedMeta.conversationKey || '').trim();
        let eventKey = String(mergedMeta.eventKey || '').trim();

        if (messaging && typeof messaging === 'object') {
            eventType = eventType || (messaging?.postback
                ? (messaging?.postback?.referral || messaging?.postback?.context ? 'share_referral' : 'postback')
                : 'message');
            recipientId = recipientId || String(messaging?.recipient?.id || entry?.id || '').trim();
            senderId = senderId || String(messaging?.sender?.id || '').trim();
            accountId = accountId || recipientId;
            conversationKey = conversationKey || (senderId && recipientId ? `${recipientId}:${senderId}` : '');
            eventKey = eventKey || String(
                messaging?.message?.mid
                || messaging?.postback?.mid
                || messaging?.postback?.payload
                || messaging?.postback?.title
                || ''
            ).trim();
        } else if (change && typeof change === 'object') {
            const field = String(change?.field || '').trim().toLowerCase();
            const value = change?.value || {};
            if (!eventType) {
                if (field === 'comments' || field === 'live_comments') eventType = 'comment';
                else if (field === 'mentions' || field === 'story_mentions' || field.includes('mention')) eventType = 'mention';
            }
            recipientId = recipientId || String(value?.recipient?.id || entry?.id || '').trim();
            senderId = senderId || String(
                value?.from?.id
                || value?.sender?.id
                || value?.user?.id
                || value?.author?.id
                || value?.mentioned_by?.id
                || value?.user_id
                || value?.sender_id
                || ''
            ).trim();
            accountId = accountId || recipientId;
            conversationKey = conversationKey || (senderId && recipientId ? `${recipientId}:${senderId}` : '');
            if (!eventKey) {
                const entityId = String(
                    value?.id
                    || value?.comment_id
                    || value?.mention_id
                    || value?.media_id
                    || value?.message
                    || ''
                ).trim();
                if (entityId) {
                    eventKey = `${eventType || 'event'}:${recipientId}:${senderId}:${entityId}`;
                }
            }
        }

        if (!eventKey && conversationKey) {
            const rawPayload = JSON.stringify({
                conversationKey,
                text: String(messaging?.message?.text || messaging?.postback?.payload || '').trim(),
                timestamp: String(messaging?.timestamp || '').trim()
            });
            eventKey = `fallback:${this._hashToken(rawPayload, 32)}`;
        }

        return {
            eventType: eventType || 'message',
            accountId: accountId || recipientId || '',
            recipientId: recipientId || accountId || '',
            senderId: senderId || '',
            conversationKey: conversationKey || '',
            eventKey: eventKey || ''
        };
    }

    async _getAutomationDefaults() {
        if (typeof this.appwrite.getAutomationDefaults === 'function') {
            return this.appwrite.getAutomationDefaults();
        }
        return {
            followers_only_message: DEFAULT_FOLLOWERS_ONLY_MESSAGE,
            followers_only_primary_button_text: '👤 Follow Account',
            followers_only_secondary_button_text: "✅ I've Followed",
            collect_email_prompt_message: DEFAULT_COLLECT_EMAIL_PROMPT,
            collect_email_fail_retry_message: DEFAULT_COLLECT_EMAIL_FAIL_RETRY,
            collect_email_success_reply_message: DEFAULT_COLLECT_EMAIL_SUCCESS
        };
    }

    getAutomationAccountIds(igAccount, recipientId) {
        return Array.from(new Set(
            [
                recipientId,
                igAccount?.ig_user_id,
                igAccount?.account_id
            ]
                .map((value) => String(value || '').trim())
                .filter(Boolean)
        ));
    }

    _getActionLimitGate(profile) {
        const gate = evaluateActionRateLimit(profile || {});
        return {
            blocked: gate.blocked,
            reason: gate.code,
            stage: gate.stage,
            limits: gate.limits,
            usage: gate.usage
        };
    }

    _getProfileFeatures(profile) {
        const features = { ...(profile?.__plan_features || {}) };
        let hasExplicitFeatures = Object.keys(features).length > 0;
        Object.keys(profile || {}).forEach((key) => {
            if (key.startsWith('benefit_')) {
                hasExplicitFeatures = true;
                const rawKey = key.slice('benefit_'.length);
                features[resolveCanonicalFeatureKey(rawKey)] = profile[key] === true;
            }
        });
        features.__hasExplicitFeatures = hasExplicitFeatures;
        return features;
    }

    _hasPlanFeature(profile, key) {
        const features = this._getProfileFeatures(profile);
        if (features.__hasExplicitFeatures !== true) return true;
        return features[resolveCanonicalFeatureKey(key)] === true;
    }

    _requiredFeaturesForAutomation(automation) {
        const type = String(automation?.automation_type || 'dm').trim().toLowerCase();
        const toggleMap = USE_NEW_GATING ? TOGGLE_FEATURE_MAP : LEGACY_TOGGLE_FEATURE_MAP;
        const typeMap = USE_NEW_GATING ? AUTOMATION_TYPE_FEATURE_MAP : LEGACY_AUTOMATION_TYPE_FEATURE_MAP;
        const required = [];
        if (typeMap[type]) required.push(typeMap[type]);
        Object.entries(toggleMap).forEach(([toggleField, featureKey]) => {
            if (automation?.[toggleField] === true) required.push(featureKey);
        });
        if (!USE_NEW_GATING) {
            if (automation?.private_reply_enabled === false && ['comment', 'post'].includes(type)) {
                required.push('post_comment_reply_automation');
            }
            if (automation?.private_reply_enabled === false && type === 'reel') {
                required.push('reel_comment_reply_automation');
            }
            if (String(automation?.template_type || '').trim() === 'template_share_post') {
                const latestType = String(automation?.latest_post_type || '').trim().toLowerCase();
                required.push(latestType === 'reel' ? 'share_reel_to_admin' : 'share_post_to_admin');
            }
            return Array.from(new Set(required.map((feature) => resolveCanonicalFeatureKey(feature)).filter(Boolean)));
        }
        const commentReplyFeature = COMMENT_REPLY_FEATURE_MAP[type] || (type === 'global' ? 'post_comment_reply_automation' : '');
        if (String(automation?.comment_reply ?? automation?.comment_reply_text ?? '').trim() && commentReplyFeature) {
            required.push(commentReplyFeature);
        }
        const isShareTrigger = getTriggerType(automation) === 'share_to_admin'
            || automation?.share_to_admin_enabled === true
            || String(automation?.template_type || '').trim() === 'template_share_post';
        if (isShareTrigger) {
            required.push(SHARE_TRIGGER_FEATURE_MAP[type] || 'share_post_to_admin');
        }
        return Array.from(new Set(required.map((feature) => resolveCanonicalFeatureKey(feature)).filter(Boolean)));
    }

    _isAutomationAllowedByPlan(profile, automation) {
        if (String(automation?.plan_validation_state || '').trim().toLowerCase() === 'invalid_due_to_plan') {
            const invalidFeatures = (() => {
                if (Array.isArray(automation?.invalid_features)) {
                    return automation.invalid_features;
                }
                if (typeof automation?.invalid_features === 'string') {
                    try {
                        const parsed = JSON.parse(automation.invalid_features);
                        return Array.isArray(parsed) ? parsed : [];
                    } catch {
                        return [];
                    }
                }
                return [];
            })();
            const missing = invalidFeatures
                .map((feature) => resolveCanonicalFeatureKey(feature))
                .filter(Boolean);
            return {
                allowed: false,
                missing: missing.length > 0 ? missing : this._requiredFeaturesForAutomation(automation),
                invalidState: true
            };
        }
        const missing = this._requiredFeaturesForAutomation(automation).filter((feature) => !this._hasPlanFeature(profile, feature));
        return {
            allowed: missing.length === 0,
            missing,
            invalidState: false
        };
    }

    _logAutomationDecision(eventType, details = {}) {
        try {
            console.log(JSON.stringify({
                scope: 'automation_gate',
                event_type: eventType,
                ...details
            }));
        } catch (_) {
            console.log('automation_gate', eventType, details);
        }
    }

    _logBlockedFeatures({ userId, accountId, automation, missingFeatures, reason, eventType }) {
        const safeMissingFeatures = Array.isArray(missingFeatures)
            ? Array.from(new Set(missingFeatures.map((item) => String(item || '').trim()).filter(Boolean)))
            : [];
        this._logAutomationDecision(eventType, {
            user_id: userId,
            account_id: accountId || null,
            automation_id: automation?.$id || null,
            automation_type: String(automation?.automation_type || 'dm').trim() || 'dm',
            reason: String(reason || 'plan_feature_blocked').trim() || 'plan_feature_blocked',
            missing_features: safeMissingFeatures
        });
        safeMissingFeatures.forEach((featureKey) => {
            this._logAutomationDecision('feature_blocked', {
                user_id: userId,
                feature_key: featureKey,
                reason: String(reason || 'plan_feature_blocked').trim() || 'plan_feature_blocked',
                account_id: accountId || null,
                automation_id: automation?.$id || null
            });
        });
    }

    _trackMetaApiAction(tracker, userId) {
        if (!tracker || !(tracker.counts instanceof Map)) return;
        const safeUserId = String(userId || '').trim();
        if (!safeUserId) return;
        tracker.counts.set(safeUserId, Number(tracker.counts.get(safeUserId) || 0) + 1);
    }

    _initializeMetaApiBudget(tracker, userId, profile) {
        if (!tracker || !(tracker.budgets instanceof Map)) return;
        const safeUserId = String(userId || '').trim();
        if (!safeUserId || tracker.budgets.has(safeUserId)) return;
        const limits = normalizeActionLimits(profile || {});
        const usage = {
            hourly_actions_used: Number(profile?.hourly_actions_used || 0),
            daily_actions_used: Number(profile?.daily_actions_used || 0),
            monthly_actions_used: Number(profile?.monthly_actions_used || 0)
        };
        tracker.budgets.set(safeUserId, { limits, usage });
    }

    _canConsumeMetaApiAction(tracker, userId, amount = 1) {
        const safeUserId = String(userId || '').trim();
        if (!tracker || !(tracker.budgets instanceof Map) || !safeUserId) {
            return { allowed: false, code: 'execution_state_uncertain', reason: 'missing_meta_api_budget_tracker' };
        }
        const budget = tracker.budgets.get(safeUserId);
        if (!budget) {
            return { allowed: false, code: 'execution_state_uncertain', reason: 'missing_meta_api_budget_state' };
        }

        const pending = Number(tracker.counts.get(safeUserId) || 0);
        const delta = Math.max(1, Number(amount || 1));
        const nextHourly = Number(budget.usage.hourly_actions_used || 0) + pending + delta;
        const nextDaily = Number(budget.usage.daily_actions_used || 0) + pending + delta;
        const nextMonthly = Number(budget.usage.monthly_actions_used || 0) + pending + delta;

        if (Number(budget.limits.hourly_action_limit || 0) > 0 && nextHourly > Number(budget.limits.hourly_action_limit || 0)) {
            return { allowed: false, code: 'hourly_action_limit_reached', reason: 'meta_api_hourly_limit_reached' };
        }
        if (Number(budget.limits.daily_action_limit || 0) > 0 && nextDaily > Number(budget.limits.daily_action_limit || 0)) {
            return { allowed: false, code: 'daily_action_limit_reached', reason: 'meta_api_daily_limit_reached' };
        }
        if (budget.limits.monthly_action_limit != null && Number(budget.limits.monthly_action_limit || 0) > 0 && nextMonthly > Number(budget.limits.monthly_action_limit || 0)) {
            return { allowed: false, code: 'monthly_action_limit_reached', reason: 'meta_api_monthly_limit_reached' };
        }

        return { allowed: true, code: null, reason: null };
    }

    async _flushMetaApiActionUsage(tracker) {
        if (!tracker || tracker.flushed === true || !(tracker.counts instanceof Map)) return;
        tracker.flushed = true;
        if (typeof this.appwrite.incrementActionUsage !== 'function') return;

        for (const [userId, count] of tracker.counts.entries()) {
            const safeUserId = String(userId || '').trim();
            const safeCount = Math.max(0, Number(count || 0));
            if (!safeUserId || safeCount <= 0) continue;
            await this.appwrite.incrementActionUsage(safeUserId, safeCount).catch((error) => {
                console.warn('Failed to increment Meta API action usage:', error?.message || error);
            });
        }
    }

    _createInstagramClient(accessToken, userId, tracker = null, profile = null) {
        const safeUserId = String(userId || '').trim();
        this._initializeMetaApiBudget(tracker, safeUserId, profile);
        return new InstagramAPI(accessToken, {
            onBeforeRequest: async () => this._canConsumeMetaApiAction(tracker, safeUserId, 1),
            onRequestComplete: async () => {
                this._trackMetaApiAction(tracker, safeUserId);
            }
        });
    }

    _resolveActionUserId(...candidates) {
        for (const candidate of candidates) {
            const safe = String(candidate || '').trim();
            if (safe) return safe;
        }
        return '';
    }

    async _recordAutomationLog(entry = {}) {
        if (typeof this.appwrite.createAutomationLog !== 'function') return;
        await this.appwrite.createAutomationLog(entry).catch((error) => {
            console.warn('Failed to record automation log:', error?.message || error);
        });
    }

    async _getFreshExecutionGateState(userId, igAccount = null) {
        const { accessState, profile } = await this.appwrite.getExecutionState(userId);
        if (!profile) {
            return {
                accessState: {
                    kill_switch_enabled: false,
                    automation_lock_reason: 'execution_state_uncertain',
                    automation_locked: true
                },
                profile: null,
                actionLimitGate: { blocked: true, reason: 'execution_state_uncertain', stage: 'execution_state' }
            };
        }
        const resolvedPlanCode = String(profile?.plan_code || profile?.__plan_code || 'free').trim().toLowerCase() || 'free';
        if (accessState?.ban_mode === 'hard' || accessState?.ban_mode === 'soft') {
            return {
                accessState,
                profile,
                actionLimitGate: {
                    blocked: true,
                    reason: accessState?.ban_mode === 'hard' ? 'hard_ban' : 'soft_ban',
                    stage: 'ban'
                }
            };
        }
        const actionLimitGate = this._getActionLimitGate(profile);
        if (actionLimitGate.blocked) {
            return {
                accessState,
                profile,
                actionLimitGate
            };
        }
        if (resolvedPlanCode === 'free') {
            return {
                accessState,
                profile,
                actionLimitGate
            };
        }
        if (accessState?.kill_switch_enabled === false) {
            return {
                accessState,
                profile,
                actionLimitGate: {
                    blocked: true,
                    reason: 'kill_switch_disabled',
                    stage: 'automation_active'
                }
            };
        }
        if (!igAccount || igAccount.effective_access !== true) {
            return {
                accessState,
                profile,
                actionLimitGate: {
                    blocked: true,
                    reason: igAccount ? (igAccount.access_reason || 'account_access_blocked') : 'execution_state_uncertain',
                    stage: 'automation_active'
                }
            };
        }
        return {
            accessState,
            profile,
            actionLimitGate
        };
    }

    async sendRenderedTemplate(instagram, senderId, template, context, watermarkPolicy, options = {}) {
        const logContext = options?.logContext && typeof options.logContext === 'object'
            ? options.logContext
            : null;
        const renderedTemplate = TemplateRenderer.render(template, context);
        const watermarkPlan = planWatermark({
            templateType: template.type,
            payload: renderedTemplate.payload,
            policy: watermarkPolicy
        });

        const success = await instagram.sendMessage(
            senderId,
            template.type,
            watermarkPlan.primaryPayload
        );
        if (logContext?.accountId) {
            await this._recordAutomationLog({
                accountId: logContext.accountId,
                recipientId: logContext.recipientId || senderId,
                senderName: logContext.senderName || senderId,
                automationId: logContext.automationId || null,
                automationType: logContext.automationType || null,
                eventType: logContext.eventType || 'message',
                source: logContext.source || 'worker_node',
                message: success
                    ? `Sent ${String(template?.type || 'template').trim() || 'template'} reply`
                    : `Failed to send ${String(template?.type || 'template').trim() || 'template'} reply`,
                payload: watermarkPlan.primaryPayload,
                status: success ? 'success' : 'failed'
            });
        }

        if (success && watermarkPlan.secondaryPayload) {
            const secondarySent = await instagram.sendMessage(
                senderId,
                'template_text',
                watermarkPlan.secondaryPayload
            );
            if (logContext?.accountId) {
                await this._recordAutomationLog({
                    accountId: logContext.accountId,
                    recipientId: logContext.recipientId || senderId,
                    senderName: logContext.senderName || senderId,
                    automationId: logContext.automationId || null,
                    automationType: logContext.automationType || null,
                    eventType: logContext.eventType || 'message',
                    source: logContext.source || 'worker_node',
                    message: secondarySent ? 'Sent watermark follow-up' : 'Failed watermark follow-up',
                    payload: watermarkPlan.secondaryPayload,
                    status: secondarySent ? 'success' : 'failed'
                });
            }
        }

        return success;
    }

    async _delay(ms) {
        const safeDelay = Math.max(0, Number(ms || 0));
        if (safeDelay <= 0) return;
        await new Promise((resolve) => setTimeout(resolve, safeDelay));
    }

    async _getWatermarkPolicyForUser(userId) {
        const [profile, globalWatermarkPolicy] = await Promise.all([
            this.appwrite.getProfile(userId),
            this.appwrite.getWatermarkPolicy()
        ]);
        return resolveWatermarkPolicy({
            globalPolicy: globalWatermarkPolicy,
            profile
        });
    }

    async _sendWatermarkedText(instagram, senderId, text, watermarkPolicy, options = {}) {
        return this.sendRenderedTemplate(
            instagram,
            senderId,
            { type: 'template_text', payload: { text: String(text || '').trim() } },
            {},
            watermarkPolicy,
            options
        );
    }

    async _maybeSendSeenTypingPrelude(instagram, senderId, automation, chainState = null) {
        if (automation?.seen_typing_enabled !== true) return;
        if (chainState && chainState.preReplyHintsSent === true) return;

        try {
            await instagram.markSeen(senderId);
            await instagram.setTyping(senderId, true);
            await this._delay(900);
        } finally {
            await instagram.setTyping(senderId, false).catch(() => false);
            if (chainState && typeof chainState === 'object') {
                chainState.preReplyHintsSent = true;
            }
        }
    }

    async _sendSuggestMoreFollowUp({
        instagram,
        senderId,
        recipientId,
        messageText,
        automation,
        automationAccountIds,
        watermarkPolicy,
        ownerUserId = null,
        eventType = 'message',
        accountId = null
    }) {
        const actionUserId = this._resolveActionUserId(automation?.user_id, ownerUserId);
        if (automation?.suggest_more_enabled !== true) return false;
        if (actionUserId) {
            const executionState = await this.appwrite.getExecutionState(actionUserId);
            if (!this._hasPlanFeature(executionState?.profile, 'suggest_more')) {
                this._logBlockedFeatures({
                    userId: actionUserId,
                    accountId: automation?.account_id || null,
                    automation,
                    missingFeatures: ['suggest_more'],
                    reason: 'plan_feature_blocked',
                    eventType: 'suggest_more_feature_locked'
                });
                return false;
            }
        }

        const suggestMoreAutomation = await this.appwrite.getActiveConfigAutomation(
            automationAccountIds,
            'suggest_more'
        );

        if (!suggestMoreAutomation?.template_id) {
            return false;
        }

        const suggestMoreTemplate = await this.appwrite.getTemplate(
            suggestMoreAutomation.template_id,
            suggestMoreAutomation.account_id || automation?.account_id
        );
        if (!suggestMoreTemplate) {
            return false;
        }

        await this.sendRenderedTemplate(
            instagram,
            senderId,
            suggestMoreTemplate,
            {
                sender_id: senderId,
                recipient_id: recipientId,
                message_text: String(messageText || '').trim()
            },
            watermarkPolicy,
            {
                actionUserId,
                logContext: {
                    accountId: accountId || suggestMoreAutomation.account_id || automation?.account_id || null,
                    recipientId: senderId,
                    senderName: senderId,
                    automationId: suggestMoreAutomation.$id || null,
                    automationType: suggestMoreAutomation.automation_type || 'suggest_more',
                    eventType,
                    source: 'worker_node'
                }
            }
        );

        return true;
    }

    async _sendAutomationReply({
        instagram,
        senderId,
        recipientId,
        messageText,
        automation,
        automationAccountIds,
        watermarkPolicy,
        chainState = null,
        commentId = null,
        ownerUserId = null,
        eventType = 'message',
        accountId = null
    }) {
        if (commentId && automation?.comment_reply) {
            const commentReplySent = await instagram.replyToComment(commentId, automation.comment_reply);
            if (accountId) {
                await this._recordAutomationLog({
                    accountId,
                    recipientId: senderId,
                    senderName: senderId,
                    automationId: automation?.$id || null,
                    automationType: automation?.automation_type || 'comment',
                    eventType: 'comment',
                    source: 'worker_node_comment_reply',
                    message: commentReplySent ? 'Sent public comment reply' : 'Failed public comment reply',
                    payload: { comment_id: commentId, text: String(automation.comment_reply || '').trim() },
                    status: commentReplySent ? 'success' : 'failed'
                });
            }
        }

        const template = await this._resolveAutomationTemplate(automation, automation.account_id);
        if (!template) {
            return false;
        }

        await this._maybeSendSeenTypingPrelude(instagram, senderId, automation, chainState);
        const success = await this.sendRenderedTemplate(
            instagram,
            senderId,
            template,
            {
                sender_id: senderId,
                recipient_id: recipientId,
                message_text: String(messageText || '').trim()
            },
            watermarkPolicy,
            {
                actionUserId: automation?.user_id,
                fallbackActionUserId: ownerUserId,
                logContext: {
                    accountId,
                    recipientId: senderId,
                    senderName: senderId,
                    automationId: automation?.$id || null,
                    automationType: automation?.automation_type || 'dm',
                    eventType,
                    source: 'worker_node'
                }
            }
        );

        if (success) {
            await this._sendSuggestMoreFollowUp({
                instagram,
                senderId,
                recipientId,
                messageText,
                automation,
                automationAccountIds,
                watermarkPolicy,
                ownerUserId,
                eventType,
                accountId
            });
        }

        return success;
    }

    _cleanupLocalWelcomeCooldown(now = Date.now()) {
        for (const [conversationKey, expiresAt] of this.localWelcomeCooldown.entries()) {
            if (!Number.isFinite(expiresAt) || expiresAt <= now) {
                this.localWelcomeCooldown.delete(conversationKey);
            }
        }
    }

    _hasRecentWelcomeReply(conversationKey, options = {}) {
        if (options?.welcomeSentRecently === true || options?.meta?.welcomeSentRecently === true) {
            return true;
        }

        this._cleanupLocalWelcomeCooldown();
        const expiresAt = this.localWelcomeCooldown.get(conversationKey);
        return Number.isFinite(expiresAt) && expiresAt > Date.now();
    }

    _rememberWelcomeReply(conversationKey) {
        this._cleanupLocalWelcomeCooldown();
        this.localWelcomeCooldown.set(conversationKey, Date.now() + this.localWelcomeCooldownMs);
    }

    _normalizeConversationState(state) {
        const source = state && typeof state === 'object' ? state : {};
        const pendingEmail = source.pendingEmail && typeof source.pendingEmail === 'object'
            ? {
                automationId: String(source.pendingEmail.automationId || '').trim() || null,
                automationType: String(source.pendingEmail.automationType || 'dm').trim() || 'dm',
                collectEmailOnlyGmail: source.pendingEmail.collectEmailOnlyGmail === true,
                promptMessage: String(source.pendingEmail.promptMessage || DEFAULT_COLLECT_EMAIL_PROMPT).trim() || DEFAULT_COLLECT_EMAIL_PROMPT,
                failRetryMessage: String(source.pendingEmail.failRetryMessage || DEFAULT_COLLECT_EMAIL_FAIL_RETRY).trim() || DEFAULT_COLLECT_EMAIL_FAIL_RETRY,
                successReplyMessage: String(source.pendingEmail.successReplyMessage || DEFAULT_COLLECT_EMAIL_SUCCESS).trim() || DEFAULT_COLLECT_EMAIL_SUCCESS,
                sendTo: String(source.pendingEmail.sendTo || 'everyone').trim() || 'everyone',
                originalMessageText: String(source.pendingEmail.originalMessageText || '').trim(),
                receiverName: String(source.pendingEmail.receiverName || '').trim(),
                sourceEventType: String(source.pendingEmail.sourceEventType || 'message').trim() || 'message',
                commentId: String(source.pendingEmail.commentId || '').trim() || null,
                automationSnapshot: source.pendingEmail.automationSnapshot && typeof source.pendingEmail.automationSnapshot === 'object'
                    ? source.pendingEmail.automationSnapshot
                    : null
            }
            : null;

        const cooldowns = source.automationCooldowns && typeof source.automationCooldowns === 'object'
            ? Object.entries(source.automationCooldowns).reduce((acc, [automationId, expiresAt]) => {
                const safeAutomationId = String(automationId || '').trim();
                const expiry = Number(expiresAt || 0);
                if (safeAutomationId && Number.isFinite(expiry) && expiry > Date.now()) {
                    acc[safeAutomationId] = expiry;
                }
                return acc;
            }, {})
            : {};

        return {
            pendingEmail,
            automationCooldowns: cooldowns
        };
    }

    async _getConversationState(accountId, conversationKey) {
        const remoteState = await this.appwrite.getConversationState(accountId, conversationKey);
        if (remoteState?.state_json) {
            const normalized = this._normalizeConversationState(remoteState.state_json);
            this.localConversationStates.set(conversationKey, normalized);
            return normalized;
        }

        const localState = this.localConversationStates.get(conversationKey);
        const normalized = this._normalizeConversationState(localState);
        this.localConversationStates.set(conversationKey, normalized);
        return normalized;
    }

    async _saveConversationState(meta, state) {
        const normalized = this._normalizeConversationState(state);
        this.localConversationStates.set(meta.conversationKey, normalized);
        await this.appwrite.upsertConversationState({
            userId: meta.userId,
            accountId: meta.accountId,
            conversationKey: meta.conversationKey,
            senderId: meta.senderId,
            recipientId: meta.recipientId,
            stateData: normalized
        });
        return normalized;
    }

    async _clearConversationState(accountId, conversationKey) {
        this.localConversationStates.delete(conversationKey);
        await this.appwrite.clearConversationState(accountId, conversationKey);
    }

    _normalizeEmail(email) {
        const safeEmail = String(email || '').trim().toLowerCase();
        if (!safeEmail.includes('@')) return safeEmail;

        let [local, domain] = safeEmail.split('@');
        if (['gmail.com', 'googlemail.com'].includes(domain)) {
            local = local.split('+')[0].replace(/\./g, '');
            domain = 'gmail.com';
        }
        return `${local}@${domain}`;
    }

    _validateCollectedEmail(email, gmailOnly = false) {
        const rawEmail = String(email || '').trim();
        const normalizedEmail = this._normalizeEmail(rawEmail);
        const isValid = /^[\w.+-]+@[\w.-]+\.\w+$/i.test(rawEmail);
        if (!isValid) {
            return { valid: false, normalizedEmail };
        }

        if (gmailOnly && !normalizedEmail.endsWith('@gmail.com')) {
            return { valid: false, normalizedEmail };
        }

        return { valid: true, normalizedEmail };
    }

    _isFollowersRetryPayload(payload) {
        return String(payload || '').trim().toLowerCase().startsWith('followers_only_retry:');
    }

    _extractFollowersRetryAutomationId(payload) {
        if (!this._isFollowersRetryPayload(payload)) return '';
        return String(payload || '').trim().split(':').slice(1).join(':').trim();
    }

    _buildCollectedEmailDeliveryPayload({
        email,
        normalizedEmail,
        senderId,
        senderProfileUrl,
        receiverName,
        automation
    }) {
        return {
            email: String(email || '').trim(),
            normalized_email: String(normalizedEmail || '').trim(),
            sender_id: String(senderId || '').trim(),
            sender_profile_url: String(senderProfileUrl || '').trim(),
            receiver_name: String(receiverName || '').trim(),
            automation_id: String(automation?.$id || '').trim(),
            automation_title: String(automation?.title || '').trim(),
            automation_type: String(automation?.automation_type || 'dm').trim() || 'dm',
            received_at: new Date().toISOString()
        };
    }

    async _getCollectorDestinationOrFallback(automationId, accountId) {
        if (typeof this.appwrite.getEmailCollectorDestination === 'function') {
            return this.appwrite.getEmailCollectorDestination(automationId, accountId);
        }

        return {
            verified: true,
            destination_type: 'webhook',
            webhook_url: ''
        };
    }

    _isAutomationCoolingDown(state, automationId) {
        const safeAutomationId = String(automationId || '').trim();
        if (!safeAutomationId) return false;
        const expiresAt = Number(state?.automationCooldowns?.[safeAutomationId] || 0);
        return Number.isFinite(expiresAt) && expiresAt > Date.now();
    }

    _withAutomationCooldown(state, automationId, durationMs = AUTOMATION_COOLDOWN_MS) {
        const safeAutomationId = String(automationId || '').trim();
        if (!safeAutomationId) return this._normalizeConversationState(state);

        const nextState = this._normalizeConversationState(state);
        nextState.automationCooldowns[safeAutomationId] = Date.now() + Math.max(60_000, Number(durationMs || AUTOMATION_COOLDOWN_MS));
        return nextState;
    }

    async _resolveAutomationTemplate(automation, accountId) {
        const explicitTemplateId = String(automation?.template_id || '').trim();
        const legacyTemplateRef = String(automation?.template_content || '').trim();
        const candidateTemplateIds = Array.from(new Set(
            [explicitTemplateId, legacyTemplateRef].filter(Boolean)
        ));

        for (const candidateTemplateId of candidateTemplateIds) {
            const template = await this.appwrite.getTemplate(candidateTemplateId, accountId);
            if (template) return template;
        }

        if (explicitTemplateId) {
            const hasInlineFallback = Boolean(
                automation?.media_url
                || automation?.buttons
                || automation?.replies
                || automation?.template_elements
                || (
                    automation?.template_content
                    && String(automation.template_content).trim()
                    && String(automation.template_content).trim() !== String(automation.template_id).trim()
                )
            );

            if (!hasInlineFallback) {
                return null;
            }
        }
        return this.appwrite.buildAutomationTemplate(automation);
    }

    async _sendFollowersOnlyPrompt(instagram, senderId, igAccount, automation) {
        const automationDefaults = await this._getAutomationDefaults();
        const promptText = String(
            automation?.followers_only_message
            || automationDefaults.followers_only_message
            || DEFAULT_FOLLOWERS_ONLY_MESSAGE
        ).trim() || DEFAULT_FOLLOWERS_ONLY_MESSAGE;
        const profileUrl = igAccount?.username
            ? `https://www.instagram.com/${String(igAccount.username).trim()}/`
            : '';
        const buttons = [];

        if (profileUrl) {
            buttons.push({
                type: 'web_url',
                title: String(
                    automation?.followers_only_primary_button_text
                    || automationDefaults.followers_only_primary_button_text
                    || '👤 Follow Account'
                ).trim() || '👤 Follow Account',
                url: profileUrl
            });
        }

        buttons.push({
            type: 'postback',
            title: String(
                automation?.followers_only_secondary_button_text
                || automationDefaults.followers_only_secondary_button_text
                || "✅ I've Followed"
            ).trim() || "✅ I've Followed",
            payload: `followers_only_retry:${String(automation?.$id || '').trim()}`
        });

        const sent = await instagram.sendMessage(senderId, 'template_buttons', {
            text: promptText,
            buttons
        });
        const accountId = String(igAccount?.ig_user_id || igAccount?.account_id || '').trim();
        if (accountId) {
            await this._recordAutomationLog({
                accountId,
                recipientId: senderId,
                senderName: senderId,
                automationId: automation?.$id || null,
                automationType: automation?.automation_type || 'dm',
                eventType: 'message',
                source: 'worker_node_followers_only',
                message: sent ? 'Sent followers-only prompt' : 'Failed followers-only prompt',
                payload: { text: promptText, buttons },
                status: sent ? 'success' : 'failed'
            });
        }
        return sent;
    }

    async _handlePendingEmailCollection({
        instagram,
        senderId,
        messageText,
        accountId,
        conversationKey,
        state,
        userId,
        recipientId
    }) {
        const pendingEmail = state?.pendingEmail;
        if (!pendingEmail) return null;

        const validation = this._validateCollectedEmail(messageText, pendingEmail.collectEmailOnlyGmail === true);
        if (!validation.valid) {
            const retrySent = await instagram.sendMessage(senderId, 'template_text', {
                text: pendingEmail.failRetryMessage || DEFAULT_COLLECT_EMAIL_FAIL_RETRY
            });
            return {
                handled: true,
                automationType: pendingEmail.automationType || 'dm'
            };
        }

        const automation = typeof this.appwrite.getAutomation === 'function'
            ? await this.appwrite.getAutomation(pendingEmail.automationId, accountId)
            : pendingEmail.automationSnapshot;
        if (!automation) {
            console.warn(`Pending email automation ${pendingEmail.automationId} could not be loaded.`);
            await this._clearConversationState(accountId, conversationKey);
            return {
                handled: false,
                automationType: pendingEmail.automationType || 'dm'
            };
        }
        const executionState = await this.appwrite.getExecutionState(userId);
        if (!this._hasPlanFeature(executionState?.profile, 'collect_email')) {
            await this._clearConversationState(accountId, conversationKey);
            this._logBlockedFeatures({
                userId,
                accountId,
                automation,
                missingFeatures: ['collect_email'],
                reason: 'plan_feature_blocked',
                eventType: 'pending_email_feature_locked'
            });
            return {
                handled: false,
                automationType: 'invalid_due_to_plan'
            };
        }

        const destination = await this._getCollectorDestinationOrFallback(pendingEmail.automationId, accountId);
        if (!destination?.verified) {
            console.warn(
                `Email collector destination is missing or unverified for automation ${pendingEmail.automationId}.`
            );
            await this._clearConversationState(accountId, conversationKey);
            return {
                handled: false,
                automationType: pendingEmail.automationType || 'dm'
            };
        }

        const senderProfile = await instagram.getUserProfile(senderId);
        const senderProfileUrl = senderProfile?.username
            ? `https://www.instagram.com/${String(senderProfile.username).trim()}/`
            : '';
        const receiverName = pendingEmail.receiverName || '';
        const deliveryPayload = this._buildCollectedEmailDeliveryPayload({
            email: String(messageText || '').trim(),
            normalizedEmail: validation.normalizedEmail,
            senderId,
            senderProfileUrl,
            receiverName,
            automation
        });

        await this.appwrite.recordCollectedEmail({
            userId,
            accountId,
            automationId: pendingEmail.automationId,
            conversationKey,
            senderId,
            recipientId,
            email: String(messageText || '').trim(),
            normalizedEmail: validation.normalizedEmail,
            sendTo: pendingEmail.sendTo || 'everyone',
            senderProfileUrl,
            receiverName,
            automationTitle: automation?.title || '',
            automationType: automation?.automation_type || pendingEmail.automationType || 'dm'
        });

        try {
            await deliverCollectedEmail(destination, deliveryPayload);
        } catch (error) {
            console.warn(
                `Collected email delivery failed for ${pendingEmail.automationId}:`,
                error?.message || error
            );
        }

        const nextState = this._normalizeConversationState(state);
        nextState.pendingEmail = null;
        await this._saveConversationState({
            userId,
            accountId,
            conversationKey,
            senderId,
            recipientId
        }, nextState);

        const watermarkPolicy = await this._getWatermarkPolicyForUser(userId);
        await this._sendWatermarkedText(
            instagram,
            senderId,
            pendingEmail.successReplyMessage || DEFAULT_COLLECT_EMAIL_SUCCESS,
            watermarkPolicy,
            {
                actionUserId: userId,
                logContext: {
                    accountId,
                    recipientId: senderId,
                    senderName: senderId,
                    automationId: pendingEmail.automationId || null,
                    automationType: pendingEmail.automationType || 'dm',
                    eventType: pendingEmail.sourceEventType || 'message',
                    source: 'worker_node'
                }
            }
        );

        const template = await this._resolveAutomationTemplate(automation, automation.account_id);
        if (template) {
            if (pendingEmail.sourceEventType === 'comment' && pendingEmail.commentId && automation.comment_reply) {
                await instagram.replyToComment(pendingEmail.commentId, automation.comment_reply);
            }
            const chainState = { preReplyHintsSent: false };
            await this._maybeSendSeenTypingPrelude(instagram, senderId, automation, chainState);
            const sent = await this.sendRenderedTemplate(
                instagram,
                senderId,
                template,
                {
                    sender_id: senderId,
                    recipient_id: recipientId,
                    message_text: pendingEmail.originalMessageText || String(messageText || '').trim()
                },
                watermarkPolicy,
                {
                    actionUserId: userId,
                    logContext: {
                        accountId,
                        recipientId: senderId,
                        senderName: senderId,
                        automationId: automation?.$id || null,
                        automationType: automation?.automation_type || pendingEmail.automationType || 'dm',
                        eventType: pendingEmail.sourceEventType || 'message',
                        source: 'worker_node'
                    }
                }
            );

            await this._sendSuggestMoreFollowUp({
                instagram,
                senderId,
                recipientId,
                messageText: pendingEmail.originalMessageText || String(messageText || '').trim(),
                automation,
                automationAccountIds: [accountId],
                watermarkPolicy,
                ownerUserId: userId,
                eventType: pendingEmail.sourceEventType || 'message',
                accountId
            });
        }

        if (automation.once_per_user_24h === true) {
            const cooldownState = this._withAutomationCooldown({ pendingEmail: null, automationCooldowns: {} }, automation.$id);
            await this._saveConversationState({
                userId,
                accountId,
                conversationKey,
                senderId,
                recipientId
            }, cooldownState);
        }

        return {
            handled: true,
            automationType: pendingEmail.automationType || 'dm'
        };
    }

    _extractCommentEvent(webhookData) {
        const entry = webhookData.entry?.[0];
        const change = entry?.changes?.[0];
        const field = String(change?.field || '').trim().toLowerCase();
        if (field !== 'comments' && field !== 'live_comments') {
            return null;
        }

        const value = change?.value || {};
        const recipientId = String(value?.recipient?.id || entry?.id || '').trim();
        const senderId = String(
            value?.from?.id
            || value?.sender?.id
            || value?.user?.id
            || value?.author?.id
            || ''
        ).trim();

        return {
            field,
            recipientId,
            senderId,
            commentId: String(value?.id || value?.comment_id || '').trim(),
            mediaId: String(value?.media?.id || value?.media_id || '').trim(),
            text: String(value?.text || value?.message || '').trim()
        };
    }

    _extractMentionEvent(webhookData) {
        const entry = webhookData.entry?.[0];
        const change = entry?.changes?.[0];
        const field = String(change?.field || '').trim().toLowerCase();
        if (field !== 'mentions' && field !== 'story_mentions') {
            return null;
        }

        const value = change?.value || {};
        const recipientId = String(value?.recipient?.id || entry?.id || '').trim();
        const senderId = String(
            value?.from?.id
            || value?.sender?.id
            || value?.user?.id
            || value?.author?.id
            || ''
        ).trim();

        return {
            field,
            recipientId,
            senderId,
            mentionId: String(value?.id || value?.mention_id || '').trim(),
            mediaId: String(value?.media?.id || value?.media_id || '').trim(),
            text: String(
                value?.text
                || value?.message
                || value?.caption
                || value?.comment_text
                || value?.media?.caption
                || ''
            ).trim()
        };
    }

    _matchCommentAutomations(commentText, automations, { mediaId, isLive }) {
        const normalizedMediaId = String(mediaId || '').trim();
        const liveAutomations = (automations || []).filter((automation) => String(automation?.automation_type || '').trim().toLowerCase() === 'live');
        const mediaAutomations = (automations || []).filter((automation) => {
            const type = String(automation?.automation_type || '').trim().toLowerCase();
            return type === 'post' || type === 'reel';
        });
        const globalAutomations = (automations || []).filter((automation) => String(automation?.automation_type || '').trim().toLowerCase() === 'global');
        const result = {
            primary: null,
            global: null
        };

        const matchCommentAutomationGroup = (items) => {
            const matchedKeywordAutomation = AutomationMatcher.matchDM(
                commentText,
                (items || []).filter(isKeywordTrigger)
            );
            if (matchedKeywordAutomation) {
                return matchedKeywordAutomation;
            }
            return (items || []).find(isAllCommentsTrigger) || null;
        };

        if (isLive) {
            result.primary = matchCommentAutomationGroup(liveAutomations);
            result.global = matchCommentAutomationGroup(globalAutomations);
            return result;
        }

        const matchingMediaAutomations = mediaAutomations.filter((automation) => {
            const automationMediaId = String(automation?.media_id || automation?.linked_media_id || '').trim();
            return automationMediaId && automationMediaId === normalizedMediaId;
        });

        result.primary = matchCommentAutomationGroup(matchingMediaAutomations);
        result.global = matchCommentAutomationGroup(globalAutomations);
        return result;
    }

    async _processCommentEvent(webhookData, options = {}) {
        const commentEvent = this._extractCommentEvent(webhookData);
        if (!commentEvent?.recipientId || !commentEvent?.senderId || !commentEvent?.text) {
            return false;
        }

        const igAccount = await this.appwrite.getIGAccount(commentEvent.recipientId);
        if (!igAccount) {
            console.error(`IG account ${commentEvent.recipientId} not found for comment event.`);
            return false;
        }

        const { accessState, profile, actionLimitGate } = await this._getFreshExecutionGateState(igAccount.user_id, igAccount);
        if (actionLimitGate.blocked) {
            this._logAutomationDecision('comment', {
                user_id: igAccount.user_id,
                account_id: igAccount.$id || igAccount.account_id || igAccount.ig_user_id || null,
                gate_stage: actionLimitGate.stage,
                reason: actionLimitGate.reason,
                ban_mode: accessState?.ban_mode || 'none'
            });
            return { handled: false, automationType: actionLimitGate.reason };
        }

        const instagram = this._createInstagramClient(igAccount.access_token, igAccount.user_id, options?.metaApiUsageTracker, profile);
        const primaryAccountId = String(igAccount.ig_user_id || igAccount.account_id || commentEvent.recipientId).trim() || String(commentEvent.recipientId || '').trim();
        const automationAccountIds = this.getAutomationAccountIds(igAccount, primaryAccountId);
        const conversationKey = `${commentEvent.recipientId}:${commentEvent.senderId}`;
        const conversationState = await this._getConversationState(primaryAccountId, conversationKey);
        const automations = await this.appwrite.getActiveAutomations(automationAccountIds, ['post', 'reel', 'live', 'global']);
        if (!automations || automations.length === 0) {
            return { handled: false, automationType: 'automation_inactive' };
        }
        const matches = this._matchCommentAutomations(commentEvent.text, automations, {
            mediaId: commentEvent.mediaId,
            isLive: commentEvent.field === 'live_comments'
        });

        const shouldDualReply = Boolean(
            matches?.primary
            && matches?.global
            && (isAllCommentsTrigger(matches.primary) || isAllCommentsTrigger(matches.global))
        );
        const candidates = shouldDualReply
            ? [matches.primary, matches.global]
            : [matches.primary || matches.global].filter(Boolean);

        if (candidates.length === 0) {
            if (this._hasRecentWelcomeReply(conversationKey, options)) {
                return { handled: true, automationType: 'welcome_message' };
            }
            const welcomeAutomation = await this.appwrite.getActiveConfigAutomation(automationAccountIds, 'welcome_message');
            if (!welcomeAutomation) return false;
            candidates.push(welcomeAutomation);
        }

        const watermarkPolicy = await this._getWatermarkPolicyForUser(igAccount.user_id);
        const chainState = { preReplyHintsSent: false };
        let followStatusProfile = null;
        let handled = false;
        let lastAutomationType = 'global';
        let nextConversationState = this._normalizeConversationState(conversationState);

        for (const matchedAutomation of candidates) {
            if (!matchedAutomation) continue;
            const automationType = String(matchedAutomation.automation_type || 'global').trim() || 'global';
            lastAutomationType = automationType;
            const planGate = this._isAutomationAllowedByPlan(profile, matchedAutomation);
            if (!planGate.allowed) {
                this._logBlockedFeatures({
                    userId: igAccount.user_id,
                    accountId: igAccount.$id || igAccount.account_id || igAccount.ig_user_id || null,
                    automation: matchedAutomation,
                    missingFeatures: planGate.missing,
                    reason: planGate.invalidState ? 'invalid_due_to_plan' : 'plan_feature_blocked',
                    eventType: 'comment_feature_locked'
                });
                lastAutomationType = 'invalid_due_to_plan';
                continue;
            }

            if (matchedAutomation.once_per_user_24h === true && this._isAutomationCoolingDown(nextConversationState, matchedAutomation.$id)) {
                continue;
            }

            if (matchedAutomation.followers_only === true) {
                if (!followStatusProfile) {
                    followStatusProfile = await instagram.getUserProfile(commentEvent.senderId);
                }
                if (followStatusProfile?.is_user_follow_business !== true) {
                    await this._sendFollowersOnlyPrompt(instagram, commentEvent.senderId, igAccount, matchedAutomation);
                    return {
                        handled: true,
                        automationType
                    };
                }
            }

            const destination = matchedAutomation.collect_email_enabled === true
                ? await this._getCollectorDestinationOrFallback(matchedAutomation.$id, primaryAccountId)
                : null;
            if (matchedAutomation.collect_email_enabled === true) {
                if (!destination?.verified) {
                    console.warn(`Skipping collector-gated automation ${matchedAutomation.$id} because no verified destination exists.`);
                    return {
                        handled: false,
                        automationType
                    };
                }

            const automationDefaults = await this._getAutomationDefaults();
            const promptSent = await instagram.sendMessage(commentEvent.senderId, 'template_text', {
                text: String(
                    matchedAutomation.collect_email_prompt_message
                    || automationDefaults.collect_email_prompt_message
                    || DEFAULT_COLLECT_EMAIL_PROMPT
                ).trim() || DEFAULT_COLLECT_EMAIL_PROMPT
            });

                if (promptSent) {
                    await this._saveConversationState({
                        userId: igAccount.user_id,
                        accountId: primaryAccountId,
                        conversationKey,
                        senderId: commentEvent.senderId,
                        recipientId: commentEvent.recipientId
                    }, {
                        pendingEmail: {
                            automationId: String(matchedAutomation.$id || '').trim() || null,
                            automationType,
                            collectEmailOnlyGmail: matchedAutomation.collect_email_only_gmail === true,
                            promptMessage: String(matchedAutomation.collect_email_prompt_message || automationDefaults.collect_email_prompt_message || DEFAULT_COLLECT_EMAIL_PROMPT).trim() || DEFAULT_COLLECT_EMAIL_PROMPT,
                            failRetryMessage: String(matchedAutomation.collect_email_fail_retry_message || automationDefaults.collect_email_fail_retry_message || DEFAULT_COLLECT_EMAIL_FAIL_RETRY).trim() || DEFAULT_COLLECT_EMAIL_FAIL_RETRY,
                            successReplyMessage: String(matchedAutomation.collect_email_success_reply_message || automationDefaults.collect_email_success_reply_message || DEFAULT_COLLECT_EMAIL_SUCCESS).trim() || DEFAULT_COLLECT_EMAIL_SUCCESS,
                            sendTo: String(matchedAutomation.send_to || 'everyone').trim() || 'everyone',
                            originalMessageText: commentEvent.text,
                            receiverName: String(igAccount.username || '').trim(),
                            sourceEventType: 'comment',
                            commentId: commentEvent.commentId || null,
                            automationSnapshot: matchedAutomation
                        },
                        automationCooldowns: nextConversationState.automationCooldowns || {}
                    });
                }

                return {
                    handled: promptSent,
                    automationType
                };
            }

            const success = await this._sendAutomationReply({
                instagram,
                senderId: commentEvent.senderId,
                recipientId: commentEvent.recipientId,
                messageText: commentEvent.text,
                automation: matchedAutomation,
                automationAccountIds,
                watermarkPolicy,
                chainState,
                commentId: commentEvent.commentId || null,
                ownerUserId: igAccount.user_id,
                eventType: 'comment',
                accountId: primaryAccountId
            });

            handled = handled || success === true;
            if (success && automationType === 'welcome_message') {
                this._rememberWelcomeReply(conversationKey);
            }
            if (success && matchedAutomation.once_per_user_24h === true) {
                nextConversationState = this._withAutomationCooldown(nextConversationState, matchedAutomation.$id);
            }
        }

        if (handled) {
            const hasCooldowns = Object.keys(nextConversationState.automationCooldowns || {}).length > 0;
            if (hasCooldowns) {
                await this._saveConversationState({
                    userId: igAccount.user_id,
                    accountId: primaryAccountId,
                    conversationKey,
                    senderId: commentEvent.senderId,
                    recipientId: commentEvent.recipientId
                }, nextConversationState);
            } else {
                await this._clearConversationState(primaryAccountId, conversationKey);
            }
        }

        return {
            handled,
            automationType: lastAutomationType
        };
    }

    async _processMentionEvent(webhookData, options = {}) {
        const mentionEvent = this._extractMentionEvent(webhookData);
        if (!mentionEvent?.recipientId || !mentionEvent?.senderId) {
            return false;
        }

        const igAccount = await this.appwrite.getIGAccount(mentionEvent.recipientId);
        if (!igAccount) {
            return false;
        }

        const { accessState, profile, actionLimitGate } = await this._getFreshExecutionGateState(igAccount.user_id, igAccount);
        if (actionLimitGate.blocked) {
            this._logAutomationDecision('mention', {
                user_id: igAccount.user_id,
                account_id: igAccount.$id || igAccount.account_id || igAccount.ig_user_id || null,
                gate_stage: actionLimitGate.stage,
                reason: actionLimitGate.reason,
                ban_mode: accessState?.ban_mode || 'none'
            });
            return { handled: false, automationType: actionLimitGate.reason };
        }

        const instagram = this._createInstagramClient(igAccount.access_token, igAccount.user_id, options?.metaApiUsageTracker, profile);
        const primaryAccountId = String(igAccount.ig_user_id || igAccount.account_id || mentionEvent.recipientId).trim() || String(mentionEvent.recipientId || '').trim();
        const automationAccountIds = this.getAutomationAccountIds(igAccount, primaryAccountId);
        const conversationKey = `${mentionEvent.recipientId}:${mentionEvent.senderId}`;
        const conversationState = await this._getConversationState(primaryAccountId, conversationKey);

        let matchedAutomation = await this.appwrite.getActiveConfigAutomation(automationAccountIds, 'mentions');
        if (!matchedAutomation) {
            const globalAutomations = await this.appwrite.getActiveAutomations(automationAccountIds, ['global']);
            matchedAutomation = AutomationMatcher.matchDM(mentionEvent.text, globalAutomations);
        }
        if (!matchedAutomation) {
            if (this._hasRecentWelcomeReply(conversationKey, options)) {
                return { handled: true, automationType: 'welcome_message' };
            }
            matchedAutomation = await this.appwrite.getActiveConfigAutomation(automationAccountIds, 'welcome_message');
            if (!matchedAutomation) {
                return false;
            }
        }

        const automationType = String(matchedAutomation.automation_type || 'mentions').trim() || 'mentions';
        const planGate = this._isAutomationAllowedByPlan(profile, matchedAutomation);
        if (!planGate.allowed) {
            this._logBlockedFeatures({
                userId: igAccount.user_id,
                accountId: igAccount.$id || igAccount.account_id || igAccount.ig_user_id || null,
                automation: matchedAutomation,
                missingFeatures: planGate.missing,
                reason: planGate.invalidState ? 'invalid_due_to_plan' : 'plan_feature_blocked',
                eventType: 'mention_feature_locked'
            });
            return { handled: false, automationType: 'invalid_due_to_plan' };
        }
        if (matchedAutomation.once_per_user_24h === true && this._isAutomationCoolingDown(conversationState, matchedAutomation.$id)) {
            return { handled: true, automationType };
        }

        if (matchedAutomation.followers_only === true) {
            const profile = await instagram.getUserProfile(mentionEvent.senderId);
            if (profile?.is_user_follow_business !== true) {
                await this._sendFollowersOnlyPrompt(instagram, mentionEvent.senderId, igAccount, matchedAutomation);
                return { handled: true, automationType };
            }
        }

        const destination = matchedAutomation.collect_email_enabled === true
            ? await this._getCollectorDestinationOrFallback(matchedAutomation.$id, primaryAccountId)
            : null;
        if (matchedAutomation.collect_email_enabled === true) {
            if (!destination?.verified) {
                return { handled: false, automationType };
            }

            const automationDefaults = await this._getAutomationDefaults();
            const promptSent = await instagram.sendMessage(mentionEvent.senderId, 'template_text', {
                text: String(
                    matchedAutomation.collect_email_prompt_message
                    || automationDefaults.collect_email_prompt_message
                    || DEFAULT_COLLECT_EMAIL_PROMPT
                ).trim() || DEFAULT_COLLECT_EMAIL_PROMPT
            });

            if (promptSent) {
                await this._saveConversationState({
                    userId: igAccount.user_id,
                    accountId: primaryAccountId,
                    conversationKey,
                    senderId: mentionEvent.senderId,
                    recipientId: mentionEvent.recipientId
                }, {
                    pendingEmail: {
                        automationId: String(matchedAutomation.$id || '').trim() || null,
                        automationType,
                        collectEmailOnlyGmail: matchedAutomation.collect_email_only_gmail === true,
                        promptMessage: String(matchedAutomation.collect_email_prompt_message || automationDefaults.collect_email_prompt_message || DEFAULT_COLLECT_EMAIL_PROMPT).trim() || DEFAULT_COLLECT_EMAIL_PROMPT,
                        failRetryMessage: String(matchedAutomation.collect_email_fail_retry_message || automationDefaults.collect_email_fail_retry_message || DEFAULT_COLLECT_EMAIL_FAIL_RETRY).trim() || DEFAULT_COLLECT_EMAIL_FAIL_RETRY,
                        successReplyMessage: String(matchedAutomation.collect_email_success_reply_message || automationDefaults.collect_email_success_reply_message || DEFAULT_COLLECT_EMAIL_SUCCESS).trim() || DEFAULT_COLLECT_EMAIL_SUCCESS,
                        sendTo: String(matchedAutomation.send_to || 'everyone').trim() || 'everyone',
                        originalMessageText: mentionEvent.text,
                        receiverName: String(igAccount.username || '').trim(),
                        sourceEventType: 'mention',
                        commentId: null,
                        automationSnapshot: matchedAutomation
                    },
                    automationCooldowns: conversationState.automationCooldowns || {}
                });
            }

            return { handled: promptSent, automationType };
        }

        const watermarkPolicy = await this._getWatermarkPolicyForUser(igAccount.user_id);
        const success = await this._sendAutomationReply({
            instagram,
            senderId: mentionEvent.senderId,
            recipientId: mentionEvent.recipientId,
            messageText: mentionEvent.text,
            automation: matchedAutomation,
            automationAccountIds,
            watermarkPolicy,
            chainState: { preReplyHintsSent: false },
            ownerUserId: igAccount.user_id,
            eventType: 'mention',
            accountId: primaryAccountId
        });

        let nextConversationState = this._normalizeConversationState(conversationState);
        if (success && automationType === 'welcome_message') {
            this._rememberWelcomeReply(conversationKey);
        }
        if (success && matchedAutomation.once_per_user_24h === true) {
            nextConversationState = this._withAutomationCooldown(nextConversationState, matchedAutomation.$id);
        }

        if (success) {
            const hasCooldowns = Object.keys(nextConversationState.automationCooldowns || {}).length > 0;
            if (hasCooldowns) {
                await this._saveConversationState({
                    userId: igAccount.user_id,
                    accountId: primaryAccountId,
                    conversationKey,
                    senderId: mentionEvent.senderId,
                    recipientId: mentionEvent.recipientId
                }, nextConversationState);
            } else {
                await this._clearConversationState(primaryAccountId, conversationKey);
            }
        }

        return { handled: success, automationType };
    }

    /**
     * Process an incoming message webhook.
     * 
     * @param {Object} webhookData - Instagram webhook payload
     * @returns {Promise<boolean|{handled: boolean, automationType?: string}>} - Processing result
     */
    async processMessage(webhookData, options = {}) {
        try {
            // Instagram webhook structure is complex: entry -> messaging -> message
            const entry = webhookData.entry?.[0];
            const messaging = entry?.messaging?.[0];
            const change = entry?.changes?.[0];

            if (!messaging) {
                if (change) {
                    const changeField = String(change?.field || '').trim().toLowerCase();
                    if (changeField === 'mentions' || changeField === 'story_mentions') {
                        return this._processMentionEvent(webhookData, options);
                    }
                    return this._processCommentEvent(webhookData, options);
                }
                console.log('Not a messaging event, skipping.');
                return false;
            }

            const recipientId = entry.id; // The Page/IG Account receiving the message
            const senderId = messaging.sender.id; // The User sending the message
            const message = messaging.message;
            const postback = messaging.postback;
            const conversationKey = senderId && recipientId ? `${recipientId}:${senderId}` : `${recipientId}:unknown`;
            const inboundText = String(
                message?.text
                || postback?.title
                || postback?.payload
                || ''
            ).trim();

            if (!inboundText) {
                console.log('No message or postback text found, skipping.');
                return false;
            }

            if (message?.is_echo === true) {
                console.log('Ignoring echoed outbound Instagram message.');
                return false;
            }

            console.log(`Processing message from ${senderId}: "${inboundText}"`);

            // 1. Get the IG Account from Appwrite to get the access token
            console.log(`Fetching IG account for recipient: ${recipientId}`);
            const igAccount = await this.appwrite.getIGAccount(recipientId);
            if (!igAccount) {
                console.error(`IG account ${recipientId} not found in database.`);
                return false;
            }
            console.log(`IG account found: ${igAccount.username}`);
            const { accessState, profile, actionLimitGate } = await this._getFreshExecutionGateState(igAccount.user_id, igAccount);
            if (actionLimitGate.blocked) {
                this._logAutomationDecision('dm', {
                    user_id: igAccount.user_id,
                    account_id: igAccount.$id || igAccount.account_id || igAccount.ig_user_id || null,
                    gate_stage: actionLimitGate.stage,
                    reason: actionLimitGate.reason,
                    ban_mode: accessState?.ban_mode || 'none'
                });
                return {
                    handled: false,
                    automationType: actionLimitGate.reason
                };
            }

            const accessToken = igAccount.access_token;
            const primaryAccountId = String(igAccount.ig_user_id || igAccount.account_id || recipientId).trim() || String(recipientId || '').trim();
            const automationAccountIds = this.getAutomationAccountIds(igAccount, primaryAccountId);
            const businessIdentifiers = new Set(automationAccountIds);

            if (businessIdentifiers.has(String(senderId || '').trim())) {
                console.log(`Ignoring self-authored business message event from ${senderId}.`);
                return false;
            }

            const instagram = this._createInstagramClient(accessToken, igAccount.user_id, options?.metaApiUsageTracker, profile);
            const conversationState = await this._getConversationState(primaryAccountId, conversationKey);

            const pendingEmailResult = await this._handlePendingEmailCollection({
                instagram,
                senderId,
                messageText: inboundText,
                accountId: primaryAccountId,
                conversationKey,
                state: conversationState,
                userId: igAccount.user_id,
                recipientId
            });
            if (pendingEmailResult) {
                return pendingEmailResult;
            }

            // 2. Get active automations for this account
            console.log(`Fetching active automations for account identifiers: ${automationAccountIds.join(', ')}`);
            const automations = await this.appwrite.getActiveAutomations(automationAccountIds) || [];
            if (automations.length === 0) {
                console.log(`No active DM automations for account ${recipientId}.`);
            } else {
                console.log(`Found ${automations.length} active automations.`);
            }

            // 3. Match the message against automation rules
            console.log(`Matching message: "${inboundText}"`);
            let matchedAutomation = null;
            const followersRetryAutomationId = this._extractFollowersRetryAutomationId(postback?.payload);
            if (followersRetryAutomationId) {
                matchedAutomation = automations.find((automation) => String(automation?.$id || '').trim() === followersRetryAutomationId) || null;
                console.log(`Followers-only retry requested for automation ${followersRetryAutomationId}.`);
            } else {
                const specificAutomations = automations.filter((automation) => {
                    const automationType = String(automation?.automation_type || '').trim().toLowerCase();
                    return automationType !== 'global';
                });
                matchedAutomation = AutomationMatcher.matchDM(inboundText, specificAutomations);
                if (!matchedAutomation) {
                    const globalAutomations = automations.filter((automation) => String(automation?.automation_type || '').trim().toLowerCase() === 'global');
                    matchedAutomation = AutomationMatcher.matchDM(inboundText, globalAutomations);
                }
            }
            if (!matchedAutomation) {
                console.log(`No keyword match for: ${inboundText}`);

                if (this._hasRecentWelcomeReply(conversationKey, options)) {
                    console.log(`Welcome message already sent inside the 24-hour window for ${conversationKey}.`);
                    return {
                        handled: true,
                        automationType: 'welcome_message'
                    };
                }

                const welcomeAutomation = await this.appwrite.getActiveConfigAutomation(
                    automationAccountIds,
                    'welcome_message'
                );

                if (!welcomeAutomation) {
                    console.log(`No active welcome message automation for account ${recipientId}.`);
                    return false;
                }

                matchedAutomation = welcomeAutomation;
                console.log(`Falling back to welcome message automation: ${matchedAutomation.title || matchedAutomation.$id}`);
            }

            const automationType = String(matchedAutomation.automation_type || 'dm').trim() || 'dm';
            console.log(`Matched automation: ${matchedAutomation.title || matchedAutomation.$id}`);
            const planGate = this._isAutomationAllowedByPlan(profile, matchedAutomation);
            if (!planGate.allowed) {
                this._logBlockedFeatures({
                    userId: igAccount.user_id,
                    accountId: igAccount.$id || igAccount.account_id || igAccount.ig_user_id || null,
                    automation: matchedAutomation,
                    missingFeatures: planGate.missing,
                    reason: planGate.invalidState ? 'invalid_due_to_plan' : 'plan_feature_blocked',
                    eventType: 'dm_feature_locked'
                });
                return {
                    handled: false,
                    automationType: 'invalid_due_to_plan'
                };
            }

            if (matchedAutomation.once_per_user_24h === true && this._isAutomationCoolingDown(conversationState, matchedAutomation.$id)) {
                console.log(`Skipping automation ${matchedAutomation.$id || matchedAutomation.title || automationType} due to 24h cooldown.`);
                return {
                    handled: true,
                    automationType
                };
            }

            // Followers-only guard:
            // Use Instagram User Profile API to verify whether sender follows business account.
            if (matchedAutomation.followers_only === true) {
                console.log(`Followers-only automation enabled. Checking follow status for sender ${senderId}...`);
                const profile = await instagram.getUserProfile(senderId);
                const followsBusiness = profile?.is_user_follow_business === true;

                if (!followsBusiness) {
                    console.log(
                        `Sender ${senderId} is not following the business account. Sending follow prompt instead of template reply.`
                    );
                    const gated = await this._sendFollowersOnlyPrompt(instagram, senderId, igAccount, matchedAutomation);
                    return {
                        handled: gated === true,
                        automationType
                    };
                }
            }

            const collectorDestination = matchedAutomation.collect_email_enabled === true
                ? await this._getCollectorDestinationOrFallback(matchedAutomation.$id, primaryAccountId)
                : null;
            if (matchedAutomation.collect_email_enabled === true) {
                const automationDefaults = await this._getAutomationDefaults();
                if (!collectorDestination?.verified) {
                    console.warn(
                        `Skipping collector-gated automation ${matchedAutomation.$id || matchedAutomation.title || automationType} because no verified destination exists.`
                    );
                    return {
                        handled: false,
                        automationType
                    };
                }

                const promptSent = await instagram.sendMessage(senderId, 'template_text', {
                    text: String(
                        matchedAutomation.collect_email_prompt_message
                        || automationDefaults.collect_email_prompt_message
                        || DEFAULT_COLLECT_EMAIL_PROMPT
                    ).trim() || DEFAULT_COLLECT_EMAIL_PROMPT
                });

                if (promptSent) {
                    let nextConversationState = this._normalizeConversationState(conversationState);
                    nextConversationState.pendingEmail = {
                        automationId: String(matchedAutomation.$id || '').trim() || null,
                        automationType,
                        collectEmailOnlyGmail: matchedAutomation.collect_email_only_gmail === true,
                        promptMessage: String(matchedAutomation.collect_email_prompt_message || automationDefaults.collect_email_prompt_message || DEFAULT_COLLECT_EMAIL_PROMPT).trim() || DEFAULT_COLLECT_EMAIL_PROMPT,
                        failRetryMessage: String(matchedAutomation.collect_email_fail_retry_message || automationDefaults.collect_email_fail_retry_message || DEFAULT_COLLECT_EMAIL_FAIL_RETRY).trim() || DEFAULT_COLLECT_EMAIL_FAIL_RETRY,
                        successReplyMessage: String(matchedAutomation.collect_email_success_reply_message || automationDefaults.collect_email_success_reply_message || DEFAULT_COLLECT_EMAIL_SUCCESS).trim() || DEFAULT_COLLECT_EMAIL_SUCCESS,
                        sendTo: String(matchedAutomation.send_to || 'everyone').trim() || 'everyone',
                        originalMessageText: inboundText,
                        receiverName: String(igAccount.username || '').trim(),
                        sourceEventType: 'message',
                        commentId: null,
                        automationSnapshot: matchedAutomation
                    };
                    await this._saveConversationState({
                        userId: igAccount.user_id,
                        accountId: primaryAccountId,
                        conversationKey,
                        senderId,
                        recipientId
                    }, nextConversationState);
                }

                return {
                    handled: promptSent,
                    automationType
                };
            }

            // 4. Get the template for the automation
            const template = await this._resolveAutomationTemplate(matchedAutomation, matchedAutomation.account_id);
            if (!template) {
                console.error(`Template for automation ${matchedAutomation.$id || matchedAutomation.title || automationType} not found.`);
                return false;
            }

            // 5. Render the template
            const context = {
                sender_id: senderId,
                recipient_id: recipientId,
                message_text: inboundText,
                // Add more context if needed, e.g. from profiles collection
            };
            const watermarkPolicy = await this._getWatermarkPolicyForUser(igAccount.user_id);
            const chainState = { preReplyHintsSent: false };
            await this._maybeSendSeenTypingPrelude(instagram, senderId, matchedAutomation, chainState);

            // 6. Send the message via Instagram API
            const success = await this.sendRenderedTemplate(
                instagram,
                senderId,
                template,
                context,
                watermarkPolicy,
                {
                    actionUserId: igAccount.user_id,
                    logContext: {
                        accountId: primaryAccountId,
                        recipientId: senderId,
                        senderName: senderId,
                        automationId: matchedAutomation.$id || null,
                        automationType,
                        eventType: String(options?.meta?.eventType || 'message').trim() || 'message',
                        source: 'worker_node'
                    }
                }
            );

            let nextConversationState = this._normalizeConversationState(conversationState);
            if (success && automationType === 'welcome_message') {
                this._rememberWelcomeReply(conversationKey);
            }

            if (success && matchedAutomation.once_per_user_24h === true) {
                nextConversationState = this._withAutomationCooldown(nextConversationState, matchedAutomation.$id);
            }

            if (success) {
                await this._sendSuggestMoreFollowUp({
                    instagram,
                    senderId,
                    recipientId,
                    messageText: inboundText,
                    automation: matchedAutomation,
                    automationAccountIds,
                    watermarkPolicy,
                    ownerUserId: igAccount.user_id,
                    eventType: String(options?.meta?.eventType || 'message').trim() || 'message',
                    accountId: primaryAccountId
                });
            }

            if (nextConversationState.pendingEmail?.automationId === String(matchedAutomation.$id || '').trim()) {
                nextConversationState.pendingEmail = null;
            }

            if (success) {
                const hasCooldowns = Object.keys(nextConversationState.automationCooldowns || {}).length > 0;
                if (nextConversationState.pendingEmail || hasCooldowns) {
                    await this._saveConversationState({
                        userId: igAccount.user_id,
                        accountId: primaryAccountId,
                        conversationKey,
                        senderId,
                        recipientId
                    }, nextConversationState);
                } else {
                    await this._clearConversationState(primaryAccountId, conversationKey);
                }
            }

            return {
                handled: success,
                automationType
            };
        } catch (error) {
            console.error('Error in DMWorker.processMessage:', error);
            if (options?.throwOnError === true) {
                throw error;
            }
            return false;
        }
    }

    async processWebhook(webhookData, options = {}) {
        const meta = this._extractEventMetaFromWebhook(webhookData, options);
        const shouldClaim = Boolean(
            meta?.eventKey
            && meta?.accountId
            && typeof this.appwrite?.claimProcessingEvent === 'function'
            && typeof this.appwrite?.finalizeProcessingEvent === 'function'
        );

        if (this._wasProcessedRecently(meta)) {
            return { handled: true, duplicate: true, automationType: 'duplicate_event' };
        }

        let claim = null;
        if (shouldClaim) {
            claim = await this.appwrite.claimProcessingEvent(meta, {
                processingTtlMs: PROCESSING_LOCK_TTL_MS,
                dedupeTtlMs: EVENT_DEDUPE_TTL_MS
            });
            if (!claim?.claimed) {
                this._rememberProcessedEvent(meta, EVENT_DEDUPE_TTL_MS);
                return { handled: true, duplicate: true, automationType: 'duplicate_event' };
            }
        }

        const metaApiUsageTracker = options?.metaApiUsageTracker || { counts: new Map(), flushed: false };

        try {
            const result = await this.processMessage(webhookData, {
                ...options,
                meta,
                metaApiUsageTracker,
                throwOnError: options?.throwOnError !== false
            });
            await this._flushMetaApiActionUsage(metaApiUsageTracker);
            this._rememberProcessedEvent(meta, EVENT_DEDUPE_TTL_MS);
            if (claim?.claimed) {
                await this.appwrite.finalizeProcessingEvent(claim, {
                    status: 'completed',
                    dedupeTtlMs: EVENT_DEDUPE_TTL_MS
                });
            }
            return result;
        } catch (error) {
            await this._flushMetaApiActionUsage(metaApiUsageTracker);
            if (claim?.claimed) {
                await this.appwrite.finalizeProcessingEvent(claim, {
                    status: 'failed',
                    error: error?.message || error,
                    dedupeTtlMs: 1000
                });
            }
            throw error;
        }
    }
}

module.exports = DMWorker;

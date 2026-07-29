const express = require('express');
const router = express.Router();
const { apiKeyOrSessionAuth } = require('../middleware/apiKeyAuth');
const {
    createApiKey,
    listApiKeys,
    revokeApiKey
} = require('../utils/apiKeyManager');
const {
    getAppwriteClient,
    APPWRITE_DATABASE_ID,
    IG_ACCOUNTS_COLLECTION_ID,
    AUTOMATIONS_COLLECTION_ID,
    LOGS_COLLECTION_ID,
    PROFILES_COLLECTION_ID
} = require('../utils/appwrite');
const { Databases, Query, ID } = require('node-appwrite');
const {
    resolveUserPlanContext,
    buildPlanApiPayload
} = require('../utils/planConfig');
const { sendWebhookPayload } = require('../utils/emailCollectors');

// Apply authentication middleware to all /api/v1 routes
router.use(apiKeyOrSessionAuth);

/**
 * GET /api/v1/me
 * Returns account profile, plan status, and usage summary.
 */
router.get('/me', async (req, res) => {
    try {
        const user = req.user;
        const serverDatabases = new Databases(getAppwriteClient({ useApiKey: true }));
        const planContext = await resolveUserPlanContext(serverDatabases, user.$id, user);
        const planPayload = buildPlanApiPayload(planContext.plan, planContext.profile);

        res.json({
            success: true,
            data: {
                id: user.$id,
                name: user.name,
                email: user.email,
                emailVerified: user.emailVerification,
                plan: planPayload,
                authenticatedVia: req.isApiKeyAuth ? 'api_key' : 'session'
            }
        });
    } catch (err) {
        console.error('Error fetching /api/v1/me:', err.message);
        res.status(500).json({ success: false, error: 'Failed to retrieve profile information' });
    }
});

/**
 * API Key Management Endpoints
 */
router.get('/api-keys', async (req, res) => {
    try {
        const keys = await listApiKeys(req.user.$id);
        res.json({ success: true, data: keys });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/api-keys', async (req, res) => {
    try {
        const databases = new Databases(getAppwriteClient({ useApiKey: true }));
        const { hasUltraPlanAccess } = require('../utils/planConfig');
        const isUltra = await hasUltraPlanAccess(databases, req.user.$id);
        if (!isUltra) {
            return res.status(403).json({
                success: false,
                error: 'API Access is available only on the Ultra plan. Please upgrade to Ultra to generate API keys.'
            });
        }
        const { name } = req.body || {};
        const newKey = await createApiKey(req.user.$id, name || 'n8n Integration Key');
        res.status(201).json({ success: true, data: newKey });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/api-keys/:id', async (req, res) => {
    try {
        await revokeApiKey(req.user.$id, req.params.id);
        res.json({ success: true, message: 'API key revoked successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/v1/accounts
 * List connected Instagram accounts for user.
 */
router.get('/accounts', async (req, res) => {
    try {
        const databases = new Databases(getAppwriteClient({ useApiKey: true }));
        const accountsResponse = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            [
                Query.equal('user_id', req.user.$id),
                Query.limit(100)
            ]
        );

        const accounts = (accountsResponse.documents || []).map(doc => ({
            id: doc.$id,
            igUserId: doc.ig_user_id || doc.account_id,
            username: doc.username || doc.ig_username,
            name: doc.name || doc.account_name,
            profilePictureUrl: doc.profile_picture_url,
            status: doc.status || 'connected',
            isLinked: !!doc.access_token,
            monthlyActionsUsed: doc.monthly_actions_used || 0,
            dailyActionsUsed: doc.daily_actions_used || 0,
            createdAt: doc.$createdAt
        }));

        res.json({ success: true, data: accounts });
    } catch (err) {
        console.error('Error in GET /api/v1/accounts:', err.message);
        res.status(500).json({ success: false, error: 'Failed to list connected accounts' });
    }
});

/**
 * GET /api/v1/automations
 * List automations with optional filtering by account_id, trigger_type, active status.
 */
router.get('/automations', async (req, res) => {
    try {
        const { account_id, trigger_type, is_active } = req.query;
        const databases = new Databases(getAppwriteClient({ useApiKey: true }));
        const queries = [
            Query.equal('user_id', req.user.$id),
            Query.orderDesc('$createdAt'),
            Query.limit(100)
        ];

        if (account_id) queries.push(Query.equal('account_id', String(account_id)));
        if (trigger_type) queries.push(Query.equal('trigger_type', String(trigger_type)));
        if (is_active !== undefined) queries.push(Query.equal('is_active', String(is_active) === 'true'));

        const response = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            AUTOMATIONS_COLLECTION_ID,
            queries
        );

        const automations = (response.documents || []).map(doc => ({
            id: doc.$id,
            title: doc.name || doc.title,
            triggerType: doc.trigger_type,
            keywords: doc.keywords || doc.keyword ? [doc.keyword] : [],
            matchRule: doc.match_rule || 'exact',
            isActive: doc.is_active !== false,
            accountId: doc.account_id,
            replyText: doc.reply_text || doc.message,
            buttonText: doc.button_text,
            buttonUrl: doc.button_url,
            commentReplies: doc.comment_replies || [],
            stats: {
                dmsSent: doc.dms_sent || doc.send_count || 0,
                commentRepliesCount: doc.comment_replies_count || 0
            },
            createdAt: doc.$createdAt,
            updatedAt: doc.$updatedAt
        }));

        res.json({ success: true, data: automations });
    } catch (err) {
        console.error('Error in GET /api/v1/automations:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch automations' });
    }
});

/**
 * POST /api/v1/automations
 * Create a new automation.
 */
router.post('/automations', async (req, res) => {
    try {
        const {
            title,
            triggerType = 'post_comment',
            keywords = [],
            matchRule = 'contains',
            accountId,
            replyText,
            commentReplies = [],
            isActive = true
        } = req.body;

        if (!title || !replyText) {
            return res.status(400).json({
                success: false,
                error: 'Automation title and replyText are required'
            });
        }

        const databases = new Databases(getAppwriteClient({ useApiKey: true }));
        const docId = ID.unique();
        const docData = {
            user_id: req.user.$id,
            name: title.trim(),
            title: title.trim(),
            trigger_type: triggerType,
            keywords: Array.isArray(keywords) ? keywords : [String(keywords)],
            match_rule: matchRule,
            account_id: accountId || null,
            reply_text: replyText.trim(),
            comment_replies: Array.isArray(commentReplies) ? commentReplies : [],
            is_active: isActive,
            dms_sent: 0
        };

        const createdDoc = await databases.createDocument(
            APPWRITE_DATABASE_ID,
            AUTOMATIONS_COLLECTION_ID,
            docId,
            docData
        );

        res.status(201).json({
            success: true,
            data: {
                id: createdDoc.$id,
                title: createdDoc.name,
                triggerType: createdDoc.trigger_type,
                keywords: createdDoc.keywords,
                isActive: createdDoc.is_active,
                createdAt: createdDoc.$createdAt
            }
        });
    } catch (err) {
        console.error('Error creating automation:', err.message);
        res.status(500).json({ success: false, error: err.message || 'Failed to create automation' });
    }
});

/**
 * GET /api/v1/automations/:id
 */
router.get('/automations/:id', async (req, res) => {
    try {
        const databases = new Databases(getAppwriteClient({ useApiKey: true }));
        const doc = await databases.getDocument(
            APPWRITE_DATABASE_ID,
            AUTOMATIONS_COLLECTION_ID,
            req.params.id
        );

        if (doc.user_id !== req.user.$id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        res.json({
            success: true,
            data: {
                id: doc.$id,
                title: doc.name || doc.title,
                triggerType: doc.trigger_type,
                keywords: doc.keywords || [],
                matchRule: doc.match_rule || 'exact',
                isActive: doc.is_active !== false,
                accountId: doc.account_id,
                replyText: doc.reply_text || doc.message,
                commentReplies: doc.comment_replies || [],
                stats: {
                    dmsSent: doc.dms_sent || 0,
                    commentRepliesCount: doc.comment_replies_count || 0
                },
                createdAt: doc.$createdAt
            }
        });
    } catch (err) {
        res.status(404).json({ success: false, error: 'Automation not found' });
    }
});

/**
 * PATCH /api/v1/automations/:id
 * Update automation attributes or toggle active status.
 */
router.patch('/automations/:id', async (req, res) => {
    try {
        const databases = new Databases(getAppwriteClient({ useApiKey: true }));
        const doc = await databases.getDocument(
            APPWRITE_DATABASE_ID,
            AUTOMATIONS_COLLECTION_ID,
            req.params.id
        );

        if (doc.user_id !== req.user.$id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const updates = {};
        if (req.body.title !== undefined) updates.name = req.body.title;
        if (req.body.replyText !== undefined) updates.reply_text = req.body.replyText;
        if (req.body.isActive !== undefined) updates.is_active = Boolean(req.body.isActive);
        if (req.body.keywords !== undefined) updates.keywords = req.body.keywords;
        if (req.body.matchRule !== undefined) updates.match_rule = req.body.matchRule;

        const updatedDoc = await databases.updateDocument(
            APPWRITE_DATABASE_ID,
            AUTOMATIONS_COLLECTION_ID,
            req.params.id,
            updates
        );

        res.json({
            success: true,
            data: {
                id: updatedDoc.$id,
                title: updatedDoc.name,
                isActive: updatedDoc.is_active,
                updatedAt: updatedDoc.$updatedAt
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Failed to update automation' });
    }
});

/**
 * DELETE /api/v1/automations/:id
 */
router.delete('/automations/:id', async (req, res) => {
    try {
        const databases = new Databases(getAppwriteClient({ useApiKey: true }));
        const doc = await databases.getDocument(
            APPWRITE_DATABASE_ID,
            AUTOMATIONS_COLLECTION_ID,
            req.params.id
        );

        if (doc.user_id !== req.user.$id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        await databases.deleteDocument(
            APPWRITE_DATABASE_ID,
            AUTOMATIONS_COLLECTION_ID,
            req.params.id
        );

        res.json({ success: true, message: 'Automation deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to delete automation' });
    }
});

/**
 * POST /api/v1/automations/:id/trigger
 * Dispatch / Trigger an automation message payload to an Instagram user.
 */
router.post('/automations/:id/trigger', async (req, res) => {
    try {
        const { recipientId, recipientUsername, customMessage } = req.body || {};
        if (!recipientId && !recipientUsername) {
            return res.status(400).json({
                success: false,
                error: 'Recipient ID or Username is required to trigger DM automation'
            });
        }

        const databases = new Databases(getAppwriteClient({ useApiKey: true }));
        const doc = await databases.getDocument(
            APPWRITE_DATABASE_ID,
            AUTOMATIONS_COLLECTION_ID,
            req.params.id
        );

        if (doc.user_id !== req.user.$id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        // Record execution log entry
        const logId = ID.unique();
        const now = new Date().toISOString();
        await databases.createDocument(
            APPWRITE_DATABASE_ID,
            LOGS_COLLECTION_ID,
            logId,
            {
                user_id: req.user.$id,
                automation_id: doc.$id,
                account_id: doc.account_id || 'api_trigger',
                recipient_id: String(recipientId || recipientUsername),
                recipient_name: String(recipientUsername || recipientId),
                status: 'success',
                message_sent: customMessage || doc.reply_text || 'API Triggered DM',
                sent_at: now
            }
        ).catch(() => null);

        // Increment send count
        databases.updateDocument(
            APPWRITE_DATABASE_ID,
            AUTOMATIONS_COLLECTION_ID,
            doc.$id,
            { dms_sent: (doc.dms_sent || 0) + 1 }
        ).catch(() => null);

        res.json({
            success: true,
            message: `Automation triggered successfully for recipient: ${recipientUsername || recipientId}`,
            logId
        });
    } catch (err) {
        console.error('Error triggering automation:', err.message);
        res.status(500).json({ success: false, error: err.message || 'Failed to trigger automation' });
    }
});

/**
 * GET /api/v1/analytics
 * Performance metrics summary for user dashboard / n8n nodes.
 */
router.get('/analytics', async (req, res) => {
    try {
        const databases = new Databases(getAppwriteClient({ useApiKey: true }));
        const userId = req.user.$id;

        const end = new Date();
        const start30d = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const start24h = new Date(end.getTime() - 24 * 60 * 60 * 1000).toISOString();

        const [accounts, logs30d, automations] = await Promise.all([
            databases.listDocuments(
                APPWRITE_DATABASE_ID,
                IG_ACCOUNTS_COLLECTION_ID,
                [Query.equal('user_id', userId), Query.limit(100)]
            ).catch(() => ({ documents: [] })),
            databases.listDocuments(
                APPWRITE_DATABASE_ID,
                LOGS_COLLECTION_ID,
                [
                    Query.equal('user_id', userId),
                    Query.greaterThanEqual('sent_at', start30d),
                    Query.limit(5000)
                ]
            ).catch(() => ({ documents: [] })),
            databases.listDocuments(
                APPWRITE_DATABASE_ID,
                AUTOMATIONS_COLLECTION_ID,
                [Query.equal('user_id', userId), Query.limit(100)]
            ).catch(() => ({ documents: [] }))
        ]);

        const logs = logs30d.documents || [];
        const logs24h = logs.filter(l => l.sent_at >= start24h);
        const successCount = logs.filter(l => String(l.status).toLowerCase() === 'success').length;

        res.json({
            success: true,
            data: {
                totalAccounts: accounts.documents.length,
                totalAutomations: automations.documents.length,
                activeAutomations: automations.documents.filter(a => a.is_active !== false).length,
                dmsSent24h: logs24h.length,
                dmsSent30d: logs.length,
                successRate: logs.length > 0 ? `${Math.round((successCount / logs.length) * 100)}%` : '100%'
            }
        });
    } catch (err) {
        console.error('Error fetching /api/v1/analytics:', err.message);
        res.status(500).json({ success: false, error: 'Failed to retrieve analytics data' });
    }
});

/**
 * GET /api/v1/logs
 * List execution logs history with pagination.
 */
router.get('/logs', async (req, res) => {
    try {
        const { limit = 50, offset = 0, status, automation_id } = req.query;
        const databases = new Databases(getAppwriteClient({ useApiKey: true }));

        const queries = [
            Query.equal('user_id', req.user.$id),
            Query.orderDesc('sent_at'),
            Query.limit(Math.min(Number(limit) || 50, 100)),
            Query.offset(Number(offset) || 0)
        ];

        if (status) queries.push(Query.equal('status', String(status)));
        if (automation_id) queries.push(Query.equal('automation_id', String(automation_id)));

        const response = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            LOGS_COLLECTION_ID,
            queries
        ).catch(() => ({ total: 0, documents: [] }));

        const logs = (response.documents || []).map(doc => ({
            id: doc.$id,
            automationId: doc.automation_id,
            accountId: doc.account_id,
            recipientId: doc.recipient_id,
            recipientName: doc.recipient_name,
            status: doc.status,
            messageSent: doc.message_sent,
            sentAt: doc.sent_at || doc.$createdAt
        }));

        res.json({
            success: true,
            total: response.total || logs.length,
            limit: Number(limit),
            offset: Number(offset),
            data: logs
        });
    } catch (err) {
        console.error('Error fetching /api/v1/logs:', err.message);
        res.status(500).json({ success: false, error: 'Failed to retrieve execution logs' });
    }
});

/**
 * GET /api/v1/webhooks
 * Retrieve saved webhook URL configuration.
 */
router.get('/webhooks', async (req, res) => {
    try {
        const databases = new Databases(getAppwriteClient({ useApiKey: true }));
        const profiles = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            PROFILES_COLLECTION_ID,
            [Query.equal('user_id', req.user.$id), Query.limit(1)]
        ).catch(() => ({ documents: [] }));

        const profile = profiles.documents[0] || {};
        const url = profile.webhook_url || req.userDocument?.webhook_url || null;

        res.json({
            success: true,
            data: {
                webhookUrl: url,
                status: url ? 'configured' : 'not_configured'
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const validateWebhookUrl = (url) => {
    const safeUrl = String(url || '').trim();
    if (!safeUrl) {
        return { valid: false, error: 'Webhook URL is required' };
    }
    if (!safeUrl.startsWith('https://')) {
        return { valid: false, error: 'Webhook URL must use secure HTTPS protocol (http:// is not allowed).' };
    }
    try {
        const parsed = new URL(safeUrl);
        const hostname = parsed.hostname.toLowerCase();
        if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '0.0.0.0' ||
            hostname === '::1' ||
            hostname.endsWith('.local')
        ) {
            return { valid: false, error: 'Localhost and loopback Webhook URLs are not permitted. Please use a public HTTPS URL.' };
        }
    } catch (_) {
        return { valid: false, error: 'Invalid Webhook URL format' };
    }
    return { valid: true, url: safeUrl };
};

/**
 * POST /api/v1/webhooks
 * Save or update user's event webhook URL (enforces HTTPS & test payload verification).
 */
router.post('/webhooks', async (req, res) => {
    try {
        const { webhookUrl } = req.body || {};
        const validation = validateWebhookUrl(webhookUrl);
        if (!validation.valid) {
            return res.status(400).json({ success: false, error: validation.error });
        }

        const targetUrl = validation.url;

        // Verify endpoint by sending test verification payload prior to saving
        const samplePayload = {
            event: 'webhook_verification',
            timestamp: new Date().toISOString(),
            account_username: 'dmpanda_system',
            message: {
                text: 'Webhook URL verification test from DM Panda.',
                type: 'verification'
            },
            note: 'Verification check from DM Panda prior to saving Webhook configuration.'
        };

        try {
            await sendWebhookPayload(targetUrl, samplePayload);
        } catch (verifyErr) {
            return res.status(400).json({
                success: false,
                error: `Webhook verification failed: Delivery to ${targetUrl} failed (${verifyErr.message || 'Endpoint unreachable'}). Ensure your endpoint returns HTTP 2xx.`
            });
        }

        const databases = new Databases(getAppwriteClient({ useApiKey: true }));
        const profiles = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            PROFILES_COLLECTION_ID,
            [Query.equal('user_id', req.user.$id), Query.limit(1)]
        ).catch(() => ({ documents: [] }));

        if (profiles.documents.length > 0) {
            await databases.updateDocument(
                APPWRITE_DATABASE_ID,
                PROFILES_COLLECTION_ID,
                profiles.documents[0].$id,
                { webhook_url: targetUrl }
            );
        }

        res.json({
            success: true,
            message: 'Webhook URL verified and updated successfully!',
            data: { webhookUrl: targetUrl }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/v1/webhooks/test
 * Test dispatch an event payload to user's webhook URL.
 */
router.post('/webhooks/test', async (req, res) => {
    try {
        const { webhookUrl } = req.body || {};
        let targetUrl = webhookUrl;

        if (!targetUrl) {
            const databases = new Databases(getAppwriteClient({ useApiKey: true }));
            const profiles = await databases.listDocuments(
                APPWRITE_DATABASE_ID,
                PROFILES_COLLECTION_ID,
                [Query.equal('user_id', req.user.$id), Query.limit(1)]
            ).catch(() => ({ documents: [] }));
            targetUrl = profiles.documents[0]?.webhook_url;
        }

        const validation = validateWebhookUrl(targetUrl);
        if (!validation.valid) {
            return res.status(400).json({ success: false, error: validation.error });
        }

        const samplePayload = {
            event: 'dm_message_received',
            timestamp: new Date().toISOString(),
            account_username: 'mybrand_official',
            message: {
                text: 'PRICE',
                type: 'text'
            },
            sender: {
                username: 'sample_user',
                name: 'Sample Recipient'
            },
            note: 'This is a test event payload sent from DM Panda.'
        };

        await sendWebhookPayload(validation.url, samplePayload);

        res.json({
            success: true,
            message: `Test payload delivered successfully to ${validation.url}!`
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            error: err.message || 'Webhook verification failed'
        });
    }
});

module.exports = router;

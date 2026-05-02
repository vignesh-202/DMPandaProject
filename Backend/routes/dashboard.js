const express = require('express');
const router = express.Router();
const { loginRequired } = require('../middleware/auth');
const {
    getAppwriteClient,
    USERS_COLLECTION_ID,
    CAMPAIGNS_COLLECTION_ID,
    PROFILES_COLLECTION_ID,
    LOGS_COLLECTION_ID,
    IG_ACCOUNTS_COLLECTION_ID
} = require('../utils/appwrite');
const { Databases, Query, ID } = require('node-appwrite');
const {
    buildPlanApiPayload,
    parseRuntimeLimits,
    resolveUserPlanContext
} = require('../utils/planConfig');
const { loadUserAccessState } = require('../utils/accessControl');

const getDefaultUserSettings = () => ({
    dark_mode: false,
    notification_preference: 'email'
});

const getDateRangeQueries = (startDate, endDate) => {
    const queries = [];
    if (startDate) queries.push(Query.greaterThanEqual('sent_at', startDate));
    if (endDate) queries.push(Query.lessThanEqual('sent_at', endDate));
    return queries;
};

const calculateDashboardOverview = async (userId) => {
    const serverClient = getAppwriteClient({ useApiKey: true });
    const databases = new Databases(serverClient);

    const end = new Date();
    const start = new Date(end.getTime() - (30 * 24 * 60 * 60 * 1000));
    const twentyFourHoursAgo = new Date(end.getTime() - (24 * 60 * 60 * 1000)).toISOString();
    const thirtyDayQueries = [
        ...getDateRangeQueries(start.toISOString(), end.toISOString()),
        Query.limit(5000)
    ];

    const accounts = await databases.listDocuments(
        process.env.APPWRITE_DATABASE_ID,
        IG_ACCOUNTS_COLLECTION_ID,
        [Query.equal('user_id', userId), Query.limit(100)]
    ).catch(() => ({ documents: [] }));
    const accountIds = (accounts.documents || []).map((account) => String(account.ig_user_id || account.account_id || account.$id)).filter(Boolean);
    const accountQuery = accountIds.length > 0 ? [Query.equal('account_id', accountIds)] : [];

    const [profiles, logs24h, logs30d] = await Promise.all([
        databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            PROFILES_COLLECTION_ID,
            [Query.equal('user_id', userId), Query.limit(1)]
        ).catch(() => ({ documents: [] })),
        databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            LOGS_COLLECTION_ID,
            accountQuery.concat([Query.greaterThanEqual('sent_at', twentyFourHoursAgo), Query.limit(5000)])
        ).catch(() => ({ documents: [] })),
        databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            LOGS_COLLECTION_ID,
            accountQuery.concat(thirtyDayQueries)
        ).catch(() => ({ documents: [] }))
    ]);

    const profile = profiles.documents[0] || {};
    const runtimeLimits = parseRuntimeLimits(profile);
    const logs24hDocs = Array.isArray(logs24h.documents) ? logs24h.documents : [];
    const logs30dDocs = Array.isArray(logs30d.documents) ? logs30d.documents : [];
    const successCount = logs30dDocs.filter((entry) => String(entry.status || '').toLowerCase() === 'success').length;
    const repliedCount = successCount + logs30dDocs.filter((entry) => String(entry.status || '').toLowerCase() === 'skipped').length;
    const reelReplies = logs30dDocs.filter((entry) => ['reel'].includes(String(entry.automation_type || '').toLowerCase())).length;
    const postReplies = logs30dDocs.filter((entry) => ['comment', 'post'].includes(String(entry.automation_type || '').toLowerCase())).length;
    const uniqueContacts24h = new Set(logs24hDocs.map((entry) => String(entry.sender_name || entry.recipient_id || '')).filter(Boolean));
    const replyRate = logs30dDocs.length > 0 ? `${Math.round((repliedCount / logs30dDocs.length) * 100)}%` : '0%';

    return {
        dms_sent_24h: logs24hDocs.length,
        new_contacts: uniqueContacts24h.size,
        reply_rate: replyRate,
        gauge_metrics: {
            dm_rate: logs30dDocs.length > 0 ? Math.round((successCount / logs30dDocs.length) * 100) : 0,
            actions_month: Number(profile.monthly_actions_used || 0),
            actions_month_limit: Number(runtimeLimits.monthly_action_limit || 0),
            reel_replies: reelReplies,
            post_replies: postReplies
        }
    };
};

// Get Dashboard Data
router.get('/dashboard', loginRequired, async (req, res) => {
    try {
        const userId = req.user.$id;

        // Use user's client for campaigns (RLS should handle this)
        const databases = new Databases(req.appwriteClient);

        let campaignsData = [];
        try {
            const campaignsResponse = await databases.listDocuments(
                process.env.APPWRITE_DATABASE_ID,
                CAMPAIGNS_COLLECTION_ID,
                [Query.equal('user_id', userId)]
            );
            campaignsData = campaignsResponse.documents;
        } catch (e) {
            console.error(`Error fetching campaigns: ${e.message}`);
            // If collection doesn't exist or permissions fail, return empty list
        }

        const userSettings = getDefaultUserSettings();

        const activeCampaignsCount = campaignsData.filter(c => c.status === 'active').length;
        const overview = await calculateDashboardOverview(userId);
        const serverDatabases = new Databases(getAppwriteClient({ useApiKey: true }));
        const [planContext, accessContext] = await Promise.all([
            resolveUserPlanContext(serverDatabases, userId, req.user),
            loadUserAccessState(serverDatabases, userId, { userDocument: req.userDocument || null })
        ]);
        const planPayload = buildPlanApiPayload(planContext.plan, planContext.profile);

        const dashboardData = {
            active_campaigns: activeCampaignsCount,
            dms_sent_24h: overview.dms_sent_24h,
            new_contacts: overview.new_contacts,
            reply_rate: overview.reply_rate,
            campaigns: campaignsData,
            gauge_metrics: overview.gauge_metrics,
            user_settings: {
                dark_mode: userSettings.dark_mode || false,
                notification_preference: userSettings.notification_preference || 'email'
            },
            plan: planPayload,
            limits: planPayload.limits,
            features: planPayload.features,
            access_state: accessContext.accessState,
            locked_features: []
        };

        res.json(dashboardData);

    } catch (err) {
        console.error(`Dashboard Fetch Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch dashboard data.' });
    }
});

router.get('/settings', loginRequired, async (req, res) => {
    res.json(getDefaultUserSettings());
});

// Update Settings
router.post('/settings', loginRequired, async (req, res) => {
    res.json({ message: 'Settings are now static defaults and no longer persisted.' });
});

module.exports = router;

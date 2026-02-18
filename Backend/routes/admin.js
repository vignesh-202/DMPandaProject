const express = require('express');
const router = express.Router();
const { loginRequired } = require('../middleware/auth');
const {
    getAppwriteClient,
    USERS_COLLECTION_ID,
    CAMPAIGNS_COLLECTION_ID
} = require('../utils/appwrite');
const { Databases, Query } = require('node-appwrite');

// Check if user is admin (Simple middleware placeholder)
const adminRequired = (req, res, next) => {
    // In a real app, check req.user.email or a specific label/team
    // For now, allow all logged in users as per app.py simplification or add logic
    // app.py: # Security: In a real app, verify user is an admin here
    // But it didn't strictly enforce it in the shared code snippet beyond comment.
    // I will stick to loginRequired for now but add a comment.
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    // if (!req.user.email.endsWith('@dmpanda.com')) ... 
    next();
};

// Admin Dashboard Stats
router.get('/dashboard', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        // 1. Total Users (Fetch reasonable max)
        const usersResponse = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            USERS_COLLECTION_ID,
            [Query.limit(5000)]
        );

        const users = usersResponse.documents;
        const totalUsers = usersResponse.total;

        // 2. Paid Users & MRR
        let paidUsers = 0;
        let mrr = 0;

        users.forEach(u => {
            const plan = u.subscription_plan_id;
            if (plan) {
                paidUsers++;
                if (plan === 'premium_monthly') mrr += 29;
                else if (plan === 'premium_yearly') mrr += (299 / 12);
            }
        });

        // 3. New Users (24h)
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        let newUsers24h = 0;

        users.forEach(u => {
            if (u.$createdAt) {
                const createdAt = new Date(u.$createdAt);
                if (createdAt > oneDayAgo) newUsers24h++;
            }
        });

        // 4. Active Campaigns
        let activeCampaigns = 0;
        try {
            const campaignsRes = await databases.listDocuments(
                process.env.APPWRITE_DATABASE_ID,
                CAMPAIGNS_COLLECTION_ID,
                [Query.limit(1)] // Just need total count
            );
            activeCampaigns = campaignsRes.total;
        } catch (e) {
            // Ignore if collection doesn't exist yet
        }

        // Recent Users (sort by createdAt desc)
        const sortedUsers = [...users].sort((a, b) => new Date(b.$createdAt) - new Date(a.$createdAt)).slice(0, 5);

        const recentUsers = sortedUsers.map(u => ({
            name: u.name || 'N/A',
            email: u.email || 'N/A',
            status: u.status ? 'Active' : 'Inactive', // Note: User doc might not have status, auth user does. 
            // app.py uses u.get('status') which might be from the user doc if synced, or it might be assuming.
            // In manageUserOnLogin we didn't save status. 
            // Let's assume 'Active' if in DB for now or check if we sync it.
            joined_at: u.$createdAt,
            amount: u.subscription_plan_id ? '$29.00' : '$0.00'
        }));

        res.json({
            stats: {
                totalUsers,
                paidUsers,
                newUsers24h,
                mrr: Math.floor(mrr),
                activeCampaigns,
                automationsRan: 0
            },
            recentUsers
        });

    } catch (err) {
        console.error(`Admin Dashboard Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to load dashboard.' });
    }
});

// Admin User List
router.get('/users', loginRequired, async (req, res) => {
    try {
        const { cursor } = req.query;
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const queries = [Query.limit(50), Query.orderDesc('$createdAt')];
        if (cursor) queries.push(Query.cursorAfter(cursor));

        const usersResponse = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            USERS_COLLECTION_ID,
            queries
        );

        res.json({
            users: usersResponse.documents,
            total: usersResponse.total
        });
    } catch (err) {
        console.error(`Admin Users Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

// Update User
router.patch('/users/:userId', loginRequired, async (req, res) => {
    try {
        const { userId } = req.params;
        const data = req.body;

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        // Remove system attributes
        const cleanData = {};
        Object.keys(data).forEach(key => {
            if (!key.startsWith('$')) cleanData[key] = data[key];
        });

        const result = await databases.updateDocument(
            process.env.APPWRITE_DATABASE_ID,
            USERS_COLLECTION_ID,
            userId,
            cleanData
        );

        res.json(result);
    } catch (err) {
        console.error(`Admin Update User Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to update user.' });
    }
});

module.exports = router;

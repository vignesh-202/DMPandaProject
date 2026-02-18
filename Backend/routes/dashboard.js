const express = require('express');
const router = express.Router();
const { loginRequired } = require('../middleware/auth');
const { getAppwriteClient, USERS_COLLECTION_ID, CAMPAIGNS_COLLECTION_ID, SETTINGS_COLLECTION_ID } = require('../utils/appwrite');
const { Databases, Query, Permission, Role, ID } = require('node-appwrite');

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

        // User Settings
        let userSettings = {};
        try {
            const settingsDocs = await databases.listDocuments(
                process.env.APPWRITE_DATABASE_ID,
                SETTINGS_COLLECTION_ID,
                [Query.equal('$id', userId)]
            );

            if (settingsDocs.total > 0) {
                userSettings = settingsDocs.documents[0];
            } else {
                // Create default settings using Admin Client (to ensure permissions are right)
                // or User client if allowed. app.py used Server Client for creation fallback.
                const serverClient = getAppwriteClient({ useApiKey: true });
                const serverDatabases = new Databases(serverClient);

                userSettings = await serverDatabases.createDocument(
                    process.env.APPWRITE_DATABASE_ID,
                    SETTINGS_COLLECTION_ID,
                    userId,
                    { dark_mode: false, notification_preference: 'email' },
                    [
                        Permission.read(Role.user(userId)),
                        Permission.update(Role.user(userId))
                    ]
                );
            }
        } catch (settingsErr) {
            console.error(`Error fetching settings: ${settingsErr.message}`);
            userSettings = {};
        }

        const activeCampaignsCount = campaignsData.filter(c => c.status === 'active').length;

        const dashboardData = {
            active_campaigns: activeCampaignsCount,
            dms_sent_24h: 0, // Placeholder as per app.py
            new_contacts: 0, // Placeholder
            reply_rate: "0%", // Placeholder
            campaigns: campaignsData,
            user_settings: {
                dark_mode: userSettings.dark_mode || false,
                notification_preference: userSettings.notification_preference || 'email'
            }
        };

        res.json(dashboardData);

    } catch (err) {
        console.error(`Dashboard Fetch Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch dashboard data.' });
    }
});

// Update Settings
router.post('/settings', loginRequired, async (req, res) => {
    try {
        const userId = req.user.$id;
        const data = req.body;
        const updateData = {};

        if (typeof data.dark_mode !== 'undefined') updateData.dark_mode = data.dark_mode;
        if (data.notification_preference) updateData.notification_preference = data.notification_preference;

        if (Object.keys(updateData).length === 0) return res.status(400).json({ error: 'No settings provided' });

        const databases = new Databases(req.appwriteClient);

        const settingsDocs = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            SETTINGS_COLLECTION_ID,
            [Query.equal('$id', userId)]
        );

        if (settingsDocs.total > 0) {
            await databases.updateDocument(
                process.env.APPWRITE_DATABASE_ID,
                SETTINGS_COLLECTION_ID,
                settingsDocs.documents[0].$id,
                updateData
            );
        } else {
            await databases.createDocument(
                process.env.APPWRITE_DATABASE_ID,
                SETTINGS_COLLECTION_ID,
                userId,
                updateData,
                [
                    Permission.read(Role.user(userId)),
                    Permission.update(Role.user(userId))
                ]
            );
        }

        res.json({ message: 'Settings updated' });

    } catch (err) {
        console.error(`Update Settings Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

module.exports = router;

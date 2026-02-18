const express = require('express');
const router = express.Router();
const axios = require('axios');
const { loginRequired } = require('../middleware/auth');
const { getAppwriteClient, IG_ACCOUNTS_COLLECTION_ID } = require('../utils/appwrite');
const { Databases, Query, ID, Permission, Role } = require('node-appwrite');

// Environment variables
const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID;
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
const INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URL || process.env.INSTAGRAM_REDIRECT_URI;

// ==============================================================================
// INSTAGRAM OAUTH INTEGRATION
// ==============================================================================

// Get Instagram Auth URL
router.get('/auth/instagram', (req, res) => {
    if (!INSTAGRAM_APP_ID) {
        return res.status(500).json({ error: 'Instagram integration is not configured.' });
    }

    const scopes = 'instagram_business_basic,instagram_business_manage_messages';
    const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${INSTAGRAM_APP_ID}&redirect_uri=${INSTAGRAM_REDIRECT_URI}&response_type=code&scope=${scopes}`;

    res.json({ url: authUrl });
});

// Instagram Callback
router.post('/auth/instagram-callback', loginRequired, async (req, res) => {
    const { code } = req.body;
    const user = req.user;

    if (!code) return res.status(400).json({ error: 'Authorization code is required' });
    if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET) {
        return res.status(500).json({ error: 'Instagram integration is not configured.' });
    }

    try {
        // Step 1: Exchange code for short-lived access token
        const formData = new URLSearchParams();
        formData.append('client_id', INSTAGRAM_APP_ID);
        formData.append('client_secret', INSTAGRAM_APP_SECRET);
        formData.append('grant_type', 'authorization_code');
        formData.append('redirect_uri', INSTAGRAM_REDIRECT_URI);
        formData.append('code', code);

        const tokenResponse = await axios.post('https://api.instagram.com/oauth/access_token', formData);
        const tokenData = tokenResponse.data;

        let shortLivedToken, igUserId, permissions;

        // Handle both response formats
        if (tokenData.data && Array.isArray(tokenData.data) && tokenData.data.length > 0) {
            const firstItem = tokenData.data[0];
            shortLivedToken = firstItem.access_token;
            igUserId = firstItem.user_id?.toString();
            permissions = firstItem.permissions || '';
        } else {
            // Standard response: { access_token, user_id, permissions? }
            shortLivedToken = tokenData.access_token;
            igUserId = tokenData.user_id?.toString();
            permissions = tokenData.permissions || '';
        }

        if (!shortLivedToken) {
            return res.status(400).json({ error: 'Failed to retrieve access token.' });
        }

        // Step 2: Exchange short-lived for long-lived
        const longLivedResponse = await axios.get('https://graph.instagram.com/access_token', {
            params: {
                grant_type: 'ig_exchange_token',
                client_secret: INSTAGRAM_APP_SECRET,
                access_token: shortLivedToken
            }
        });

        const longLivedData = longLivedResponse.data;
        const longLivedToken = longLivedData.access_token;
        const expiresIn = longLivedData.expires_in || 5184000; // 60 days default

        const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        // Step 3: Fetch Instagram user profile
        const profileResponse = await axios.get('https://graph.instagram.com/me', {
            params: {
                fields: 'id,username,profile_picture_url',
                access_token: longLivedToken
            }
        });

        const profileData = profileResponse.data;
        const igUsername = profileData.username || 'Unknown';
        const profilePicUrl = profileData.profile_picture_url || '';

        // Step 4: Check for duplicates and Save
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const existingAccounts = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            [Query.equal('ig_user_id', igUserId)]
        );

        if (existingAccounts.total > 0) {
            const existingAccount = existingAccounts.documents[0];
            if (existingAccount.user_id !== user.$id) {
                return res.status(409).json({ error: `This Instagram account (@${igUsername}) is already linked to another user.` });
            } else {
                // Update
                await databases.updateDocument(
                    process.env.APPWRITE_DATABASE_ID,
                    IG_ACCOUNTS_COLLECTION_ID,
                    existingAccount.$id,
                    {
                        username: igUsername,
                        profile_picture_url: profilePicUrl,
                        access_token: longLivedToken,
                        token_expires_at: tokenExpiresAt,
                    }
                );
                return res.json({ message: `Instagram account @${igUsername} updated successfully.` });
            }
        } else {
            // Create
            await databases.createDocument(
                process.env.APPWRITE_DATABASE_ID,
                IG_ACCOUNTS_COLLECTION_ID,
                ID.unique(),
                {
                    user_id: user.$id,
                    ig_user_id: igUserId,
                    username: igUsername,
                    profile_picture_url: profilePicUrl,
                    access_token: longLivedToken,
                    token_expires_at: tokenExpiresAt,
                    linked_at: new Date().toISOString()
                },
                [
                    Permission.read(Role.user(user.$id))
                ]
            );
            return res.json({ message: `Instagram account @${igUsername} linked successfully.` });
        }

    } catch (err) {
        console.error(`Instagram Auth Error: ${err.message}`, err.response?.data);
        res.status(500).json({ error: 'Failed to process Instagram login.' });
    }
});

// Get Linked Accounts
router.get('/account/ig-accounts', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const accounts = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            [Query.equal('user_id', req.user.$id)]
        );

        // Sanitize
        const safeAccounts = accounts.documents.map(acc => ({
            id: acc.$id,
            ig_user_id: acc.ig_user_id,
            username: acc.username,
            profile_picture_url: acc.profile_picture_url,
            linked_at: acc.linked_at,
            token_expires_at: acc.token_expires_at
        }));

        res.json({ accounts: safeAccounts });
    } catch (err) {
        console.error(`Fetch IG Accounts Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch Instagram accounts.' });
    }
});

// Unlink Account
router.delete('/account/ig-accounts/:accountId', loginRequired, async (req, res) => {
    try {
        const { accountId } = req.params;
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        // Verify ownership
        const account = await databases.getDocument(
            process.env.APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            accountId
        );

        if (account.user_id !== req.user.$id) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        await databases.deleteDocument(
            process.env.APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            accountId
        );

        res.json({ message: 'Instagram account unlinked successfully.' });

    } catch (err) {
        if (err.code === 404) return res.status(404).json({ error: 'Account not found.' });
        console.error(`Unlink IG Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to unlink account.' });
    }
});

// Get Stats
router.get('/instagram/stats', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const accounts = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            [Query.equal('user_id', req.user.$id)]
        );

        if (accounts.total === 0) return res.status(404).json({ error: 'No Instagram account linked.' });

        // Use first account
        const account = accounts.documents[0];
        const accessToken = account.access_token;

        const response = await axios.get('https://graph.instagram.com/me', {
            params: {
                fields: 'followers_count,media_count,username,profile_picture_url',
                access_token: accessToken
            }
        });

        const data = response.data;
        res.json({
            followers: data.followers_count || 0,
            media_count: data.media_count || 0,
            username: data.username,
            profile_picture_url: data.profile_picture_url
        });

    } catch (err) {
        console.error(`IG Stats Error: ${err.message}`);
        if (err.response) {
            return res.status(err.response.status).json({ error: 'Failed to fetch Instagram stats.' });
        }
        res.status(500).json({ error: 'Failed to fetch stats.' });
    }
});

// Get Media
router.get('/instagram/media', loginRequired, async (req, res) => {
    try {
        const { type, after } = req.query;

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const accounts = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            [Query.equal('user_id', req.user.$id)]
        );

        if (accounts.total === 0) return res.status(404).json({ error: 'No Instagram account linked.' });

        const account = accounts.documents[0];
        const accessToken = account.access_token;

        const apiEdge = type === 'story' ? 'stories' : 'media';

        const params = {
            fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,shortcode',
            access_token: accessToken,
            limit: 25
        };
        if (after) params.after = after;

        const response = await axios.get(`https://graph.instagram.com/me/${apiEdge}`, { params });

        const data = response.data;
        const mediaItems = data.data || [];

        // Filter logic similar to Python
        const filteredItems = mediaItems.filter(item => {
            if (!type) return true;
            if (type === 'reel') return item.media_type === 'VIDEO';
            if (type === 'post') return ['IMAGE', 'CAROUSEL_ALBUM'].includes(item.media_type);
            return true;
        });

        // Add has_automation
        filteredItems.forEach(item => item.has_automation = false);

        res.json({
            data: filteredItems,
            paging: data.paging || {}
        });

    } catch (err) {
        console.error(`IG Media Error: ${err.message}`);
        if (err.response) {
            return res.status(err.response.status).json({ error: 'Failed to fetch Instagram media.' });
        }
        res.status(500).json({ error: 'Failed to fetch media.' });
    }
});


module.exports = router;

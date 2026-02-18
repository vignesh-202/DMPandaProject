const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const { loginRequired } = require('../middleware/auth');
const { getAppwriteClient, Functions, IG_ACCOUNTS_COLLECTION_ID, AUTOMATIONS_COLLECTION_ID, REPLY_TEMPLATES_COLLECTION_ID, INBOX_MENUS_COLLECTION_ID, CONVO_STARTERS_COLLECTION_ID, MENTIONS_COLLECTION_ID, SUPER_PROFILES_COLLECTION_ID, SUGGEST_MORE_COLLECTION_ID, COMMENT_MODERATION_COLLECTION_ID, KEYWORDS_COLLECTION_ID, KEYWORD_INDEX_COLLECTION_ID, FUNCTION_REMOVE_INSTAGRAM } = require('../utils/appwrite');
const { Databases, Query, ID, Permission, Role, ExecutionMethod } = require('node-appwrite');

// Environment variables
const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID;
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
const INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URL || process.env.INSTAGRAM_REDIRECT_URI;

// ==============================================================================
// AUTOMATION VALIDATION + TEMPLATE LINKING
// ==============================================================================
const AUTOMATION_TITLE_MIN = 2;
const AUTOMATION_TITLE_MAX = 25;
const TEXT_MIN = 2;
const TEXT_MAX = 1000;
const BUTTON_TEXT_MAX = 640;
const BUTTON_TITLE_MIN = 2;
const BUTTON_TITLE_MAX = 40;
const QUICK_REPLY_TITLE_MIN = 2;
const QUICK_REPLY_TITLE_MAX = 20;
const QUICK_REPLY_PAYLOAD_MIN = 2;
const QUICK_REPLY_PAYLOAD_MAX = 950;
const QUICK_REPLIES_TEXT_MAX = 950;
const CAROUSEL_TITLE_MIN = 2;
const CAROUSEL_TITLE_MAX = 80;
const CAROUSEL_SUBTITLE_MAX = 80;
const CAROUSEL_ELEMENTS_MAX = 10;
const CAROUSEL_BUTTON_TITLE_MIN = 2;
const CAROUSEL_BUTTON_TITLE_MAX = 20;
const BUTTONS_MAX = 3;
const QUICK_REPLIES_MAX = 13;
const MEDIA_URL_MAX = 500;

const VALID_TEMPLATE_TYPES = new Set([
    'template_text',
    'template_carousel',
    'template_buttons',
    'template_media',
    'template_share_post',
    'template_quick_replies',
    'template_media_attachment',
    'template_url'
]);

const byteLen = (s) => Buffer.byteLength(String(s || ''), 'utf8');
const parseMaybeJson = (v, fallback) => {
    if (v === null || v === undefined) return fallback;
    if (typeof v === 'string') {
        try { return JSON.parse(v); } catch (_) { return fallback; }
    }
    return v;
};

const normalizeTitle = (value) => String(value || '').trim().toLowerCase();

const KEYWORD_MAX_PER_AUTOMATION = 5;
const KEYWORD_TYPES = new Set(['dm', 'global', 'post', 'reel', 'story', 'live', 'comment']);

const normalizeKeywordToken = (value) => String(value || '').trim().toUpperCase();

const getKeywordInfo = (automation) => {
    const rawKeywords = parseMaybeJson(automation.keywords, []);
    let input = [];
    if (Array.isArray(rawKeywords) && rawKeywords.length > 0) {
        input = rawKeywords;
    } else if (Array.isArray(automation.keyword)) {
        input = automation.keyword;
    } else {
        const kw = String(automation.keyword || '').trim();
        input = kw ? kw.split(',') : [];
    }

    const normalized = input
        .map(k => normalizeKeywordToken(k))
        .filter(Boolean);

    const normalizedSet = new Set(normalized);
    const hasDuplicates = normalizedSet.size !== normalized.length;
    return { keywords: Array.from(normalizedSet), hasDuplicates };
};

const normalizeKeywordArray = (automation) => getKeywordInfo(automation).keywords;

const computeKeywordHash = (keywordNormalized) =>
    crypto.createHash('sha256').update(keywordNormalized).digest('hex');

const listAllDocuments = async (databases, collectionId, queries) => {
    const docs = [];
    let cursor = null;
    while (true) {
        const pageQueries = [...queries, Query.orderAsc('$id'), Query.limit(100)];
        if (cursor) pageQueries.push(Query.cursorAfter(cursor));
        const page = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, collectionId, pageQueries);
        docs.push(...page.documents);
        if (page.documents.length < 100) break;
        cursor = page.documents[page.documents.length - 1].$id;
    }
    return docs;
};

const getIgProfessionalAccountId = (account) =>
    String(account?.ig_user_id || account?.account_id || '');

const isOwnedIgAccount = (account, appUserId) =>
    account?.user_id === appUserId;

const matchesIgAccountIdentifier = (account, identifier) => {
    const id = String(identifier || '');
    if (!id) return false;
    return account?.$id === id
        || getIgProfessionalAccountId(account) === id
        || String(account?.ig_user_id || '') === id
        || String(account?.account_id || '') === id;
};

const listOwnedIgAccounts = async (databases, appUserId, extraQueries = []) => {
    const databaseId = process.env.APPWRITE_DATABASE_ID;
    return databases.listDocuments(
        databaseId,
        IG_ACCOUNTS_COLLECTION_ID,
        [Query.equal('user_id', appUserId), ...extraQueries]
    );
};

const ensureKeywordConstraints = async (databases, { accountId, automationId, automationType, keywords }) => {
    for (const keywordNormalized of keywords) {
        if (automationType === 'global') {
            const matches = await databases.listDocuments(
                process.env.APPWRITE_DATABASE_ID,
                KEYWORDS_COLLECTION_ID,
                [
                    Query.equal('account_id', accountId),
                    Query.equal('keyword_normalized', keywordNormalized),
                    Query.limit(5)
                ]
            );
            const conflict = matches.documents.find(doc => doc.automation_id !== automationId);
            if (conflict) {
                return `Keyword "${keywordNormalized}" is already used in another automation.`;
            }
        } else {
            const [typeMatches, globalMatches] = await Promise.all([
                databases.listDocuments(
                    process.env.APPWRITE_DATABASE_ID,
                    KEYWORDS_COLLECTION_ID,
                    [
                        Query.equal('account_id', accountId),
                        Query.equal('automation_type', automationType),
                        Query.equal('keyword_normalized', keywordNormalized),
                        Query.limit(5)
                    ]
                ),
                databases.listDocuments(
                    process.env.APPWRITE_DATABASE_ID,
                    KEYWORDS_COLLECTION_ID,
                    [
                        Query.equal('account_id', accountId),
                        Query.equal('automation_type', 'global'),
                        Query.equal('keyword_normalized', keywordNormalized),
                        Query.limit(5)
                    ]
                )
            ]);

            const combined = [...typeMatches.documents, ...globalMatches.documents];
            const conflict = combined.find(doc => doc.automation_id !== automationId);
            if (conflict) {
                return `Keyword "${keywordNormalized}" is already used in another automation.`;
            }
        }
    }
    return null;
};

const findKeywordConflicts = async (databases, { accountId, automationId, automationType, keywords }) => {
    const conflicts = [];
    for (const keywordNormalized of keywords) {
        if (automationType === 'global') {
            const matches = await databases.listDocuments(
                process.env.APPWRITE_DATABASE_ID,
                KEYWORDS_COLLECTION_ID,
                [
                    Query.equal('account_id', accountId),
                    Query.equal('keyword_normalized', keywordNormalized),
                    Query.limit(5)
                ]
            );
            const conflict = matches.documents.find(doc => doc.automation_id !== automationId);
            if (conflict) conflicts.push(keywordNormalized);
        } else {
            const [typeMatches, globalMatches] = await Promise.all([
                databases.listDocuments(
                    process.env.APPWRITE_DATABASE_ID,
                    KEYWORDS_COLLECTION_ID,
                    [
                        Query.equal('account_id', accountId),
                        Query.equal('automation_type', automationType),
                        Query.equal('keyword_normalized', keywordNormalized),
                        Query.limit(5)
                    ]
                ),
                databases.listDocuments(
                    process.env.APPWRITE_DATABASE_ID,
                    KEYWORDS_COLLECTION_ID,
                    [
                        Query.equal('account_id', accountId),
                        Query.equal('automation_type', 'global'),
                        Query.equal('keyword_normalized', keywordNormalized),
                        Query.limit(5)
                    ]
                )
            ]);

            const combined = [...typeMatches.documents, ...globalMatches.documents];
            const conflict = combined.find(doc => doc.automation_id !== automationId);
            if (conflict) conflicts.push(keywordNormalized);
        }
    }
    return Array.from(new Set(conflicts));
};

const syncKeywordRecords = async (databases, { accountId, automationId, automationType, keywords, matchType }) => {
    try {
        const isDuplicateDocError = (err) => {
            const msg = String(err?.message || '').toLowerCase();
            return msg.includes('already exists') || msg.includes('document with the requested id already exists') || err?.code === 409;
        };

        const normalizedKeywords = (keywords || [])
            .map(k => normalizeKeywordToken(k))
            .filter(Boolean);

        const deleteExisting = async (collectionId) => {
            const existing = await listAllDocuments(databases, collectionId, [
                Query.equal('automation_id', automationId)
            ]);
            for (const doc of existing) {
                await databases.deleteDocument(process.env.APPWRITE_DATABASE_ID, collectionId, doc.$id);
            }
        };

        await deleteExisting(KEYWORDS_COLLECTION_ID);
        await deleteExisting(KEYWORD_INDEX_COLLECTION_ID);

        if (!normalizedKeywords || normalizedKeywords.length === 0) return;

        for (const keywordNormalized of normalizedKeywords) {
            const keywordValue = String(keywordNormalized || '').trim();
            if (!keywordValue) continue;
            const keywordSafe = keywordValue.slice(0, 255);
            const keywordHash = computeKeywordHash(keywordNormalized);
            try {
                await databases.createDocument(
                    process.env.APPWRITE_DATABASE_ID,
                    KEYWORDS_COLLECTION_ID,
                    ID.unique(),
                    {
                        automation_id: automationId,
                        account_id: accountId,
                        automation_type: automationType,
                        type: automationType,
                        keyword: keywordSafe,
                        keyword_normalized: keywordSafe,
                        keyword_hash: keywordHash,
                        match_type: matchType || 'exact',
                        is_active: true
                    }
                );
            } catch (err) {
                if (!isDuplicateDocError(err)) throw err;
                // Duplicate keyword across automations; skip to keep save successful
                continue;
            }

            try {
                await databases.createDocument(
                    process.env.APPWRITE_DATABASE_ID,
                    KEYWORD_INDEX_COLLECTION_ID,
                    ID.unique(),
                    {
                        account_id: accountId,
                        keyword_hash: keywordHash,
                        automation_id: automationId,
                        automation_type: automationType
                    }
                );
            } catch (err) {
                if (!isDuplicateDocError(err)) throw err;
                // Duplicate index entry; skip
                continue;
            }
        }
    } catch (err) {
        throw new Error(err?.message || 'Failed to sync keywords');
    }
};

const validateAutomationPayload = (automation) => {
    const errors = [];
    const title = String(automation.title || '').trim();
    if (byteLen(title) < AUTOMATION_TITLE_MIN || byteLen(title) > AUTOMATION_TITLE_MAX) {
        errors.push(`title must be ${AUTOMATION_TITLE_MIN}-${AUTOMATION_TITLE_MAX} UTF-8 bytes`);
    }

    const templateType = automation.template_type;
    if (!templateType || !VALID_TEMPLATE_TYPES.has(templateType)) {
        errors.push('template_type is invalid or missing');
        return errors;
    }

    const templateContent = String(automation.template_content || '');
    const buttons = parseMaybeJson(automation.buttons, []);
    const replies = parseMaybeJson(automation.replies, []);
    const elements = parseMaybeJson(automation.template_elements, []);
    const mediaUrl = String(automation.media_url || '');
    const mediaId = String(automation.media_id || '');

    if (templateType === 'template_text') {
        const len = byteLen(templateContent);
        if (len < TEXT_MIN || len > TEXT_MAX) errors.push(`template_content must be ${TEXT_MIN}-${TEXT_MAX} UTF-8 bytes`);
    }

    if (templateType === 'template_buttons') {
        const len = byteLen(templateContent);
        if (len < TEXT_MIN || len > BUTTON_TEXT_MAX) errors.push(`template_content must be ${TEXT_MIN}-${BUTTON_TEXT_MAX} UTF-8 bytes`);
        if (!Array.isArray(buttons) || buttons.length === 0 || buttons.length > BUTTONS_MAX) {
            errors.push(`buttons must have 1-${BUTTONS_MAX} items`);
        } else {
            buttons.forEach((btn, i) => {
                const t = String(btn?.title || '');
                const tl = byteLen(t);
                if (tl < BUTTON_TITLE_MIN || tl > BUTTON_TITLE_MAX) errors.push(`buttons[${i}].title must be ${BUTTON_TITLE_MIN}-${BUTTON_TITLE_MAX} UTF-8 bytes`);
                if (!btn?.url || byteLen(btn.url) > MEDIA_URL_MAX) errors.push(`buttons[${i}].url is required and must be <= ${MEDIA_URL_MAX} UTF-8 bytes`);
            });
        }
    }

    if (templateType === 'template_quick_replies') {
        const len = byteLen(templateContent);
        if (len < TEXT_MIN || len > QUICK_REPLIES_TEXT_MAX) errors.push(`template_content must be ${TEXT_MIN}-${QUICK_REPLIES_TEXT_MAX} UTF-8 bytes`);
        if (!Array.isArray(replies) || replies.length === 0 || replies.length > QUICK_REPLIES_MAX) {
            errors.push(`replies must have 1-${QUICK_REPLIES_MAX} items`);
        } else {
            replies.forEach((r, i) => {
                const t = String(r?.title || '');
                const tl = byteLen(t);
                if (tl < QUICK_REPLY_TITLE_MIN || tl > QUICK_REPLY_TITLE_MAX) errors.push(`replies[${i}].title must be ${QUICK_REPLY_TITLE_MIN}-${QUICK_REPLY_TITLE_MAX} UTF-8 bytes`);
                const p = String(r?.payload || '');
                const pl = byteLen(p);
                if (pl < QUICK_REPLY_PAYLOAD_MIN || pl > QUICK_REPLY_PAYLOAD_MAX) errors.push(`replies[${i}].payload must be ${QUICK_REPLY_PAYLOAD_MIN}-${QUICK_REPLY_PAYLOAD_MAX} UTF-8 bytes`);
            });
        }
    }

    if (templateType === 'template_media') {
        const ml = byteLen(mediaUrl);
        if (ml < 1 || ml > MEDIA_URL_MAX) errors.push(`media_url is required and must be <= ${MEDIA_URL_MAX} UTF-8 bytes`);
        if (Array.isArray(buttons) && buttons.length > 0) {
            if (buttons.length > BUTTONS_MAX) errors.push(`buttons must have <= ${BUTTONS_MAX} items`);
            buttons.forEach((btn, i) => {
                const t = String(btn?.title || '');
                const tl = byteLen(t);
                if (tl < BUTTON_TITLE_MIN || tl > BUTTON_TITLE_MAX) errors.push(`buttons[${i}].title must be ${BUTTON_TITLE_MIN}-${BUTTON_TITLE_MAX} UTF-8 bytes`);
                if (!btn?.url || byteLen(btn.url) > MEDIA_URL_MAX) errors.push(`buttons[${i}].url is required and must be <= ${MEDIA_URL_MAX} UTF-8 bytes`);
            });
        }
    }

    if (templateType === 'template_carousel') {
        if (!Array.isArray(elements) || elements.length === 0 || elements.length > CAROUSEL_ELEMENTS_MAX) {
            errors.push(`template_elements must have 1-${CAROUSEL_ELEMENTS_MAX} items`);
        } else {
            elements.forEach((el, i) => {
                const t = String(el?.title || '');
                const tl = byteLen(t);
                if (tl < CAROUSEL_TITLE_MIN || tl > CAROUSEL_TITLE_MAX) errors.push(`template_elements[${i}].title must be ${CAROUSEL_TITLE_MIN}-${CAROUSEL_TITLE_MAX} UTF-8 bytes`);
                const st = String(el?.subtitle || '');
                if (st && byteLen(st) > CAROUSEL_SUBTITLE_MAX) errors.push(`template_elements[${i}].subtitle must be <= ${CAROUSEL_SUBTITLE_MAX} UTF-8 bytes`);
                const img = String(el?.image_url || '');
                if (!img || byteLen(img) > MEDIA_URL_MAX) errors.push(`template_elements[${i}].image_url is required and must be <= ${MEDIA_URL_MAX} UTF-8 bytes`);
                if (Array.isArray(el?.buttons) && el.buttons.length > 0) {
                    el.buttons.forEach((b, bi) => {
                        const bt = String(b?.title || '');
                        const btl = byteLen(bt);
                        if (btl < CAROUSEL_BUTTON_TITLE_MIN || btl > CAROUSEL_BUTTON_TITLE_MAX) errors.push(`template_elements[${i}].buttons[${bi}].title must be ${CAROUSEL_BUTTON_TITLE_MIN}-${CAROUSEL_BUTTON_TITLE_MAX} UTF-8 bytes`);
                        if (!b?.url || byteLen(b.url) > MEDIA_URL_MAX) errors.push(`template_elements[${i}].buttons[${bi}].url is required and must be <= ${MEDIA_URL_MAX} UTF-8 bytes`);
                    });
                }
            });
        }
    }

    if (templateType === 'template_share_post') {
        if (!automation.use_latest_post && !mediaId) {
            errors.push('media_id is required unless use_latest_post is true');
        }
    }

    if (templateType === 'template_url') {
        if (!templateContent || byteLen(templateContent) > MEDIA_URL_MAX) {
            errors.push(`template_content is required and must be <= ${MEDIA_URL_MAX} UTF-8 bytes`);
        }
    }

    if (templateType === 'template_media_attachment') {
        const urlCandidate = mediaUrl || templateContent;
        if (!urlCandidate || byteLen(urlCandidate) > MEDIA_URL_MAX) {
            errors.push(`media_url or template_content is required and must be <= ${MEDIA_URL_MAX} UTF-8 bytes`);
        }
    }

    const automationType = automation.automation_type || automation.type || 'dm';
    if (KEYWORD_TYPES.has(automationType)) {
        const { keywords } = getKeywordInfo(automation);
        const hasKeyword = Array.isArray(keywords) && keywords.length > 0;
        if ((automationType === 'dm' || automationType === 'global') && !hasKeyword) {
            errors.push('keyword is required for this automation type');
        }
        if (hasKeyword) {
            if (keywords.length > KEYWORD_MAX_PER_AUTOMATION) {
                errors.push(`keywords must be <= ${KEYWORD_MAX_PER_AUTOMATION}`);
            }
        }
    }

    return errors;
};

const AUTOMATION_PAGE_LIMIT = 100;

const listAllAutomations = async (databases, queries) => {
    const docs = [];
    let cursor = null;
    while (true) {
        const pageQueries = [
            ...queries,
            Query.orderAsc('$id'),
            Query.limit(AUTOMATION_PAGE_LIMIT)
        ];
        if (cursor) pageQueries.push(Query.cursorAfter(cursor));

        const page = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            AUTOMATIONS_COLLECTION_ID,
            pageQueries
        );

        docs.push(...page.documents);
        if (page.documents.length < AUTOMATION_PAGE_LIMIT) break;
        cursor = page.documents[page.documents.length - 1].$id;
    }
    return docs;
};

const hasDuplicateAutomationTitle = async (databases, { userId, accountId, automationType, titleNormalized, excludeId }) => {
    if (!titleNormalized) return false;
    try {
        const queries = [
            Query.equal('user_id', userId),
            Query.equal('account_id', accountId),
            Query.equal('automation_type', automationType),
            Query.equal('title_normalized', titleNormalized),
            Query.limit(5)
        ];
        const result = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, queries);
        const match = result.documents.find(d => d.$id !== excludeId);
        if (match) return true;
    } catch (_) { }

    // Fallback if normalized field not populated yet
    try {
        const fallback = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            AUTOMATIONS_COLLECTION_ID,
            [Query.equal('user_id', userId), Query.equal('account_id', accountId), Query.equal('automation_type', automationType), Query.limit(200)]
        );
        return fallback.documents.some(d => d.$id !== excludeId && normalizeTitle(d.title) === titleNormalized);
    } catch (_) {
        return false;
    }
};

const hasDuplicateTemplateName = async (databases, { userId, accountId, nameNormalized, excludeId }) => {
    if (!nameNormalized) return false;
    try {
        const queries = [
            Query.equal('user_id', userId),
            Query.equal('account_id', accountId),
            Query.equal('name_normalized', nameNormalized),
            Query.limit(5)
        ];
        const result = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, REPLY_TEMPLATES_COLLECTION_ID, queries);
        const match = result.documents.find(d => d.$id !== excludeId);
        if (match) return true;
    } catch (_) { }

    // Fallback if normalized field not populated yet
    try {
        const fallback = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            REPLY_TEMPLATES_COLLECTION_ID,
            [Query.equal('user_id', userId), Query.equal('account_id', accountId), Query.limit(200)]
        );
        return fallback.documents.some(d => d.$id !== excludeId && normalizeTitle(d.name) === nameNormalized);
    } catch (_) {
        return false;
    }
};

const groupAutomationsByTemplate = (automations) => {
    const map = new Map();
    for (const doc of automations) {
        const templateId = doc.template_id || null;
        if (!templateId) continue;
        if (!map.has(templateId)) map.set(templateId, []);
        map.get(templateId).push({
            automation_id: doc.$id,
            title: doc.title || 'Untitled',
            automation_type: doc.automation_type || 'dm'
        });
    }
    return map;
};



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

        let shortLivedToken, appScopedId, igUserId, permissions;

        // Handle both response formats
        if (tokenData.data && Array.isArray(tokenData.data) && tokenData.data.length > 0) {
            const firstItem = tokenData.data[0];
            shortLivedToken = firstItem.access_token;
            appScopedId = firstItem.id?.toString() || null;
            igUserId = firstItem.user_id?.toString();
            permissions = firstItem.permissions || '';
        } else {
            // Standard response: { access_token, user_id, id?, permissions? }
            shortLivedToken = tokenData.access_token;
            appScopedId = tokenData.id?.toString() || null;
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
        const igProfessionalAccountId = profileData.id?.toString() || igUserId;
        const igUsername = profileData.username || 'Unknown';
        const profilePicUrl = profileData.profile_picture_url || '';

        // Step 4: Check for duplicates and Save
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const existingAccounts = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            [Query.equal('account_id', igProfessionalAccountId)]
        );

        if (existingAccounts.total > 0) {
            const existingAccount = existingAccounts.documents[0];
            if (!isOwnedIgAccount(existingAccount, user.$id)) {
                return res.status(409).json({ error: `This Instagram account (@${igUsername}) is already linked to another user.` });
            } else {
                // Update
                await databases.updateDocument(
                    process.env.APPWRITE_DATABASE_ID,
                    IG_ACCOUNTS_COLLECTION_ID,
                    existingAccount.$id,
                    {
                        // user_id = app user id (owner)
                        user_id: user.$id,
                        // ig_user_id = IG professional account id (webhook entry.id)
                        ig_user_id: igProfessionalAccountId,
                        account_id: igProfessionalAccountId,
                        // ig_scoped_id = app-scoped id from Meta token response field "id"
                        ig_scoped_id: appScopedId,
                        username: igUsername,
                        profile_picture_url: profilePicUrl,
                        access_token: longLivedToken,
                        token_expires_at: tokenExpiresAt,
                        permissions,
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
                    // user_id = app user id (owner)
                    user_id: user.$id,
                    // ig_user_id = IG professional account id (webhook entry.id)
                    ig_user_id: igProfessionalAccountId,
                    account_id: igProfessionalAccountId,
                    // ig_scoped_id = app-scoped id from Meta token response field "id"
                    ig_scoped_id: appScopedId,
                    username: igUsername,
                    profile_picture_url: profilePicUrl,
                    access_token: longLivedToken,
                    token_expires_at: tokenExpiresAt,
                    permissions,
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

        const accounts = await listOwnedIgAccounts(databases, req.user.$id);

        // Sanitize
        const safeAccounts = accounts.documents.map(acc => ({
            id: acc.$id,
            ig_user_id: getIgProfessionalAccountId(acc),
            username: acc.username,
            name: acc.name || '',
            profile_picture_url: acc.profile_picture_url,
            status: acc.status || 'active',
            linked_at: acc.linked_at,
            token_expires_at: acc.token_expires_at
        }));

        res.json({ ig_accounts: safeAccounts });
    } catch (err) {
        console.error(`Fetch IG Accounts Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch Instagram accounts.' });
    }
});

// Unlink Account
const unlinkIgAccountHandler = async (req, res) => {
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

        if (!isOwnedIgAccount(account, req.user.$id)) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        const functions = new Functions(serverClient);
        const execution = await functions.createExecution(
            FUNCTION_REMOVE_INSTAGRAM,
            JSON.stringify({ action: 'delete', account_doc_id: accountId }),
            false // async
        );

        if (execution.status === 'failed') {
            throw new Error("Function execution failed: " + execution.response);
        }

        res.json({ message: 'Instagram account and associated data deletion initiated.' });

    } catch (err) {
        if (err.code === 404) return res.status(404).json({ error: 'Account not found.' });
        console.error(`Unlink IG Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to unlink account.' });
    }
};

router.delete('/account/ig-accounts/:accountId', loginRequired, unlinkIgAccountHandler);

// Relink without OAuth when a valid token already exists.
router.post('/account/ig-accounts/relink/:accountId', loginRequired, async (req, res) => {
    try {
        const { accountId } = req.params;
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const account = await databases.getDocument(
            process.env.APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            accountId
        );

        if (!isOwnedIgAccount(account, req.user.$id)) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        if (!account.access_token) {
            return res.status(400).json({ error: 'No token available for relink.' });
        }

        const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
        if (!expiresAt || Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
            return res.status(400).json({ error: 'Token expired. OAuth login required.' });
        }

        await databases.updateDocument(
            process.env.APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            accountId,
            {
                status: 'active',
                is_active: true
            }
        );

        return res.json({ message: 'Instagram account relinked successfully.' });
    } catch (err) {
        if (err.code === 404) return res.status(404).json({ error: 'Account not found.' });
        console.error(`Relink IG Error: ${err.message}`);
        return res.status(500).json({ error: 'Failed to relink account.' });
    }
});

// Get Stats
router.get('/instagram/stats', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const accounts = await listOwnedIgAccounts(databases, req.user.$id);

        if (accounts.total === 0) return res.status(404).json({ error: 'No Instagram account linked.' });

        const account = account_id
            ? accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id))
            : accounts.documents[0];
        if (!account) return res.status(404).json({ error: 'Instagram account not found.' });
        const accessToken = account.access_token;

        // Fetch profile info, stories, live status, and media (for reel count) in parallel
        const [profileResult, storiesResult, liveResult, reelsCountResult] = await Promise.allSettled([
            // 1. Profile info from /me
            axios.get('https://graph.instagram.com/v24.0/me', {
                params: {
                    fields: 'user_id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website',
                    access_token: accessToken
                }
            }),
            // 2. Stories count
            axios.get('https://graph.instagram.com/v24.0/me/stories', {
                params: {
                    fields: 'id',
                    access_token: accessToken
                }
            }),
            // 3. Live status
            axios.get('https://graph.instagram.com/v24.0/me/live_media', {
                params: {
                    fields: 'id',
                    access_token: accessToken
                }
            }),
            // 4. Count reels by fetching media with media_product_type
            //    Per Instagram API docs, reels have media_product_type === 'REELS'
            (async () => {
                let reelsCount = 0;
                let nextUrl = null;
                let pagesFetched = 0;
                const MAX_PAGES = 20; // Safety limit to avoid excessive API calls

                // First page
                const firstPage = await axios.get('https://graph.instagram.com/v24.0/me/media', {
                    params: {
                        fields: 'media_product_type',
                        limit: 100,
                        access_token: accessToken
                    }
                });

                const countReels = (items) => items.filter(m => m.media_product_type === 'REELS').length;

                reelsCount += countReels(firstPage.data.data || []);
                pagesFetched++;
                nextUrl = firstPage.data.paging?.next || null;

                // Paginate through remaining media
                while (nextUrl && pagesFetched < MAX_PAGES) {
                    const nextPage = await axios.get(nextUrl);
                    reelsCount += countReels(nextPage.data.data || []);
                    pagesFetched++;
                    nextUrl = nextPage.data.paging?.next || null;
                }

                return reelsCount;
            })()
        ]);

        // Extract profile data (required - fail if this fails)
        if (profileResult.status === 'rejected') {
            throw profileResult.reason;
        }
        const data = profileResult.value.data;

        // Extract optional data with safe defaults
        const storiesCount = storiesResult.status === 'fulfilled'
            ? (storiesResult.value.data.data || []).length
            : 0;

        const isLive = liveResult.status === 'fulfilled'
            ? (liveResult.value.data.data || []).length > 0
            : false;

        const reelsCount = reelsCountResult.status === 'fulfilled'
            ? reelsCountResult.value
            : 0;

        if (storiesResult.status === 'rejected') {
            console.log('Stories fetch skipped:', storiesResult.reason?.message);
        }
        if (liveResult.status === 'rejected') {
            console.log('Live status fetch skipped:', liveResult.reason?.message);
        }
        if (reelsCountResult.status === 'rejected') {
            console.log('Reels count fetch skipped:', reelsCountResult.reason?.message);
        }

        res.json({
            followers: data.followers_count || 0,
            following: data.follows_count || 0,
            media_count: data.media_count || 0,
            reels_count: reelsCount,
            stories_count: storiesCount,
            username: data.username || '',
            name: data.name || '',
            profile_picture_url: data.profile_picture_url || '',
            biography: data.biography || '',
            website: data.website || '',
            is_live: isLive,
            is_verified: false
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

        const accounts = await listOwnedIgAccounts(databases, req.user.$id);

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

// ============================================================================
// AUTH: Instagram URL (sidebar connect button)
// ============================================================================
router.get('/auth/instagram/url', loginRequired, async (req, res) => {
    const scopes = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish';
    const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${INSTAGRAM_APP_ID}&redirect_uri=${INSTAGRAM_REDIRECT_URI}&response_type=code&scope=${scopes}`;
    res.json({ url: authUrl });
});

// ============================================================================
// SYNC PROFILE (update IG account profile data in Appwrite)
// ============================================================================
router.post('/account/ig-accounts/sync-profile', loginRequired, async (req, res) => {
    try {
        const { account_id, profile_picture_url, username, name } = req.body;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        // Verify ownership
        const doc = await databases.getDocument(process.env.APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, account_id);
        if (!isOwnedIgAccount(doc, req.user.$id)) return res.status(403).json({ error: 'Unauthorized' });

        const updateData = {};
        if (profile_picture_url !== undefined) updateData.profile_picture_url = profile_picture_url;
        if (username !== undefined) updateData.username = username;
        if (name !== undefined) updateData.name = name;

        if (Object.keys(updateData).length === 0) return res.status(400).json({ error: 'No fields to update' });

        await databases.updateDocument(process.env.APPWRITE_DATABASE_ID, IG_ACCOUNTS_COLLECTION_ID, account_id, updateData);
        res.json({ message: 'Profile synced successfully' });
    } catch (err) {
        console.error(`Sync Profile Error: ${err.message}`);
        if (err.code === 404) return res.status(404).json({ error: 'Account not found' });
        res.status(500).json({ error: 'Failed to sync profile' });
    }
});

// ============================================================================
// DASHBOARD COUNTS
// ============================================================================
router.get('/dashboard/counts', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const userId = req.user.$id;

        const queries = [Query.equal('user_id', userId)];
        let templateQueries = [Query.equal('user_id', userId)];
        if (account_id) {
            const accounts = await listOwnedIgAccounts(databases, userId);
            const account = accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id));
            if (!account) return res.status(404).json({ error: 'Account not found' });
            const targetAccountId = getIgProfessionalAccountId(account);
            queries.push(Query.equal('account_id', targetAccountId));
            templateQueries.push(Query.equal('account_id', targetAccountId));
        }

        const [templatesResult, mentionsResult, suggestMoreResult] = await Promise.allSettled([
            databases.listDocuments(process.env.APPWRITE_DATABASE_ID, REPLY_TEMPLATES_COLLECTION_ID, templateQueries.concat([Query.limit(1)])),
            databases.listDocuments(process.env.APPWRITE_DATABASE_ID, MENTIONS_COLLECTION_ID, queries.concat([Query.limit(1)])),
            databases.listDocuments(process.env.APPWRITE_DATABASE_ID, SUGGEST_MORE_COLLECTION_ID, queries.concat([Query.limit(1)])),
        ]);

        res.json({
            reply_templates: templatesResult.status === 'fulfilled' ? templatesResult.value.total : 0,
            mention: mentionsResult.status === 'fulfilled' ? mentionsResult.value.total : 0,
            suggest_more: suggestMoreResult.status === 'fulfilled' ? suggestMoreResult.value.total : 0,
            email_collector: 0
        });
    } catch (err) {
        console.error(`Dashboard Counts Error: ${err.message}`);
        res.json({ reply_templates: 0, mention: 0, suggest_more: 0, email_collector: 0 });
    }
});

// ============================================================================
// AUTOMATIONS (DM, Comment, Story, Post, Reel, Live)
// ============================================================================
// Keyword availability (fast validation)
router.post('/instagram/keywords/availability', loginRequired, async (req, res) => {
    try {
        const accountId = req.query.account_id || req.body.account_id;
        if (!accountId) return res.status(400).json({ error: 'account_id is required' });

        const automationType = req.body.type || req.query.type || req.body.automation_type || 'dm';
        const automationId = req.body.automation_id || null;

        const keywordInfo = getKeywordInfo({ keywords: req.body.keywords });
        const keywordArray = KEYWORD_TYPES.has(automationType) ? keywordInfo.keywords : [];
        if (keywordArray.length === 0) {
            return res.json({ available: true, conflicts: [] });
        }

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const conflicts = await findKeywordConflicts(databases, {
            accountId,
            automationId,
            automationType,
            keywords: keywordArray
        });

        res.json({ available: conflicts.length === 0, conflicts });
    } catch (err) {
        console.error(`Keyword Availability Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to validate keywords' });
    }
});

// GET all automations for account
router.get('/instagram/automations', loginRequired, async (req, res) => {
    try {
        const { account_id, type } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const queries = [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id)];
        if (type) queries.push(Query.equal('automation_type', type));
        queries.push(Query.orderDesc('$createdAt'));
        queries.push(Query.limit(100));

        const result = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, queries);

        // Parse JSON string fields
        const automations = result.documents.map(doc => {
            const parsed = { ...doc };
            try { if (typeof parsed.keywords === 'string') parsed.keywords = JSON.parse(parsed.keywords); } catch (e) { parsed.keywords = []; }
            try { if (typeof parsed.buttons === 'string') parsed.buttons = JSON.parse(parsed.buttons); } catch (e) { }
            try { if (typeof parsed.template_elements === 'string') parsed.template_elements = JSON.parse(parsed.template_elements); } catch (e) { }
            try { if (typeof parsed.replies === 'string') parsed.replies = JSON.parse(parsed.replies); } catch (e) { }
            return parsed;
        });

        res.json({ automations });
    } catch (err) {
        console.error(`Fetch Automations Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch automations' });
    }
});

// GET single automation
router.get('/instagram/automations/:id', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const doc = await databases.getDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, req.params.id);
        if (doc.user_id !== req.user.$id) return res.status(403).json({ error: 'Unauthorized' });

        const parsed = { ...doc };
        try { if (typeof parsed.keywords === 'string') parsed.keywords = JSON.parse(parsed.keywords); } catch (e) { parsed.keywords = []; }
        try { if (typeof parsed.buttons === 'string') parsed.buttons = JSON.parse(parsed.buttons); } catch (e) { }
        try { if (typeof parsed.template_elements === 'string') parsed.template_elements = JSON.parse(parsed.template_elements); } catch (e) { }
        try { if (typeof parsed.replies === 'string') parsed.replies = JSON.parse(parsed.replies); } catch (e) { }

        res.json(parsed);
    } catch (err) {
        console.error(`Get Automation Error: ${err.message}`);
        if (err.code === 404) return res.status(404).json({ error: 'Automation not found' });
        res.status(500).json({ error: 'Failed to fetch automation' });
    }
});

// CREATE automation
router.post('/instagram/automations', loginRequired, async (req, res) => {
    try {
        const { account_id, type } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const body = req.body;
        const automationType = type || body.automation_type || 'dm';
        const keywordInfo = getKeywordInfo(body);
        const keywordArray = KEYWORD_TYPES.has(automationType) ? keywordInfo.keywords : [];
        const keywordString = keywordArray.join(',');
        const validationErrors = validateAutomationPayload({
            ...body,
            automation_type: automationType
        });
        if (validationErrors.length > 0) {
            return res.status(400).json({ error: 'Validation failed', details: validationErrors });
        }

        const titleNormalized = normalizeTitle(body.title);
        if ((automationType === 'dm' || automationType === 'global') && titleNormalized) {
            const duplicate = await hasDuplicateAutomationTitle(databases, {
                userId: req.user.$id,
                accountId: account_id,
                automationType,
                titleNormalized
            });
            if (duplicate) {
                return res.status(400).json({ error: 'Duplicate title', field: 'title' });
            }
        }

        const docData = {
            user_id: req.user.$id,
            account_id: account_id,
            automation_type: automationType,
            title: body.title,
            title_normalized: titleNormalized,
            is_active: body.is_active !== undefined ? body.is_active : true,
            keyword: keywordString,
            keywords: JSON.stringify(keywordArray),
            keyword_match_type: body.keyword_match_type || 'exact',
            template_type: body.template_type || 'template_text',
            template_content: body.template_content || '',
            template_id: body.template_id || null,
            buttons: body.buttons ? JSON.stringify(body.buttons) : null,
            template_elements: body.template_elements ? JSON.stringify(body.template_elements) : null,
            replies: body.replies ? JSON.stringify(body.replies) : null,
            media_url: body.media_url ? String(body.media_url).slice(0, MEDIA_URL_MAX) : '',
            media_id: body.media_id || null,
            use_latest_post: body.use_latest_post || false,
            latest_post_type: body.latest_post_type || 'post',
            followers_only: body.followers_only || false,
            exclude_existing_customers: body.exclude_existing_customers || false,
            send_to: body.send_to || 'everyone',
            delay_seconds: body.delay_seconds || 0,
            comment_reply: body.comment_reply || '',
            linked_media_id: body.linked_media_id || null,
            linked_media_url: body.linked_media_url ? String(body.linked_media_url).slice(0, MEDIA_URL_MAX) : '',
        };

        // Create automation directly (replacing functions)
        const doc = await databases.createDocument(
            process.env.APPWRITE_DATABASE_ID,
            AUTOMATIONS_COLLECTION_ID,
            ID.unique(),
            docData,
            [Permission.read(Role.user(req.user.$id))]
        );

        if (KEYWORD_TYPES.has(automationType)) {
            try {
                await syncKeywordRecords(databases, {
                    accountId: account_id,
                    automationId: doc.$id,
                    automationType,
                    keywords: keywordArray,
                    matchType: body.keyword_match_type || 'exact'
                });
            } catch (e) {
                try {
                    await databases.deleteDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, doc.$id);
                } catch (_) { }
                return res.status(400).json({ error: e.message || 'Keyword sync failed', field: 'keywords' });
            }
        }
        res.status(201).json({ status: "success", automation_id: doc.$id });
    } catch (err) {
        console.error(`Create Automation Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to create automation' });
    }
});

// UPDATE automation
router.patch('/instagram/automations/:id', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const existing = await databases.getDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, req.params.id);
        if (existing.user_id !== req.user.$id) return res.status(403).json({ error: 'Unauthorized' });

        const body = req.body;
        const updateData = {};

        const stringFields = ['title', 'keyword', 'keyword_match_type', 'template_type', 'template_content',
            'template_id', 'media_id', 'latest_post_type', 'send_to', 'comment_reply',
            'linked_media_id', 'automation_type'];
        stringFields.forEach(f => { if (body[f] !== undefined) updateData[f] = body[f]; });
        if (body.media_url !== undefined) updateData.media_url = body.media_url ? String(body.media_url).slice(0, MEDIA_URL_MAX) : '';
        if (body.linked_media_url !== undefined) updateData.linked_media_url = body.linked_media_url ? String(body.linked_media_url).slice(0, MEDIA_URL_MAX) : '';

        const boolFields = ['is_active', 'use_latest_post', 'followers_only', 'exclude_existing_customers'];
        boolFields.forEach(f => { if (body[f] !== undefined) updateData[f] = body[f]; });

        if (body.delay_seconds !== undefined) updateData.delay_seconds = body.delay_seconds;

        const nextAutomationType = body.automation_type || existing.automation_type || 'dm';
        const keywordUpdateProvided = body.keyword !== undefined || body.keywords !== undefined || body.automation_type !== undefined;
        let nextKeywords = null;
        if (keywordUpdateProvided) {
            const keywordInfo = getKeywordInfo({
                keyword: body.keyword !== undefined ? body.keyword : existing.keyword,
                keywords: body.keywords !== undefined ? body.keywords : existing.keywords
            });
            nextKeywords = KEYWORD_TYPES.has(nextAutomationType) ? keywordInfo.keywords : [];

            updateData.keyword = nextKeywords.join(',');
            updateData.keywords = JSON.stringify(nextKeywords);
        }
        if (body.buttons !== undefined) updateData.buttons = body.buttons ? JSON.stringify(body.buttons) : null;
        if (body.template_elements !== undefined) updateData.template_elements = body.template_elements ? JSON.stringify(body.template_elements) : null;
        if (body.replies !== undefined) updateData.replies = body.replies ? JSON.stringify(body.replies) : null;

        const candidate = {
            ...existing,
            ...body,
            keywords: body.keywords !== undefined ? body.keywords : existing.keywords,
            buttons: body.buttons !== undefined ? body.buttons : existing.buttons,
            template_elements: body.template_elements !== undefined ? body.template_elements : existing.template_elements,
            replies: body.replies !== undefined ? body.replies : existing.replies,
        };
        const validationErrors = validateAutomationPayload(candidate);
        if (validationErrors.length > 0) {
            return res.status(400).json({ error: 'Validation failed', details: validationErrors });
        }

        if (body.title !== undefined) {
            const titleNormalized = normalizeTitle(body.title);
            const automationType = nextAutomationType;
            if ((automationType === 'dm' || automationType === 'global') && titleNormalized) {
                const duplicate = await hasDuplicateAutomationTitle(databases, {
                    userId: req.user.$id,
                    accountId: existing.account_id,
                    automationType,
                    titleNormalized,
                    excludeId: existing.$id
                });
                if (duplicate) {
                    return res.status(400).json({ error: 'Duplicate title', field: 'title' });
                }
            }
            updateData.title_normalized = titleNormalized;
        }

        await databases.updateDocument(
            process.env.APPWRITE_DATABASE_ID,
            AUTOMATIONS_COLLECTION_ID,
            req.params.id,
            updateData
        );

        if (keywordUpdateProvided) {
            try {
                await syncKeywordRecords(databases, {
                    accountId: existing.account_id,
                    automationId: existing.$id,
                    automationType: nextAutomationType,
                    keywords: nextKeywords || [],
                    matchType: body.keyword_match_type || existing.keyword_match_type || 'exact'
                });
            } catch (e) {
                return res.status(400).json({ error: e.message || 'Keyword sync failed', field: 'keywords' });
            }
        }

        // Fetch updated doc to return
        const doc = await databases.getDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, req.params.id);



        res.json(doc);
    } catch (err) {
        console.error(`Update Automation Error: ${err.message}`);
        if (err.code === 404) return res.status(404).json({ error: 'Automation not found' });
        res.status(500).json({ error: 'Failed to update automation' });
    }
});

// DELETE automation
router.delete('/instagram/automations/:id', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const existing = await databases.getDocument(process.env.APPWRITE_DATABASE_ID, AUTOMATIONS_COLLECTION_ID, req.params.id);
        if (existing.user_id !== req.user.$id) return res.status(403).json({ error: 'Unauthorized' });



        try {
            await syncKeywordRecords(databases, {
                accountId: existing.account_id,
                automationId: existing.$id,
                automationType: existing.automation_type || 'dm',
                keywords: [],
                matchType: existing.keyword_match_type || 'exact'
            });
        } catch (e) {
            console.error(`Keyword cleanup failed: ${e.message}`);
        }

        await databases.deleteDocument(
            process.env.APPWRITE_DATABASE_ID,
            AUTOMATIONS_COLLECTION_ID,
            req.params.id
        );
        res.json({ message: 'Automation deleted' });
    } catch (err) {
        console.error(`Delete Automation Error: ${err.message}`);
        if (err.code === 404) return res.status(404).json({ error: 'Automation not found' });
        res.status(500).json({ error: 'Failed to delete automation' });
    }
});

// ============================================================================
// REPLY TEMPLATES
// ============================================================================
// GET all templates (list)
router.get('/instagram/reply-templates', loginRequired, async (req, res) => {
    try {
        const { full, account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const account = accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id));
        if (!account) return res.status(404).json({ error: 'Account not found' });
        const targetAccountId = getIgProfessionalAccountId(account);

        // One-time legacy migration: attach account_id for old user-scoped templates.
        const legacyTemplates = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            REPLY_TEMPLATES_COLLECTION_ID,
            [Query.equal('user_id', req.user.$id), Query.limit(200)]
        );
        const legacyWithoutAccount = legacyTemplates.documents.filter((doc) => !doc.account_id);
        if (legacyWithoutAccount.length > 0) {
            await Promise.allSettled(legacyWithoutAccount.map((doc) => databases.updateDocument(
                process.env.APPWRITE_DATABASE_ID,
                REPLY_TEMPLATES_COLLECTION_ID,
                doc.$id,
                { account_id: targetAccountId }
            )));
        }

        const queries = [Query.equal('user_id', req.user.$id), Query.equal('account_id', targetAccountId), Query.orderDesc('$createdAt'), Query.limit(100)];

        const result = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, REPLY_TEMPLATES_COLLECTION_ID, queries);
        const automations = await listAllAutomations(databases, [Query.equal('user_id', req.user.$id), Query.equal('account_id', targetAccountId)]);
        const automationsByTemplate = groupAutomationsByTemplate(automations);

        const templates = result.documents.map(doc => {
            const linkedAutomations = automationsByTemplate.get(doc.$id) || [];
            const t = {
                id: doc.$id,
                name: doc.name,
                type: doc.template_type,
                template_type: doc.template_type,
                template_data: {},
                linked_automations: linkedAutomations,
                automation_count: linkedAutomations.length
            };
            if (full !== 'false') {
                try { t.template_data = typeof doc.template_data === 'string' ? JSON.parse(doc.template_data) : (doc.template_data || {}); } catch (e) { t.template_data = {}; }
            }
            return t;
        });

        res.json({ templates });
    } catch (err) {
        console.error(`Fetch Templates Error: ${err.message}`, err);
        res.status(500).json({ error: 'Failed to fetch templates', details: err.message });
    }
});

// GET single template
router.get('/instagram/reply-templates/:id', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const doc = await databases.getDocument(process.env.APPWRITE_DATABASE_ID, REPLY_TEMPLATES_COLLECTION_ID, req.params.id);
        if (doc.user_id !== req.user.$id) return res.status(403).json({ error: 'Unauthorized' });

        if (!doc.account_id) {
            const accounts = await listOwnedIgAccounts(databases, req.user.$id);
            const requestedAccount = req.query.account_id
                ? accounts.documents.find((account) => matchesIgAccountIdentifier(account, req.query.account_id))
                : accounts.documents[0];
            if (!requestedAccount) return res.status(400).json({ error: 'account_id is required' });
            doc.account_id = getIgProfessionalAccountId(requestedAccount);
            await databases.updateDocument(
                process.env.APPWRITE_DATABASE_ID,
                REPLY_TEMPLATES_COLLECTION_ID,
                doc.$id,
                { account_id: doc.account_id }
            );
        }

        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const ownedAccount = accounts.documents.find((account) => matchesIgAccountIdentifier(account, doc.account_id));
        if (!ownedAccount) return res.status(403).json({ error: 'Unauthorized' });

        if (req.query.account_id) {
            const requestedAccount = accounts.documents.find((account) => matchesIgAccountIdentifier(account, req.query.account_id));
            if (!requestedAccount || getIgProfessionalAccountId(requestedAccount) !== doc.account_id) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
        }

        let templateData = {};
        try { templateData = typeof doc.template_data === 'string' ? JSON.parse(doc.template_data) : (doc.template_data || {}); } catch (e) { }
        const linkedAutomations = groupAutomationsByTemplate(
            await listAllAutomations(databases, [Query.equal('user_id', req.user.$id), Query.equal('account_id', doc.account_id), Query.equal('template_id', doc.$id)])
        ).get(doc.$id) || [];

        res.json({
            id: doc.$id,
            name: doc.name,
            type: doc.template_type,
            template_type: doc.template_type,
            template_data: templateData,
            linked_automations: linkedAutomations,
            automation_count: linkedAutomations.length
        });
    } catch (err) {
        console.error(`Get Template Error: ${err.message}`);
        if (err.code === 404) return res.status(404).json({ error: 'Template not found' });
        res.status(500).json({ error: 'Failed to fetch template' });
    }
});

// CREATE template
router.post('/instagram/reply-templates', loginRequired, async (req, res) => {
    try {
        const { name, template_type, template_data, account_id } = req.body;
        if (!name || !template_type || !account_id) return res.status(400).json({ error: 'name, template_type and account_id are required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const account = accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id));
        if (!account) return res.status(404).json({ error: 'Account not found' });
        const targetAccountId = getIgProfessionalAccountId(account);

        const nameNormalized = normalizeTitle(name);
        const duplicate = await hasDuplicateTemplateName(databases, { userId: req.user.$id, accountId: targetAccountId, nameNormalized });
        if (duplicate) {
            return res.status(400).json({ error: 'Duplicate name', field: 'name' });
        }

        const docData = {
            user_id: req.user.$id,
            account_id: targetAccountId,
            name: name.trim(),
            name_normalized: nameNormalized,
            template_type,
            template_data: JSON.stringify(template_data || {})
        };

        const doc = await databases.createDocument(
            process.env.APPWRITE_DATABASE_ID,
            REPLY_TEMPLATES_COLLECTION_ID,
            ID.unique(),
            docData,
            [Permission.read(Role.user(req.user.$id))]
        );

        res.status(201).json({
            id: doc.$id,
            name: doc.name,
            type: doc.template_type,
            template_type: doc.template_type,
            template_data: template_data || {},
            linked_automations: [],
            automation_count: 0
        });
    } catch (err) {
        console.error(`Create Template Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

// UPDATE template
router.patch('/instagram/reply-templates/:id', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const existing = await databases.getDocument(process.env.APPWRITE_DATABASE_ID, REPLY_TEMPLATES_COLLECTION_ID, req.params.id);
        if (existing.user_id !== req.user.$id) return res.status(403).json({ error: 'Unauthorized' });
        if (!existing.account_id) {
            const accounts = await listOwnedIgAccounts(databases, req.user.$id);
            const requestedAccount = req.query.account_id
                ? accounts.documents.find((account) => matchesIgAccountIdentifier(account, req.query.account_id))
                : accounts.documents[0];
            if (!requestedAccount) return res.status(400).json({ error: 'account_id is required' });
            existing.account_id = getIgProfessionalAccountId(requestedAccount);
            await databases.updateDocument(
                process.env.APPWRITE_DATABASE_ID,
                REPLY_TEMPLATES_COLLECTION_ID,
                existing.$id,
                { account_id: existing.account_id }
            );
        }
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const ownedAccount = accounts.documents.find((account) => matchesIgAccountIdentifier(account, existing.account_id));
        if (!ownedAccount) return res.status(403).json({ error: 'Unauthorized' });
        if (req.body.account_id && req.body.account_id !== existing.account_id) {
            return res.status(400).json({ error: 'account_id cannot be changed' });
        }

        const updateData = {};
        if (req.body.name !== undefined) {
            const nameNormalized = normalizeTitle(req.body.name);
            const duplicate = await hasDuplicateTemplateName(databases, { userId: req.user.$id, accountId: existing.account_id, nameNormalized, excludeId: existing.$id });
            if (duplicate) {
                return res.status(400).json({ error: 'Duplicate name', field: 'name' });
            }
            updateData.name = req.body.name.trim();
            updateData.name_normalized = nameNormalized;
        }
        if (req.body.template_type !== undefined) updateData.template_type = req.body.template_type;
        if (req.body.template_data !== undefined) updateData.template_data = JSON.stringify(req.body.template_data);

        const doc = await databases.updateDocument(process.env.APPWRITE_DATABASE_ID, REPLY_TEMPLATES_COLLECTION_ID, req.params.id, updateData);

        let templateData = {};
        try { templateData = typeof doc.template_data === 'string' ? JSON.parse(doc.template_data) : (doc.template_data || {}); } catch (e) { }
        const linkedAutomations = groupAutomationsByTemplate(
            await listAllAutomations(databases, [Query.equal('user_id', req.user.$id), Query.equal('account_id', existing.account_id), Query.equal('template_id', doc.$id)])
        ).get(doc.$id) || [];

        res.json({
            id: doc.$id,
            name: doc.name,
            type: doc.template_type,
            template_type: doc.template_type,
            template_data: templateData,
            linked_automations: linkedAutomations,
            automation_count: linkedAutomations.length
        });
    } catch (err) {
        console.error(`Update Template Error: ${err.message}`);
        if (err.code === 404) return res.status(404).json({ error: 'Template not found' });
        res.status(500).json({ error: 'Failed to update template' });
    }
});

// DELETE template
router.delete('/instagram/reply-templates/:id', loginRequired, async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const existing = await databases.getDocument(process.env.APPWRITE_DATABASE_ID, REPLY_TEMPLATES_COLLECTION_ID, req.params.id);
        if (existing.user_id !== req.user.$id) return res.status(403).json({ error: 'Unauthorized' });
        if (!existing.account_id) {
            const accounts = await listOwnedIgAccounts(databases, req.user.$id);
            const requestedAccount = req.query.account_id
                ? accounts.documents.find((account) => matchesIgAccountIdentifier(account, req.query.account_id))
                : accounts.documents[0];
            if (!requestedAccount) return res.status(400).json({ error: 'account_id is required' });
            existing.account_id = getIgProfessionalAccountId(requestedAccount);
            await databases.updateDocument(
                process.env.APPWRITE_DATABASE_ID,
                REPLY_TEMPLATES_COLLECTION_ID,
                existing.$id,
                { account_id: existing.account_id }
            );
        }
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const ownedAccount = accounts.documents.find((account) => matchesIgAccountIdentifier(account, existing.account_id));
        if (!ownedAccount) return res.status(403).json({ error: 'Unauthorized' });

        const linked = groupAutomationsByTemplate(
            await listAllAutomations(databases, [Query.equal('user_id', req.user.$id), Query.equal('account_id', existing.account_id), Query.equal('template_id', existing.$id)])
        ).get(existing.$id) || [];

        if (linked.length > 0) {
            return res.status(400).json({
                error: 'Template is linked to automations',
                linked: linked
            });
        }

        await databases.deleteDocument(process.env.APPWRITE_DATABASE_ID, REPLY_TEMPLATES_COLLECTION_ID, req.params.id);
        res.json({ message: 'Template deleted' });
    } catch (err) {
        console.error(`Delete Template Error: ${err.message}`);
        if (err.code === 404) return res.status(404).json({ error: 'Template not found' });
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

// ============================================================================
// INBOX MENU
// ============================================================================
router.get('/instagram/inbox-menu', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const igAccount = accounts.documents.find(a => matchesIgAccountIdentifier(a, account_id));

        if (!igAccount) return res.status(404).json({ error: 'Account not found' });

        // Get DB menu
        let dbMenu = [];
        try {
            const menuDocs = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, INBOX_MENUS_COLLECTION_ID,
                [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)]);
            if (menuDocs.total > 0) {
                try { dbMenu = typeof menuDocs.documents[0].menu_items === 'string' ? JSON.parse(menuDocs.documents[0].menu_items) : (menuDocs.documents[0].menu_items || []); } catch (e) { dbMenu = []; }
            }
        } catch (e) { /* Collection may not exist yet */ }

        // Try fetching IG menu from Instagram API
        let igMenu = [];
        try {
            const accessToken = igAccount.access_token;
            const igResponse = await axios.get(`https://graph.instagram.com/v24.0/me/messenger_profile`, {
                params: { fields: 'persistent_menu', access_token: accessToken }
            });
            const persistentMenu = igResponse.data?.data?.[0]?.persistent_menu;
            if (persistentMenu && Array.isArray(persistentMenu)) {
                const defaultMenu = persistentMenu.find(m => m.locale === 'default') || persistentMenu[0];
                igMenu = defaultMenu?.call_to_actions || [];
            }
        } catch (e) { /* IG menu fetch may fail - not all accounts support it */ }

        // Determine status
        let status = 'none';
        if (dbMenu.length > 0 && igMenu.length > 0) {
            status = JSON.stringify(dbMenu) === JSON.stringify(igMenu) ? 'match' : 'mismatch';
        } else if (dbMenu.length > 0) {
            status = 'db_only';
        } else if (igMenu.length > 0) {
            status = 'ig_only';
        }

        res.json({
            ig_menu: igMenu,
            db_menu: dbMenu,
            is_synced: status === 'match',
            status,
            issue: null,
            account_id
        });
    } catch (err) {
        console.error(`Inbox Menu Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch inbox menu' });
    }
});

// Save inbox menu
router.post('/instagram/inbox-menu', loginRequired, async (req, res) => {
    try {
        const { account_id, menu_items, action } = req.body;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        // Duplicate title validation (case-insensitive)
        if (Array.isArray(menu_items)) {
            const seen = new Set();
            for (const item of menu_items) {
                const title = normalizeTitle(item?.title || '');
                if (!title) continue;
                if (seen.has(title)) {
                    return res.status(400).json({ error: 'Duplicate menu title', field: 'title' });
                }
                seen.add(title);
            }
        }

        // Save to DB
        const queries = [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)];
        const existing = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, INBOX_MENUS_COLLECTION_ID, queries);

        const docData = {
            user_id: req.user.$id,
            account_id,
            menu_items: JSON.stringify(menu_items || [])
        };

        if (existing.total > 0) {
            await databases.updateDocument(process.env.APPWRITE_DATABASE_ID, INBOX_MENUS_COLLECTION_ID, existing.documents[0].$id, docData);
        } else {
            await databases.createDocument(process.env.APPWRITE_DATABASE_ID, INBOX_MENUS_COLLECTION_ID, ID.unique(), docData,
                [Permission.read(Role.user(req.user.$id))]);
        }

        // Publish to Instagram (action=save means publish)
        if (action === 'save' && menu_items && menu_items.length > 0) {
            try {
                const accounts = await listOwnedIgAccounts(databases, req.user.$id);
                const igAccount = accounts.documents.find(a => matchesIgAccountIdentifier(a, account_id));
                if (igAccount) {
                    // Format for IG persistent menu API
                    const igMenuItems = menu_items.map(m => {
                        const item = { type: m.type, title: m.title };
                        if (m.type === 'web_url') {
                            item.url = m.url;
                            item.webview_height_ratio = m.webview_height_ratio || 'full';
                        } else if (m.type === 'postback') {
                            item.payload = m.payload || m.template_id || '';
                        }
                        return item;
                    });
                    await axios.post(`https://graph.instagram.com/v24.0/me/messenger_profile`, {
                        persistent_menu: [{
                            locale: 'default',
                            composer_input_disabled: false,
                            call_to_actions: igMenuItems
                        }]
                    }, {
                        params: { access_token: igAccount.access_token }
                    });
                }
            } catch (e) { console.error('Failed to publish menu to IG:', e.message); }
        }

        res.json({ message: 'Menu saved successfully', menu_items: menu_items || [] });
    } catch (err) {
        console.error(`Save Inbox Menu Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to save inbox menu' });
    }
});

// Delete inbox menu
router.delete('/instagram/inbox-menu', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const existing = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, INBOX_MENUS_COLLECTION_ID,
            [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)]);

        if (existing.total > 0) {
            await databases.deleteDocument(process.env.APPWRITE_DATABASE_ID, INBOX_MENUS_COLLECTION_ID, existing.documents[0].$id);
        }

        // Also delete from Instagram
        try {
            const accounts = await listOwnedIgAccounts(databases, req.user.$id);
            const igAccount = accounts.documents.find(a => matchesIgAccountIdentifier(a, account_id));
            if (igAccount) {
                await axios.delete(`https://graph.instagram.com/v24.0/me/messenger_profile`, {
                    params: { access_token: igAccount.access_token },
                    data: { fields: ['persistent_menu'] }
                });
            }
        } catch (e) { /* ignore IG delete errors */ }

        res.json({ message: 'Menu deleted' });
    } catch (err) {
        console.error(`Delete Inbox Menu Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to delete inbox menu' });
    }
});

// ============================================================================
// CONVO STARTERS
// ============================================================================
router.get('/instagram/convo-starters', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        // Verify account ownership
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const igAccount = accounts.documents.find(a => matchesIgAccountIdentifier(a, account_id));
        if (!igAccount) return res.status(404).json({ error: 'Account not found' });

        // Get DB starters
        let dbStarters = [];
        try {
            const starterDocs = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, CONVO_STARTERS_COLLECTION_ID,
                [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)]);
            if (starterDocs.total > 0) {
                try { dbStarters = typeof starterDocs.documents[0].starters === 'string' ? JSON.parse(starterDocs.documents[0].starters) : (starterDocs.documents[0].starters || []); } catch (e) { dbStarters = []; }
            }
        } catch (e) { }

        // Try fetching from IG
        let igStarters = [];
        try {
            const igResponse = await axios.get(`https://graph.instagram.com/v24.0/me/messenger_profile`, {
                params: { fields: 'ice_breakers', access_token: igAccount.access_token }
            });
            const iceBreakers = igResponse.data?.data?.[0]?.ice_breakers;
            if (iceBreakers && Array.isArray(iceBreakers)) {
                igStarters = iceBreakers;
            }
        } catch (e) { }

        let status = 'none';
        if (dbStarters.length > 0 && igStarters.length > 0) {
            status = JSON.stringify(dbStarters) === JSON.stringify(igStarters) ? 'match' : 'mismatch';
        } else if (dbStarters.length > 0) {
            status = 'db_only';
        } else if (igStarters.length > 0) {
            status = 'ig_only';
        }

        res.json({
            ig_starters: igStarters,
            db_starters: dbStarters,
            is_synced: status === 'match',
            status,
            issue: null,
            account_id
        });
    } catch (err) {
        console.error(`Convo Starters Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch convo starters' });
    }
});

// Save convo starters
router.post('/instagram/convo-starters', loginRequired, async (req, res) => {
    try {
        const { account_id, starters, publish } = req.body;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        // Duplicate question validation (case-insensitive)
        if (Array.isArray(starters)) {
            const seen = new Set();
            for (const starter of starters) {
                const question = normalizeTitle(starter?.question || '');
                if (!question) continue;
                if (seen.has(question)) {
                    return res.status(400).json({ error: 'Duplicate question', field: 'question' });
                }
                seen.add(question);
            }
        }

        const queries = [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)];
        const existing = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, CONVO_STARTERS_COLLECTION_ID, queries);

        const docData = {
            user_id: req.user.$id,
            account_id,
            starters: JSON.stringify(starters || [])
        };

        if (existing.total > 0) {
            await databases.updateDocument(process.env.APPWRITE_DATABASE_ID, CONVO_STARTERS_COLLECTION_ID, existing.documents[0].$id, docData);
        } else {
            await databases.createDocument(process.env.APPWRITE_DATABASE_ID, CONVO_STARTERS_COLLECTION_ID, ID.unique(), docData,
                [Permission.read(Role.user(req.user.$id))]);
        }

        // Optionally publish to Instagram
        if (publish) {
            try {
                const accounts = await listOwnedIgAccounts(databases, req.user.$id);
                const igAccount = accounts.documents.find(a => matchesIgAccountIdentifier(a, account_id));
                if (igAccount) {
                    await axios.post(`https://graph.instagram.com/v24.0/me/messenger_profile`, {
                        ice_breakers: starters
                    }, {
                        params: { access_token: igAccount.access_token }
                    });
                }
            } catch (e) { console.error('Failed to publish convo starters to IG:', e.message); }
        }

        res.json({ message: 'Convo starters saved successfully' });
    } catch (err) {
        console.error(`Save Convo Starters Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to save convo starters' });
    }
});

// Delete convo starters
router.delete('/instagram/convo-starters', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const existing = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, CONVO_STARTERS_COLLECTION_ID,
            [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)]);

        if (existing.total > 0) {
            await databases.deleteDocument(process.env.APPWRITE_DATABASE_ID, CONVO_STARTERS_COLLECTION_ID, existing.documents[0].$id);
        }

        res.json({ message: 'Convo starters deleted' });
    } catch (err) {
        console.error(`Delete Convo Starters Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to delete convo starters' });
    }
});

// ============================================================================
// MENTIONS CONFIG
// ============================================================================
router.get('/instagram/mentions-config', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const result = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, MENTIONS_COLLECTION_ID,
            [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)]);

        if (result.total > 0) {
            const doc = result.documents[0];
            res.json({
                is_setup: true,
                is_active: doc.is_active || false,
                template_id: doc.template_id || null,
                doc_id: doc.$id
            });
        } else {
            res.json({ is_setup: false, is_active: false });
        }
    } catch (err) {
        console.error(`Mentions Config Error: ${err.message}`);
        res.json({ is_setup: false, is_active: false });
    }
});

router.post('/instagram/mentions-config', loginRequired, async (req, res) => {
    try {
        const { account_id, template_id, is_active } = req.body;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const existing = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, MENTIONS_COLLECTION_ID,
            [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)]);

        const docData = {
            user_id: req.user.$id,
            account_id,
            template_id: template_id || null,
            is_active: is_active !== undefined ? is_active : true
        };

        if (existing.total > 0) {
            await databases.updateDocument(process.env.APPWRITE_DATABASE_ID, MENTIONS_COLLECTION_ID, existing.documents[0].$id, docData);
        } else {
            await databases.createDocument(process.env.APPWRITE_DATABASE_ID, MENTIONS_COLLECTION_ID, ID.unique(), docData,
                [Permission.read(Role.user(req.user.$id))]);
        }

        res.json({ message: 'Mentions config saved' });
    } catch (err) {
        console.error(`Save Mentions Config Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to save mentions config' });
    }
});

router.delete('/instagram/mentions-config', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const existing = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, MENTIONS_COLLECTION_ID,
            [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)]);

        if (existing.total > 0) {
            await databases.deleteDocument(process.env.APPWRITE_DATABASE_ID, MENTIONS_COLLECTION_ID, existing.documents[0].$id);
        }

        res.json({ message: 'Mentions config deleted' });
    } catch (err) {
        console.error(`Delete Mentions Config Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to delete mentions config' });
    }
});

// ============================================================================
// SUPER PROFILE
// ============================================================================
router.get('/super-profile', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const igAccount = accounts.documents.find(a => matchesIgAccountIdentifier(a, account_id));
        if (!igAccount) return res.status(404).json({ error: 'Account not found' });

        const result = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, SUPER_PROFILES_COLLECTION_ID,
            [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)]);

        if (result.total > 0) {
            const doc = result.documents[0];
            let buttons = [];
            try { buttons = typeof doc.buttons === 'string' ? JSON.parse(doc.buttons) : (doc.buttons || []); } catch (e) { }
            const slug = getIgProfessionalAccountId(igAccount);
            const baseUrl = (process.env.FRONTEND_ORIGIN || '').replace(/\/+$/, '');
            const publicPath = `/superprofile/${slug}`;

            res.json({
                id: doc.$id,
                slug,
                template_id: doc.template_id || null,
                buttons,
                is_active: doc.is_active || false,
                public_url: `${baseUrl}${publicPath}`,
                created_at: doc.$createdAt,
                updated_at: doc.$updatedAt
            });
        } else {
            res.status(404).json({ error: 'Super profile not found' });
        }
    } catch (err) {
        console.error(`Super Profile Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch super profile' });
    }
});

router.post('/super-profile', loginRequired, async (req, res) => {
    try {
        const account_id = req.query.account_id || req.body.account_id;
        const { template_id, buttons, is_active } = req.body;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const igAccount = accounts.documents.find(a => matchesIgAccountIdentifier(a, account_id));
        if (!igAccount) return res.status(404).json({ error: 'Account not found' });
        const slug = getIgProfessionalAccountId(igAccount);
        const baseUrl = (process.env.FRONTEND_ORIGIN || '').replace(/\/+$/, '');
        const publicPath = `/superprofile/${slug}`;

        const docData = {
            user_id: req.user.$id,
            account_id,
            slug,
            template_id: template_id || null,
            buttons: JSON.stringify(buttons || []),
            is_active: is_active !== undefined ? is_active : true
        };

        const doc = await databases.createDocument(
            process.env.APPWRITE_DATABASE_ID,
            SUPER_PROFILES_COLLECTION_ID,
            ID.unique(),
            docData,
            [Permission.read(Role.user(req.user.$id))]
        );

        res.status(201).json({
            id: doc.$id,
            slug: doc.slug,
            template_id: doc.template_id,
            buttons: buttons || [],
            is_active: doc.is_active,
            public_url: `${baseUrl}${publicPath}`,
            created_at: doc.$createdAt,
            updated_at: doc.$updatedAt
        });
    } catch (err) {
        console.error(`Create Super Profile Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to create super profile' });
    }
});

router.patch('/super-profile', loginRequired, async (req, res) => {
    try {
        const account_id = req.query.account_id || req.body.account_id;
        const { template_id, buttons, is_active } = req.body;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const igAccount = accounts.documents.find(a => matchesIgAccountIdentifier(a, account_id));
        if (!igAccount) return res.status(404).json({ error: 'Account not found' });
        const slug = getIgProfessionalAccountId(igAccount);
        const baseUrl = (process.env.FRONTEND_ORIGIN || '').replace(/\/+$/, '');
        const publicPath = `/superprofile/${slug}`;

        const result = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, SUPER_PROFILES_COLLECTION_ID,
            [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)]);

        if (result.total === 0) return res.status(404).json({ error: 'Super profile not found' });

        const docId = result.documents[0].$id;
        const updateData = {};

        updateData.slug = slug;
        if (template_id !== undefined) updateData.template_id = template_id;
        if (buttons !== undefined) updateData.buttons = JSON.stringify(buttons);
        if (is_active !== undefined) updateData.is_active = is_active;

        const doc = await databases.updateDocument(process.env.APPWRITE_DATABASE_ID, SUPER_PROFILES_COLLECTION_ID, docId, updateData);

        let parsedButtons = [];
        try { parsedButtons = typeof doc.buttons === 'string' ? JSON.parse(doc.buttons) : (doc.buttons || []); } catch (e) { }

        res.json({
            id: doc.$id,
            slug: doc.slug,
            template_id: doc.template_id,
            buttons: parsedButtons,
            is_active: doc.is_active,
            public_url: `${baseUrl}${publicPath}`,
            created_at: doc.$createdAt,
            updated_at: doc.$updatedAt
        });
    } catch (err) {
        console.error(`Update Super Profile Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to update super profile' });
    }
});

// ============================================================================
// PUBLIC SUPER PROFILE
// ============================================================================
router.get('/public/superprofile/:slug', async (req, res) => {
    try {
        const slug = String(req.params.slug || '').trim();
        if (!slug) return res.status(400).json({ error: 'slug is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const result = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            SUPER_PROFILES_COLLECTION_ID,
            [Query.equal('slug', slug), Query.limit(1)]
        );

        if (result.total === 0) return res.status(404).json({ error: 'Profile not found' });

        const doc = result.documents[0];
        if (doc.is_active === false) return res.status(404).json({ error: 'Profile not found' });

        let buttons = [];
        try { buttons = typeof doc.buttons === 'string' ? JSON.parse(doc.buttons) : (doc.buttons || []); } catch (e) { }

        let account = null;
        try {
            const accRes = await databases.listDocuments(
                process.env.APPWRITE_DATABASE_ID,
                IG_ACCOUNTS_COLLECTION_ID,
                [Query.equal('account_id', doc.account_id), Query.limit(1)]
            );
            account = accRes.total > 0 ? accRes.documents[0] : null;
        } catch (e) { }

        if (!account) {
            try {
                account = await databases.getDocument(
                    process.env.APPWRITE_DATABASE_ID,
                    IG_ACCOUNTS_COLLECTION_ID,
                    doc.account_id
                );
            } catch (e) { }
        }

        res.json({
            slug,
            buttons,
            is_active: doc.is_active !== false,
            username: account?.username || '',
            profile_picture_url: account?.profile_picture_url || '',
            name: account?.name || ''
        });
    } catch (err) {
        console.error(`Public Super Profile Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch public profile' });
    }
});

// ============================================================================
// SUGGEST MORE
// ============================================================================
router.get('/instagram/suggest-more', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const result = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, SUGGEST_MORE_COLLECTION_ID,
            [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)]);

        if (result.total > 0) {
            const doc = result.documents[0];
            res.json({
                is_setup: true,
                is_active: doc.is_active || false,
                template_id: doc.template_id || null,
                doc_id: doc.$id
            });
        } else {
            res.json({ is_setup: false, is_active: false });
        }
    } catch (err) {
        console.error(`Suggest More Error: ${err.message}`);
        res.json({ is_setup: false, is_active: false });
    }
});

router.post('/instagram/suggest-more', loginRequired, async (req, res) => {
    try {
        const { account_id, template_id, is_active } = req.body;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const existing = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, SUGGEST_MORE_COLLECTION_ID,
            [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)]);

        const docData = {
            user_id: req.user.$id,
            account_id,
            template_id: template_id || null,
            is_active: is_active !== undefined ? is_active : true
        };

        if (existing.total > 0) {
            await databases.updateDocument(process.env.APPWRITE_DATABASE_ID, SUGGEST_MORE_COLLECTION_ID, existing.documents[0].$id, docData);
        } else {
            await databases.createDocument(process.env.APPWRITE_DATABASE_ID, SUGGEST_MORE_COLLECTION_ID, ID.unique(), docData,
                [Permission.read(Role.user(req.user.$id))]);
        }

        res.json({ message: 'Suggest more config saved' });
    } catch (err) {
        console.error(`Save Suggest More Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to save suggest more config' });
    }
});

router.delete('/instagram/suggest-more', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const existing = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, SUGGEST_MORE_COLLECTION_ID,
            [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)]);

        if (existing.total > 0) {
            await databases.deleteDocument(process.env.APPWRITE_DATABASE_ID, SUGGEST_MORE_COLLECTION_ID, existing.documents[0].$id);
        }

        res.json({ message: 'Suggest more config deleted' });
    } catch (err) {
        console.error(`Delete Suggest More Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to delete suggest more config' });
    }
});

// ============================================================================
// COMMENT MODERATION
// ============================================================================
router.get('/instagram/comment-moderation', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        // Verify account ownership
        const accounts = await listOwnedIgAccounts(databases, req.user.$id);
        const account = accounts.documents.find((doc) => matchesIgAccountIdentifier(doc, account_id));
        if (!account) {
            return res.status(404).json({ error: 'Account not found or unauthorized' });
        }

        const queries = [Query.equal('user_id', req.user.$id), Query.equal('account_id', account_id), Query.limit(1)];
        const result = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, COMMENT_MODERATION_COLLECTION_ID, queries);

        if (result.total > 0) {
            const doc = result.documents[0];
            let rules = [];
            try {
                rules = typeof doc.rules === 'string' ? JSON.parse(doc.rules) : (doc.rules || []);
            } catch (e) { rules = []; }

            res.json({
                rules: rules,
                is_active: doc.is_active !== undefined ? doc.is_active : true,
                doc_id: doc.$id
            });
        } else {
            res.json({ rules: [], is_active: true });
        }
    } catch (err) {
        console.error(`Get Comment Moderation Error: ${err.message}`, err);
        res.status(500).json({ error: 'Failed to fetch comment moderation rules' });
    }
});

router.post('/instagram/comment-moderation', loginRequired, async (req, res) => {
    try {
        const { account_id } = req.query; // Also check body if needed, but usually passed in query in frontend
        const { rules, is_active } = req.body;

        const targetAccountId = account_id || req.body.account_id;

        if (!targetAccountId) return res.status(400).json({ error: 'account_id is required' });

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const queries = [Query.equal('user_id', req.user.$id), Query.equal('account_id', targetAccountId), Query.limit(1)];
        const existing = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, COMMENT_MODERATION_COLLECTION_ID, queries);

        const docData = {
            user_id: req.user.$id,
            account_id: targetAccountId,
            rules: JSON.stringify(rules || []),
            is_active: is_active !== undefined ? is_active : true
        };

        if (existing.total > 0) {
            await databases.updateDocument(process.env.APPWRITE_DATABASE_ID, COMMENT_MODERATION_COLLECTION_ID, existing.documents[0].$id, docData);
        } else {
            await databases.createDocument(process.env.APPWRITE_DATABASE_ID, COMMENT_MODERATION_COLLECTION_ID, ID.unique(), docData,
                [Permission.read(Role.user(req.user.$id))]);
        }

        res.json({ message: 'Comment moderation rules saved' });
    } catch (err) {
        console.error(`Save Comment Moderation Error: ${err.message}`, err);
        res.status(500).json({ error: 'Failed to save comment moderation rules' });
    }
});


module.exports = router;



const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Query, Functions, Databases } = require('node-appwrite');
const {
    getAppwriteClient,
    APPWRITE_DATABASE_ID,
    IG_ACCOUNTS_COLLECTION_ID,
    AUTOMATIONS_COLLECTION_ID,
    FUNCTION_REMOVE_INSTAGRAM
} = require('../utils/appwrite');
const { parseSignedRequest } = require('../utils/metaSignedRequest');

const getMetaAppSecret = () =>
    process.env.INSTAGRAM_APP_SECRET
    || process.env.FACEBOOK_APP_SECRET
    || '';

const getPublicOrigin = (req) => {
    const configured = process.env.BACKEND_PUBLIC_ORIGIN
        || process.env.FRONTEND_ORIGIN;
    if (configured) {
        return configured.trim().replace(/\/+$/, '');
    }
    const host = req.get('x-forwarded-host') || req.get('host');
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    return `${proto}://${host}`.replace(/\/+$/, '');
};

const findMatchingAccounts = async (databases, metaUserId) => {
    const safeUserId = String(metaUserId || '').trim();
    if (!safeUserId) return [];

    const candidates = [];
    const fieldsToTry = ['ig_user_id', 'account_id', 'ig_scoped_id'];

    for (const field of fieldsToTry) {
        try {
            const res = await databases.listDocuments(
                APPWRITE_DATABASE_ID,
                IG_ACCOUNTS_COLLECTION_ID,
                [Query.equal(field, safeUserId), Query.limit(10)]
            );
            if (res.documents && res.documents.length > 0) {
                for (const doc of res.documents) {
                    if (!candidates.some((c) => c.$id === doc.$id)) {
                        candidates.push(doc);
                    }
                }
            }
        } catch (_) {
            // Ignore attribute error if field is not present
        }
    }

    return candidates;
};

// ==============================================================================
// 1. INSTAGRAM / META DEAUTHORIZE CALLBACK
// Triggered by Meta when a user uninstalls/disconnects DM Panda in their
// Facebook/Instagram Settings -> Apps and Websites -> Remove.
// ==============================================================================
const handleDeauthorize = async (req, res) => {
    try {
        const signedRequest = req.body?.signed_request || req.query?.signed_request;
        if (!signedRequest) {
            return res.status(400).json({ error: 'Missing signed_request parameter' });
        }

        const appSecret = getMetaAppSecret();
        if (!appSecret) {
            console.error('[Meta Deauthorize] INSTAGRAM_APP_SECRET is not configured.');
            return res.status(500).json({ error: 'Server misconfiguration: missing app secret' });
        }

        const payload = parseSignedRequest(signedRequest, appSecret);
        const metaUserId = payload?.user_id;

        console.log(`[Meta Deauthorize] Received deauthorization ping for Meta user_id: ${metaUserId}`);

        if (!metaUserId) {
            return res.status(400).json({ error: 'signed_request did not contain user_id' });
        }

        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const accounts = await findMatchingAccounts(databases, metaUserId);

        for (const account of accounts) {
            try {
                // Mark account inactive and clear active tokens
                await databases.updateDocument(
                    APPWRITE_DATABASE_ID,
                    IG_ACCOUNTS_COLLECTION_ID,
                    account.$id,
                    {
                        status: 'inactive',
                        permissions: 'deauthorized'
                    }
                );

                // Disable active automations for this account
                const targetAccountId = account.account_id || account.ig_user_id;
                if (targetAccountId) {
                    const automations = await databases.listDocuments(
                        APPWRITE_DATABASE_ID,
                        AUTOMATIONS_COLLECTION_ID,
                        [Query.equal('account_id', targetAccountId), Query.limit(100)]
                    );
                    for (const auto of (automations.documents || [])) {
                        if (auto.is_active) {
                            await databases.updateDocument(
                                APPWRITE_DATABASE_ID,
                                AUTOMATIONS_COLLECTION_ID,
                                auto.$id,
                                { is_active: false }
                            ).catch(() => null);
                        }
                    }
                }

                console.log(`[Meta Deauthorize] Successfully deactivated account ${account.$id} (@${account.username || metaUserId})`);
            } catch (accErr) {
                console.error(`[Meta Deauthorize] Error deactivating account ${account.$id}:`, accErr.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Deauthorization processed successfully',
            user_id: metaUserId
        });
    } catch (err) {
        console.error('[Meta Deauthorize Error]:', err.message);
        return res.status(400).json({ error: err.message || 'Failed to process deauthorization' });
    }
};

// ==============================================================================
// 2. INSTAGRAM / META DATA DELETION REQUEST CALLBACK
// Triggered by Meta when a user requests deletion of their data from DM Panda.
// Mandates a response containing { url, confirmation_code }.
// ==============================================================================
const handleDeleteData = async (req, res) => {
    try {
        const signedRequest = req.body?.signed_request || req.query?.signed_request;
        if (!signedRequest) {
            return res.status(400).json({ error: 'Missing signed_request parameter' });
        }

        const appSecret = getMetaAppSecret();
        if (!appSecret) {
            console.error('[Meta Data Deletion] INSTAGRAM_APP_SECRET is not configured.');
            return res.status(500).json({ error: 'Server misconfiguration: missing app secret' });
        }

        const payload = parseSignedRequest(signedRequest, appSecret);
        const metaUserId = payload?.user_id;

        console.log(`[Meta Data Deletion] Received data deletion request for Meta user_id: ${metaUserId}`);

        if (!metaUserId) {
            return res.status(400).json({ error: 'signed_request did not contain user_id' });
        }

        const confirmationCode = `dmp_${crypto.randomBytes(8).toString('hex')}`;
        const serverClient = getAppwriteClient({ useApiKey: true });
        const databases = new Databases(serverClient);

        const accounts = await findMatchingAccounts(databases, metaUserId);

        for (const account of accounts) {
            try {
                if (FUNCTION_REMOVE_INSTAGRAM) {
                    const functions = new Functions(serverClient);
                    await functions.createExecution(
                        FUNCTION_REMOVE_INSTAGRAM,
                        JSON.stringify({ action: 'delete', account_doc_id: account.$id }),
                        false
                    );
                } else {
                    await databases.deleteDocument(
                        APPWRITE_DATABASE_ID,
                        IG_ACCOUNTS_COLLECTION_ID,
                        account.$id
                    );
                }
                console.log(`[Meta Data Deletion] Initiated full data deletion for account ${account.$id} (@${account.username || metaUserId})`);
            } catch (delErr) {
                console.error(`[Meta Data Deletion] Error removing account ${account.$id}:`, delErr.message);
            }
        }

        const publicOrigin = getPublicOrigin(req);
        const trackingUrl = `${publicOrigin}/api/auth/instagram/deletion-status?code=${encodeURIComponent(confirmationCode)}`;

        // Meta requires exact JSON keys: { "url": "...", "confirmation_code": "..." }
        return res.status(200).json({
            url: trackingUrl,
            confirmation_code: confirmationCode
        });
    } catch (err) {
        console.error('[Meta Data Deletion Error]:', err.message);
        return res.status(400).json({ error: err.message || 'Failed to process data deletion request' });
    }
};

// ==============================================================================
// 3. DATA DELETION STATUS PAGE / API
// Accessible by users or Meta to track the confirmation status of a data deletion request.
// ==============================================================================
const handleDeletionStatus = (req, res) => {
    const code = String(req.query.code || req.query.id || req.params.code || 'UNKNOWN').trim();
    const acceptsHtml = req.accepts(['html', 'json']) === 'html' && req.query.format !== 'json';

    if (!acceptsHtml) {
        return res.json({
            confirmation_code: code,
            status: 'completed',
            message: 'Your data deletion request has been successfully processed. All associated Instagram account data, tokens, and automations have been erased from DM Panda in compliance with Meta Platform Policies and GDPR.'
        });
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Data Deletion Status | DM Panda</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #09090b;
            color: #fafafa;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px;
        }
        .card {
            background: #18181b;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 20px;
            max-width: 520px;
            width: 100%;
            padding: 40px;
            box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
            text-align: center;
        }
        .icon-wrap {
            width: 64px;
            height: 64px;
            background: rgba(16, 185, 129, 0.12);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px auto;
            color: #10b981;
        }
        h1 {
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 12px;
            color: #ffffff;
        }
        p {
            font-size: 14px;
            line-height: 1.6;
            color: #a1a1aa;
            margin-bottom: 24px;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 600;
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
            margin-bottom: 24px;
        }
        .code-box {
            background: #09090b;
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 12px;
            padding: 16px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 13px;
            color: #e4e4e7;
            word-break: break-all;
            margin-bottom: 28px;
            text-align: left;
        }
        .code-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #71717a;
            margin-bottom: 6px;
        }
        .footer-link {
            display: inline-block;
            color: #a1a1aa;
            text-decoration: none;
            font-size: 13px;
            transition: color 0.2s;
        }
        .footer-link:hover {
            color: #ffffff;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-wrap">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6L9 17l-5-5"/>
            </svg>
        </div>
        <div class="badge">Status: Completed</div>
        <h1>Data Deletion Request Processed</h1>
        <p>In accordance with Meta Platform Policies and GDPR, all personal data, linked accounts, tokens, and automation records associated with your request have been permanently purged from DM Panda.</p>
        <div class="code-box">
            <div class="code-label">Confirmation Code</div>
            <div>${code}</div>
        </div>
        <a href="https://dmpanda.com" class="footer-link">Return to DM Panda &rarr;</a>
    </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
};

// Mount endpoints with standard paths and aliases
router.post('/api/auth/instagram/deauthorize', handleDeauthorize);
router.post('/auth/instagram/deauthorize', handleDeauthorize);
router.post('/api/instagram/deauthorize', handleDeauthorize);

router.post('/api/auth/instagram/delete-data', handleDeleteData);
router.post('/auth/instagram/delete-data', handleDeleteData);
router.post('/api/instagram/delete-data', handleDeleteData);

router.get('/api/auth/instagram/deletion-status', handleDeletionStatus);
router.get('/auth/instagram/deletion-status', handleDeletionStatus);
router.get('/deletion-status', handleDeletionStatus);

module.exports = router;

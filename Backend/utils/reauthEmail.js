const { Client, Messaging, Users, ID } = require('node-appwrite');
const { renderEmailLayout } = require('./emailTemplate');
const { getAppwriteClient, APPWRITE_DATABASE_ID } = require('./appwrite');

// In-memory debouncer cache: { [userId_username]: timestamp }
const reauthEmailCooldowns = new Map();
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown per account to avoid spamming user

/**
 * Sends a re-authorization required email to the user when their Instagram account becomes inactive.
 * Triggers:
 *  1. Appwrite function detects invalid/expired token.
 *  2. Immediate dashboard validation detects invalid/expired token.
 *  3. User toggles account to inactive in dashboard settings.
 *  4. User removes DM Panda from Instagram app settings (deauthorize webhook).
 */
const sendReauthRequiredEmail = async ({
    userId,
    userEmail = '',
    username = '',
    reason = '',
    force = false,
    frontendOrigin = ''
} = {}) => {
    const safeUserId = String(userId || '').trim();
    const safeUsername = String(username || 'your account').trim();

    if (!safeUserId) {
        console.warn('[Reauth Email] Skipping email: No userId provided.');
        return { skipped: true, reason: 'missing_user_id' };
    }

    const cooldownKey = `${safeUserId}_${safeUsername.toLowerCase()}`;
    const now = Date.now();
    const lastSent = reauthEmailCooldowns.get(cooldownKey) || 0;

    if (!force && (now - lastSent < COOLDOWN_MS)) {
        console.log(`[Reauth Email] Skipping email for @${safeUsername} (user ${safeUserId}): Cooldown active (${Math.round((COOLDOWN_MS - (now - lastSent)) / 60000)}m remaining).`);
        return { skipped: true, reason: 'cooldown_active' };
    }

    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const messaging = new Messaging(serverClient);

        let targetEmail = userEmail;
        if (!targetEmail) {
            try {
                const users = new Users(serverClient);
                const userDoc = await users.get(safeUserId);
                targetEmail = userDoc?.email || '';
            } catch (userErr) {
                console.warn(`[Reauth Email] Could not fetch user email for ${safeUserId}: ${userErr.message}`);
            }
        }

        const resolvedOrigin = frontendOrigin
            || process.env.FRONTEND_ORIGIN
            || process.env.VITE_APP_URL
            || (process.env.NODE_ENV === 'production' ? 'https://dmpanda.com' : 'http://localhost:5173');

        const accountSettingsUrl = `${resolvedOrigin.replace(/\/+$/, '')}/dashboard/account-settings`;
        const subject = `Reconnect Instagram to restart your DM Panda automations`;

        const emailHtml = renderEmailLayout({
            title: 'Instagram Re-authorization Needed',
            preheader: `Re-authorization is required for @${safeUsername} to continue DM Panda automations.`,
            eyebrow: 'Account Alert',
            greeting: 'Hello,',
            intro: `DM Panda lost access to your connected Instagram account @${safeUsername}.`,
            callouts: [{
                tone: 'critical',
                title: 'Automations Paused',
                lines: [
                    `Instagram account: @${safeUsername}`,
                    'Automations (DMs, comment replies, and story triggers) are paused until re-authorized.',
                    reason ? `Reason: ${reason}` : 'The Instagram access token is invalid, expired, or disconnected.'
                ]
            }],
            paragraphs: [
                'To resume your automations, open account settings and click "Re-authorize" on this account.',
                'Existing rules, templates, and analytics remain saved.'
            ],
            ctaLabel: 'Re-authorize Account',
            ctaUrl: accountSettingsUrl,
            footerNote: 'If you reconnect a different account, this account remains inactive.',
            frontendOrigin: resolvedOrigin
        });

        await messaging.createEmail(
            ID.unique(),
            subject,
            emailHtml,
            [], // topics
            [safeUserId], // users
            [], // targets
            [], // cc
            [], // bcc
            [], // attachments
            false, // draft
            true // html
        );

        reauthEmailCooldowns.set(cooldownKey, now);
        console.log(`[Reauth Email] Sent re-authorization email to user ${safeUserId} for @${safeUsername}`);
        return { success: true };
    } catch (err) {
        console.error(`[Reauth Email Error] Failed to send re-authorization email to user ${safeUserId} for @${safeUsername}:`, err.message);
        return { success: false, error: err.message };
    }
};

/**
 * Sends an email to the user when their Instagram account has been unlinked or removed.
 * Triggers:
 *  1. Meta Data Deletion callback (user removed DM Panda in Instagram Settings).
 *  2. Meta Deauthorization callback.
 *  3. Frontend dashboard account deletion.
 *  4. Admin panel account deletion.
 */
const sendAccountRemovedEmail = async ({
    userId,
    userEmail = '',
    username = '',
    action = 'removed',
    reason = '',
    frontendOrigin = ''
} = {}) => {
    const safeUserId = String(userId || '').trim();
    const safeUsername = String(username || 'your account').trim();

    if (!safeUserId) {
        console.warn('[Account Removal Email] Skipping: No userId provided.');
        return { skipped: true, reason: 'missing_user_id' };
    }

    try {
        const serverClient = getAppwriteClient({ useApiKey: true });
        const messaging = new Messaging(serverClient);

        let targetEmail = userEmail;
        if (!targetEmail) {
            try {
                const users = new Users(serverClient);
                const userDoc = await users.get(safeUserId);
                targetEmail = userDoc?.email || '';
            } catch (userErr) {
                console.warn(`[Account Removal Email] Could not fetch user email for ${safeUserId}: ${userErr.message}`);
            }
        }

        const resolvedOrigin = frontendOrigin
            || process.env.FRONTEND_ORIGIN
            || process.env.VITE_APP_URL
            || (process.env.NODE_ENV === 'production' ? 'https://dmpanda.com' : 'http://localhost:5173');

        const accountSettingsUrl = `${resolvedOrigin.replace(/\/+$/, '')}/dashboard/account-settings`;
        const actionVerb = (action === 'delete' || action === 'deleted' || action === 'removed') ? 'removed' : 'unlinked';
        const subject = `Your Instagram account @${safeUsername} has been ${actionVerb} from DM Panda`;

        const emailHtml = renderEmailLayout({
            title: `Instagram Account ${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)}`,
            preheader: `Instagram account @${safeUsername} is no longer connected to DM Panda.`,
            eyebrow: 'Account Update',
            greeting: 'Hello,',
            intro: `Your Instagram account @${safeUsername} has been ${actionVerb} from DM Panda.`,
            callouts: [{
                tone: 'critical',
                title: 'Account Disconnected',
                lines: [
                    `Instagram account: @${safeUsername}`,
                    'All automations, triggers, and scheduled tasks for this account have ended.',
                    reason ? `Reason: ${reason}` : 'The account was unlinked from DM Panda.'
                ]
            }],
            paragraphs: [
                'DM Panda is no longer monitoring direct messages, comments, or mentions for this account.',
                'If this action was expected, no further steps are necessary. To resume automations, you can reconnect this account or link a new one from your dashboard.'
            ],
            ctaLabel: 'Manage Connected Accounts',
            ctaUrl: accountSettingsUrl,
            footerNote: 'Need assistance? Contact support@dmpanda.com.',
            frontendOrigin: resolvedOrigin
        });

        await messaging.createEmail(
            ID.unique(),
            subject,
            emailHtml,
            [], // topics
            [safeUserId], // users
            [], // targets
            [], // cc
            [], // bcc
            [], // attachments
            false, // draft
            true // html
        );

        console.log(`[Account Removal Email] Sent account ${actionVerb} email to user ${safeUserId} for @${safeUsername}`);
        return { success: true };
    } catch (err) {
        console.error(`[Account Removal Email Error] Failed to send email to user ${safeUserId} for @${safeUsername}:`, err.message);
        return { success: false, error: err.message };
    }
};

module.exports = {
    sendReauthRequiredEmail,
    sendAccountRemovedEmail
};

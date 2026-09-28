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
            preheader: `Re-authorization is required for @${safeUsername} to continue your DM Panda automations.`,
            eyebrow: 'DM Panda Alert',
            greeting: 'Hello,',
            intro: `DM Panda was unable to access your connected Instagram account @${safeUsername}.`,
            callouts: [{
                tone: 'critical',
                title: 'Automations Paused',
                lines: [
                    `Instagram account: @${safeUsername}`,
                    'Automations (DMs, comment replies, story triggers) for this account are currently stopped until you re-authorize it.',
                    reason ? `Reason: ${reason}` : 'Your Meta Instagram access token is invalid, expired, or disconnected.'
                ]
            }],
            paragraphs: [
                'To resume your lead capture and automated workflows, please open DM Panda settings and click "Re-authorize" on this account.',
                'Re-authorizing is secure, takes just a few seconds, and will not alter or delete any of your existing automation rules or templates.'
            ],
            ctaLabel: 'Re-authorize Instagram',
            ctaUrl: accountSettingsUrl,
            footerNote: 'If you connect a different Instagram account, DM Panda will keep the paused account inactive and treat the new one as a separate linked account.',
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
            eyebrow: 'DM Panda Account Update',
            greeting: 'Hello,',
            intro: `Your Instagram account @${safeUsername} has been ${actionVerb} from DM Panda.`,
            callouts: [{
                tone: 'critical',
                title: 'Account Disconnected',
                lines: [
                    `Instagram account: @${safeUsername}`,
                    'All automations, triggers, and scheduled tasks for this account have been paused/stopped.',
                    reason ? `Reason: ${reason}` : 'The account was unlinked or disconnected from DM Panda.'
                ]
            }],
            paragraphs: [
                'DM Panda has ceased processing direct messages, comments, and mentions for this account.',
                'If you disconnected this account intentionally, no further action is required. If this was unexpected or you wish to resume automations, you can reconnect or link a new Instagram account at any time.'
            ],
            ctaLabel: 'Manage Connected Accounts',
            ctaUrl: accountSettingsUrl,
            footerNote: 'Need help? Contact our support team at support@dmpanda.com.',
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

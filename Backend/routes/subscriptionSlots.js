const express = require('express');
const { Databases, Query, ID } = require('node-appwrite');
const { loginRequired } = require('../middleware/auth');
const {
    getAppwriteClient,
    APPWRITE_DATABASE_ID,
    SUBSCRIPTION_SLOTS_COLLECTION_ID,
    IG_ACCOUNTS_COLLECTION_ID,
    PROFILES_COLLECTION_ID
} = require('../utils/appwrite');
const { recomputeAccountAccessForUser } = require('../utils/accountAccess');

const router = express.Router();

const LOCK_PERIOD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days (72 hours)

const getDatabases = () => new Databases(getAppwriteClient({ useApiKey: true }));

/**
 * Format remaining ms into human readable string (e.g. "2 days 14 hours")
 */
const formatRemainingTime = (ms) => {
    if (ms <= 0) return '0 hours';
    const totalHours = Math.ceil(ms / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    if (days > 0) {
        return `${days} day${days === 1 ? '' : 's'} ${hours} hour${hours === 1 ? '' : 's'}`;
    }
    return `${hours} hour${hours === 1 ? '' : 's'}`;
};

/**
 * GET /api/subscription-slots
 * List all subscription slots owned by the authenticated user along with lock status.
 */
router.get('/', loginRequired, async (req, res) => {
    try {
        const databases = getDatabases();
        const userId = req.user.$id;

        const slotsResponse = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            SUBSCRIPTION_SLOTS_COLLECTION_ID,
            [
                Query.equal('user_id', userId),
                Query.limit(100)
            ]
        ).catch(() => ({ documents: [] }));

        const now = Date.now();
        const slots = (slotsResponse.documents || []).map((doc) => {
            const pairedAtTime = doc.paired_at ? new Date(doc.paired_at).getTime() : 0;
            const elapsedMs = pairedAtTime ? now - pairedAtTime : LOCK_PERIOD_MS + 1;
            const isLocked = doc.paired_account_id && elapsedMs < LOCK_PERIOD_MS;
            const remainingMs = isLocked ? LOCK_PERIOD_MS - elapsedMs : 0;

            return {
                id: doc.$id,
                planCode: doc.plan_code,
                billingCycle: doc.billing_cycle || 'monthly',
                status: doc.status || 'active',
                expiresAt: doc.expires_at,
                pairedAccountId: doc.paired_account_id || null,
                pairedAt: doc.paired_at || null,
                transactionId: doc.transaction_id || null,
                isLocked,
                remainingLockMs: remainingMs,
                remainingLockText: isLocked ? formatRemainingTime(remainingMs) : null,
                canChangeAt: isLocked ? new Date(pairedAtTime + LOCK_PERIOD_MS).toISOString() : null,
                createdAt: doc.created_at || doc.$createdAt
            };
        });

        res.json({ success: true, data: slots });
    } catch (err) {
        console.error('Error fetching subscription slots:', err.message);
        res.status(500).json({ success: false, error: 'Failed to retrieve subscription slots' });
    }
});

/**
 * POST /api/subscription-slots/:slotId/pair
 * Pair a subscription slot to a linked Instagram account. Enforces 3-day lock rule.
 */
router.post('/:slotId/pair', loginRequired, async (req, res) => {
    try {
        const databases = getDatabases();
        const userId = req.user.$id;
        const { slotId } = req.params;
        const { igAccountId } = req.body || {};

        if (!igAccountId) {
            return res.status(400).json({ success: false, error: 'Target Instagram account ID is required' });
        }

        // Fetch slot document
        const slot = await databases.getDocument(
            APPWRITE_DATABASE_ID,
            SUBSCRIPTION_SLOTS_COLLECTION_ID,
            slotId
        ).catch(() => null);

        if (!slot || slot.user_id !== userId) {
            return res.status(404).json({ success: false, error: 'Subscription slot not found' });
        }

        if (slot.status !== 'active') {
            return res.status(400).json({ success: false, error: 'This subscription slot is no longer active' });
        }

        const now = Date.now();

        // Check 3-day lock rule if currently paired
        if (slot.paired_account_id && slot.paired_account_id !== igAccountId && slot.paired_at) {
            const pairedAtTime = new Date(slot.paired_at).getTime();
            const elapsedMs = now - pairedAtTime;

            if (elapsedMs < LOCK_PERIOD_MS) {
                const remainingMs = LOCK_PERIOD_MS - elapsedMs;
                const lockText = formatRemainingTime(remainingMs);
                return res.status(400).json({
                    success: false,
                    error: `Slot pairing is locked for at least 3 days. You can change this slot's paired account in ${lockText}.`,
                    isLocked: true,
                    remainingLockMs: remainingMs,
                    canChangeAt: new Date(pairedAtTime + LOCK_PERIOD_MS).toISOString()
                });
            }
        }

        // Verify target IG account belongs to user
        const igAccount = await databases.getDocument(
            APPWRITE_DATABASE_ID,
            IG_ACCOUNTS_COLLECTION_ID,
            igAccountId
        ).catch(() => null);

        if (!igAccount || igAccount.user_id !== userId) {
            return res.status(404).json({ success: false, error: 'Linked Instagram account not found' });
        }

        // If target account is already paired to another slot owned by user, unpair that previous slot
        const otherSlots = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            SUBSCRIPTION_SLOTS_COLLECTION_ID,
            [
                Query.equal('user_id', userId),
                Query.equal('paired_account_id', igAccountId)
            ]
        ).catch(() => ({ documents: [] }));

        for (const otherSlot of (otherSlots.documents || [])) {
            if (otherSlot.$id !== slotId) {
                await databases.updateDocument(
                    APPWRITE_DATABASE_ID,
                    SUBSCRIPTION_SLOTS_COLLECTION_ID,
                    otherSlot.$id,
                    {
                        paired_account_id: null,
                        paired_at: null,
                        updated_at: new Date().toISOString()
                    }
                );
            }
        }

        // Pair the slot
        const nowIso = new Date().toISOString();
        const updatedSlot = await databases.updateDocument(
            APPWRITE_DATABASE_ID,
            SUBSCRIPTION_SLOTS_COLLECTION_ID,
            slotId,
            {
                paired_account_id: igAccountId,
                paired_at: nowIso,
                updated_at: nowIso
            }
        );

        // Recompute account access
        await recomputeAccountAccessForUser(databases, userId).catch(() => null);

        res.json({
            success: true,
            message: `Successfully paired slot to @${igAccount.username || igAccount.ig_username || 'account'}`,
            data: {
                id: updatedSlot.$id,
                planCode: updatedSlot.plan_code,
                pairedAccountId: updatedSlot.paired_account_id,
                pairedAt: updatedSlot.paired_at,
                isLocked: true,
                remainingLockMs: LOCK_PERIOD_MS,
                remainingLockText: '3 days 0 hours',
                canChangeAt: new Date(now + LOCK_PERIOD_MS).toISOString()
            }
        });
    } catch (err) {
        console.error('Error pairing subscription slot:', err.message);
        res.status(500).json({ success: false, error: err.message || 'Failed to pair slot' });
    }
});

/**
 * POST /api/subscription-slots/:slotId/unpair
 * Unpair a subscription slot from an Instagram account. Enforces 3-day lock rule.
 */
router.post('/:slotId/unpair', loginRequired, async (req, res) => {
    try {
        const databases = getDatabases();
        const userId = req.user.$id;
        const { slotId } = req.params;

        const slot = await databases.getDocument(
            APPWRITE_DATABASE_ID,
            SUBSCRIPTION_SLOTS_COLLECTION_ID,
            slotId
        ).catch(() => null);

        if (!slot || slot.user_id !== userId) {
            return res.status(404).json({ success: false, error: 'Subscription slot not found' });
        }

        if (!slot.paired_account_id) {
            return res.json({ success: true, message: 'Slot is already unpaired' });
        }

        const now = Date.now();
        if (slot.paired_at) {
            const pairedAtTime = new Date(slot.paired_at).getTime();
            const elapsedMs = now - pairedAtTime;

            if (elapsedMs < LOCK_PERIOD_MS) {
                const remainingMs = LOCK_PERIOD_MS - elapsedMs;
                const lockText = formatRemainingTime(remainingMs);
                return res.status(400).json({
                    success: false,
                    error: `Slot pairing is locked for at least 3 days. You can unpair this slot in ${lockText}.`,
                    isLocked: true,
                    remainingLockMs: remainingMs,
                    canChangeAt: new Date(pairedAtTime + LOCK_PERIOD_MS).toISOString()
                });
            }
        }

        const updatedSlot = await databases.updateDocument(
            APPWRITE_DATABASE_ID,
            SUBSCRIPTION_SLOTS_COLLECTION_ID,
            slotId,
            {
                paired_account_id: null,
                paired_at: null,
                updated_at: new Date().toISOString()
            }
        );

        await recomputeAccountAccessForUser(databases, userId).catch(() => null);

        res.json({
            success: true,
            message: 'Slot successfully unpaired',
            data: {
                id: updatedSlot.$id,
                planCode: updatedSlot.plan_code,
                pairedAccountId: null,
                pairedAt: null,
                isLocked: false
            }
        });
    } catch (err) {
        console.error('Error unpairing subscription slot:', err.message);
        res.status(500).json({ success: false, error: err.message || 'Failed to unpair slot' });
    }
});

module.exports = router;

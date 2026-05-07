const test = require('node:test');
const assert = require('node:assert/strict');

const {
    selectLatestTransactionFromDocuments,
    resolveEntitlementReplacementDecision,
    buildAdminOverridePayload,
    buildPlanProfilePayload,
    parseAdminOverride,
    parseProfileConfig
} = require('../utils/planConfig');
const paymentRoute = require('../routes/payment');

const { clearAdminOverrideForUserProfile } = paymentRoute._test;

const NOW = '2026-05-07T12:00:00.000Z';

const pricingPlans = [
    { id: 'free', plan_code: 'free', name: 'Free Plan', instagram_connections_limit: 0, actions_per_hour_limit: 0, actions_per_day_limit: 0, actions_per_month_limit: 0 },
    { id: 'basic', plan_code: 'basic', name: 'Basic Plan', instagram_connections_limit: 1, actions_per_hour_limit: 10, actions_per_day_limit: 100, actions_per_month_limit: 1000, monthly_duration_days: 30, yearly_duration_days: 364 },
    { id: 'pro', plan_code: 'pro', name: 'Pro Plan', instagram_connections_limit: 3, actions_per_hour_limit: 25, actions_per_day_limit: 500, actions_per_month_limit: 7000, monthly_duration_days: 30, yearly_duration_days: 364 },
    { id: 'ultra', plan_code: 'ultra', name: 'Ultra Plan', instagram_connections_limit: 5, actions_per_hour_limit: 50, actions_per_day_limit: 1500, actions_per_month_limit: 25000, monthly_duration_days: 30, yearly_duration_days: 364 }
];

const buildTransaction = ({
    id,
    planCode,
    status = 'success',
    createdAt,
    expiryDate = null,
    billingCycle = 'monthly'
}) => ({
    $id: id,
    user_id: 'user-1',
    userId: 'user-1',
    plan_code: planCode,
    status,
    created_at: createdAt,
    billing_cycle: billingCycle,
    expiry_date: expiryDate
});

test('free -> admin upgrade -> expiry -> free', () => {
    const activeProfile = {
        plan_code: 'pro',
        plan_name: 'Pro Plan',
        plan_source: 'admin',
        expiry_date: '2026-06-06T00:00:00.000Z',
        admin_override_json: buildAdminOverridePayload({
            planId: 'pro',
            planName: 'Pro Plan',
            billingCycle: 'monthly',
            expiresAt: '2026-06-06T00:00:00.000Z',
            createdAt: '2026-05-07T00:00:00.000Z'
        })
    };
    const expiredProfile = {
        ...activeProfile,
        expiry_date: '2026-05-01T00:00:00.000Z',
        admin_override_json: buildAdminOverridePayload({
            planId: 'pro',
            planName: 'Pro Plan',
            billingCycle: 'monthly',
            expiresAt: '2026-05-01T00:00:00.000Z',
            createdAt: '2026-04-01T00:00:00.000Z'
        })
    };

    const activeDecision = resolveEntitlementReplacementDecision({
        profile: activeProfile,
        pricingPlans,
        now: NOW
    });
    assert.equal(activeDecision.planId, 'pro');
    assert.equal(activeDecision.planSource, 'admin');

    const expiredDecision = resolveEntitlementReplacementDecision({
        profile: expiredProfile,
        pricingPlans,
        now: NOW
    });
    assert.equal(expiredDecision.planId, 'free');
    assert.equal(expiredDecision.planSource, 'system');
    assert.equal(expiredDecision.clearAdminOverride, true);
});

test('paid yearly -> admin downgrade monthly -> expiry -> free without auto-reactivation', () => {
    const latestValidTransaction = {
        planId: 'pro',
        plan: pricingPlans.find((plan) => plan.plan_code === 'pro'),
        expiryDate: '2027-01-01T00:00:00.000Z',
        billingCycle: 'yearly'
    };
    const expiredOverrideProfile = {
        plan_code: 'basic',
        plan_name: 'Basic Plan',
        plan_source: 'admin',
        expiry_date: '2026-05-01T00:00:00.000Z',
        admin_override_json: buildAdminOverridePayload({
            planId: 'basic',
            planName: 'Basic Plan',
            billingCycle: 'monthly',
            expiresAt: '2026-05-01T00:00:00.000Z'
        })
    };

    const decision = resolveEntitlementReplacementDecision({
        profile: expiredOverrideProfile,
        pricingPlans,
        latestValidTransaction,
        now: NOW
    });

    assert.equal(decision.planId, 'free');
    assert.equal(decision.reason, 'expired_admin_override');
});

test('paid monthly -> admin yearly override -> expiry -> free', () => {
    const decision = resolveEntitlementReplacementDecision({
        profile: {
            plan_code: 'ultra',
            plan_name: 'Ultra Plan',
            plan_source: 'admin',
            expiry_date: '2026-05-01T00:00:00.000Z',
            admin_override_json: buildAdminOverridePayload({
                planId: 'ultra',
                planName: 'Ultra Plan',
                billingCycle: 'yearly',
                expiresAt: '2026-05-01T00:00:00.000Z'
            })
        },
        pricingPlans,
        now: NOW
    });

    assert.equal(decision.planId, 'free');
    assert.equal(decision.clearAdminOverride, true);
});

test('admin override -> new payment clears override immediately', async () => {
    let patch = null;
    const databases = {
        getDocument: async () => ({
            $id: 'profile-1',
            admin_override_json: '{"p":"basic"}'
        }),
        updateDocument: async (_db, _collection, _id, data) => {
            patch = data;
            return { $id: 'profile-1', ...data };
        }
    };

    const updated = await clearAdminOverrideForUserProfile(databases, 'user-1');
    assert.equal(updated.admin_override_json, null);
    assert.deepEqual(patch, { admin_override_json: null });
});

test('reset to default with valid transaction restores latest active paid transaction only when it is the newest transaction', () => {
    const transactions = [
        buildTransaction({
            id: 'tx-old-valid',
            planCode: 'pro',
            createdAt: '2026-05-01T00:00:00.000Z',
            expiryDate: '2026-06-01T00:00:00.000Z',
            billingCycle: 'monthly'
        }),
        buildTransaction({
            id: 'tx-new-valid',
            planCode: 'ultra',
            createdAt: '2026-05-06T00:00:00.000Z',
            expiryDate: '2026-06-06T00:00:00.000Z',
            billingCycle: 'monthly'
        })
    ];

    const latest = selectLatestTransactionFromDocuments(transactions, pricingPlans, NOW);
    assert.equal(latest.planId, 'ultra');
    assert.equal(latest.expiryDate, '2026-06-06T00:00:00.000Z');
});

test('reset to default with expired or no transaction becomes free', () => {
    const expiredTransactions = [
        buildTransaction({
            id: 'tx-expired',
            planCode: 'pro',
            createdAt: '2026-03-01T00:00:00.000Z',
            expiryDate: '2026-04-01T00:00:00.000Z'
        })
    ];

    assert.equal(selectLatestTransactionFromDocuments([], pricingPlans, NOW), null);
    assert.equal(selectLatestTransactionFromDocuments(expiredTransactions, pricingPlans, NOW), null);
});

test('multiple transaction edge cases use the last transaction only and ignore older active history', () => {
    const transactions = [
        buildTransaction({
            id: 'tx-older-valid',
            planCode: 'pro',
            createdAt: '2026-04-01T00:00:00.000Z',
            expiryDate: '2026-07-01T00:00:00.000Z'
        }),
        buildTransaction({
            id: 'tx-newer-expired',
            planCode: 'ultra',
            createdAt: '2026-05-06T00:00:00.000Z',
            expiryDate: '2026-05-06T06:00:00.000Z'
        }),
        buildTransaction({
            id: 'tx-refunded',
            planCode: 'ultra',
            status: 'refunded',
            createdAt: '2026-05-05T00:00:00.000Z',
            expiryDate: '2026-08-01T00:00:00.000Z'
        }),
        buildTransaction({
            id: 'tx-cancelled',
            planCode: 'basic',
            status: 'cancelled',
            createdAt: '2026-05-04T00:00:00.000Z',
            expiryDate: '2026-08-01T00:00:00.000Z'
        })
    ];

    const latest = selectLatestTransactionFromDocuments(transactions, pricingPlans, NOW);
    assert.equal(latest, null);
});

test('admin override payload stays compact enough for the current live Appwrite schema', () => {
    const payload = buildAdminOverridePayload({
        planId: 'pro',
        planName: 'Pro Plan',
        billingCycle: 'monthly',
        expiresAt: '2026-06-06T00:00:00.000Z',
        limitOverrides: {
            instagram_connections_limit: 7,
            hourly_action_limit: 70,
            daily_action_limit: 700,
            monthly_action_limit: 7000
        },
        featureOverrides: {
            no_watermark: true
        }
    });
    const parsed = parseAdminOverride({ admin_override_json: payload });
    assert.ok(payload.length <= 140);
    assert.equal(parsed.plan_id, 'pro');
    assert.equal(parsed.billing_cycle, 'monthly');
});

test('admin runtime overrides are derived from the profile while override metadata stays minimal', () => {
    const config = parseProfileConfig({
        plan_source: 'admin',
        admin_override_json: buildAdminOverridePayload({
            planId: 'pro',
            billingCycle: 'monthly',
            expiresAt: '2026-06-06T00:00:00.000Z'
        }),
        instagram_connections_limit: 7,
        hourly_action_limit: 70,
        daily_action_limit: 700,
        monthly_action_limit: 7000,
        benefit_no_watermark: true
    });
    assert.equal(config.limit_overrides.instagram_connections_limit, 7);
    assert.equal(config.limit_overrides.hourly_action_limit, 70);
    assert.equal(config.feature_overrides.no_watermark, true);
});

test('plan payload writes custom limits and no-watermark benefit to the runtime profile', () => {
    const payload = buildPlanProfilePayload({
        currentProfile: {
            user_id: 'user-1',
            kill_switch_enabled: true
        },
        plan: pricingPlans.find((plan) => plan.plan_code === 'pro'),
        planId: 'pro',
        planSource: 'admin',
        billingCycle: 'monthly',
        subscriptionStatus: 'active',
        subscriptionExpires: '2026-06-06T00:00:00.000Z',
        limitOverrides: {
            instagram_connections_limit: 7,
            hourly_action_limit: 70,
            daily_action_limit: 700,
            monthly_action_limit: 7000
        },
        featureOverrides: {
            no_watermark: true
        }
    });
    assert.equal(payload.instagram_connections_limit, 7);
    assert.equal(payload.hourly_action_limit, 70);
    assert.equal(payload.daily_action_limit, 700);
    assert.equal(payload.monthly_action_limit, 7000);
    assert.equal(payload.benefit_no_watermark, true);
});

test('scheduler consistency case resolves free after expired override even when old transaction is still valid', () => {
    const latestValidTransaction = {
        planId: 'pro',
        plan: pricingPlans.find((plan) => plan.plan_code === 'pro'),
        expiryDate: '2026-12-01T00:00:00.000Z',
        billingCycle: 'yearly'
    };

    const resolverDecision = resolveEntitlementReplacementDecision({
        profile: {
            plan_code: 'basic',
            plan_name: 'Basic Plan',
            plan_source: 'admin',
            expiry_date: '2026-05-01T00:00:00.000Z',
            admin_override_json: buildAdminOverridePayload({
                planId: 'basic',
                planName: 'Basic Plan',
                billingCycle: 'monthly',
                expiresAt: '2026-05-01T00:00:00.000Z'
            })
        },
        pricingPlans,
        latestValidTransaction,
        now: NOW
    });

    assert.equal(resolverDecision.planId, 'free');
    assert.equal(resolverDecision.reason, 'expired_admin_override');
});

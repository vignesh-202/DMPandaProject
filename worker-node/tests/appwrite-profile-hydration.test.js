const test = require('node:test');
const assert = require('node:assert/strict');

const AppwriteClient = require('../src/appwrite');

test('hydrateProfilePlan preserves runtime limit overrides and profile feature flags', async () => {
    const client = new AppwriteClient();
    client._getPricingPlan = async () => ({
        plan_code: 'pro',
        instagram_connections_limit: 3,
        instagram_link_limit: 3,
        actions_per_hour_limit: 25,
        actions_per_day_limit: 500,
        actions_per_month_limit: 7000,
        benefit_no_watermark: false
    });

    const profile = await client._hydrateProfilePlan({
        plan_code: 'pro',
        instagram_connections_limit: 7,
        hourly_action_limit: 70,
        daily_action_limit: 700,
        monthly_action_limit: null,
        benefit_no_watermark: true
    });

    assert.equal(profile.instagram_connections_limit, 7);
    assert.equal(profile.hourly_action_limit, 70);
    assert.equal(profile.daily_action_limit, 700);
    assert.equal(profile.monthly_action_limit, null);
    assert.equal(profile.benefit_no_watermark, true);
    assert.equal(profile.__plan_features.no_watermark, true);
});

const parseJsonObject = (value, fallback = {}) => {
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
};

const numberOrZero = (value) => {
    const next = Number(value || 0);
    return Number.isFinite(next) ? next : 0;
};

const normalizeActionLimits = (profile = {}) => {
    const parsed = parseJsonObject(profile?.limits_json, {});
    const hourly = numberOrZero(parsed.hourly_action_limit ?? parsed.per_hour ?? profile.hourly_action_limit);
    const daily = numberOrZero(parsed.daily_action_limit ?? parsed.per_day ?? profile.daily_action_limit);
    const monthlyRaw = parsed.monthly_action_limit ?? parsed.per_month ?? profile.monthly_action_limit;
    const monthly = monthlyRaw == null ? null : numberOrZero(monthlyRaw);
    return {
        hourly_action_limit: hourly,
        daily_action_limit: daily,
        monthly_action_limit: monthly
    };
};

const evaluateActionRateLimit = (profile = {}) => {
    const limits = normalizeActionLimits(profile);
    const usage = {
        hourly_actions_used: numberOrZero(profile.hourly_actions_used),
        daily_actions_used: numberOrZero(profile.daily_actions_used),
        monthly_actions_used: numberOrZero(profile.monthly_actions_used)
    };

    if (limits.hourly_action_limit > 0 && usage.hourly_actions_used >= limits.hourly_action_limit) {
        return { allowed: false, blocked: true, code: 'hourly_action_limit_reached', stage: 'hourly_limit', limits, usage };
    }
    if (limits.daily_action_limit > 0 && usage.daily_actions_used >= limits.daily_action_limit) {
        return { allowed: false, blocked: true, code: 'daily_action_limit_reached', stage: 'daily_limit', limits, usage };
    }
    if (limits.monthly_action_limit > 0 && usage.monthly_actions_used >= limits.monthly_action_limit) {
        return { allowed: false, blocked: true, code: 'monthly_action_limit_reached', stage: 'monthly_limit', limits, usage };
    }

    return { allowed: true, blocked: false, code: null, stage: null, limits, usage };
};

const buildActionUsageIncrementPatch = (profile = {}) => ({
    hourly_actions_used: numberOrZero(profile.hourly_actions_used) + 1,
    daily_actions_used: numberOrZero(profile.daily_actions_used) + 1,
    monthly_actions_used: numberOrZero(profile.monthly_actions_used) + 1
});

module.exports = {
    normalizeActionLimits,
    evaluateActionRateLimit,
    buildActionUsageIncrementPatch
};

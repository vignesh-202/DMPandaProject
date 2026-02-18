/**
 * Simple persistent rate limiter for frontend API calls.
 * Stores timestamps in localStorage to persist across navigation and refreshes.
 */

const RATE_LIMIT_PREFIX = 'dm_limit_';

export const getApiCooldown = (key: string, limitSeconds: number): number => {
    const lastRequest = localStorage.getItem(`${RATE_LIMIT_PREFIX}${key}`);
    if (!lastRequest) return 0;

    const elapsed = (Date.now() - parseInt(lastRequest)) / 1000;
    const remaining = Math.ceil(limitSeconds - elapsed);

    return remaining > 0 ? remaining : 0;
};

export const setApiTimestamp = (key: string): void => {
    localStorage.setItem(`${RATE_LIMIT_PREFIX}${key}`, Date.now().toString());
};

export const clearApiTimestamp = (key: string): void => {
    localStorage.removeItem(`${RATE_LIMIT_PREFIX}${key}`);
};

const rateLimitState = new Map<string, number>();

export const getApiCooldown = (key: string, limitSeconds: number): number => {
    const lastRequest = rateLimitState.get(key);
    if (!lastRequest) return 0;

    const elapsed = (Date.now() - lastRequest) / 1000;
    const remaining = Math.ceil(limitSeconds - elapsed);

    return remaining > 0 ? remaining : 0;
};

export const setApiTimestamp = (key: string): void => {
    rateLimitState.set(key, Date.now());
};

export const clearApiTimestamp = (key: string): void => {
    rateLimitState.delete(key);
};

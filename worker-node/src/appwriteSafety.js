const TRANSIENT_TOKENS = ['fetch failed', 'socket hang up', 'etimedout', 'econnreset', 'enotfound', 'eai_again'];

const classifyAppwriteError = (error) => {
    const code = Number(error?.code || error?.response?.code || 0);
    const message = String(error?.message || '').trim().toLowerCase();
    if (code === 409 || message.includes('already exists') || message.includes('already been taken')) return 'conflict';
    if (code === 401 || code === 403 || message.includes('permission')) return 'permission_issue';
    if (TRANSIENT_TOKENS.some((token) => message.includes(token))) return 'runtime_bug';
    if (message.includes('attribute') || message.includes('collection') || message.includes('schema')) return 'config_error';
    if (message.includes('env') || message.includes('endpoint') || message.includes('project')) return 'env_issue';
    return 'runtime_bug';
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const logAppwriteError = (scope, operation, error, context = {}) => {
    const payload = {
        scope,
        operation,
        error_class: classifyAppwriteError(error),
        message: String(error?.message || error || 'Unknown Appwrite error'),
        ...context
    };
    try {
        console.warn(JSON.stringify(payload));
    } catch (_) {
        console.warn(scope, operation, payload.message, context);
    }
};

const withAppwriteRetry = async (operation, {
    retries = 2,
    retryDelayMs = 250,
    scope = 'worker_appwrite',
    operationName = 'unknown',
    context = {}
} = {}) => {
    let attempt = 0;
    while (attempt <= retries) {
        try {
            return await operation();
        } catch (error) {
            const errorClass = classifyAppwriteError(error);
            const isRetryable = errorClass === 'runtime_bug' && attempt < retries;
            logAppwriteError(scope, operationName, error, { ...context, attempt: attempt + 1, retrying: isRetryable });
            if (!isRetryable) throw error;
            await wait(retryDelayMs * (attempt + 1));
            attempt += 1;
        }
    }
    return null;
};

module.exports = {
    classifyAppwriteError,
    logAppwriteError,
    withAppwriteRetry
};

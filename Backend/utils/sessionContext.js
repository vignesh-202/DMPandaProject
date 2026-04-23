const SESSION_COOKIE_NAMES = {
    frontend: 'session_token',
    admin: 'admin_session_token'
};

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');

const parseOrigin = (value) => {
    const normalized = normalizeOrigin(value);
    if (!normalized) return null;

    try {
        return new URL(normalized);
    } catch (_) {
        return null;
    }
};

const isLocalHostname = (hostname) => {
    const normalized = String(hostname || '').trim().toLowerCase();
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
};

const buildCookieSiteConfig = () => {
    const backendOrigin = parseOrigin(process.env.BACKEND_PUBLIC_ORIGIN);
    const appOrigins = [
        process.env.FRONTEND_ORIGIN,
        process.env.ADMIN_PANEL_ORIGIN
    ]
        .map(parseOrigin)
        .filter(Boolean);

    const hasRemoteAppOrigin = appOrigins.some((origin) => !isLocalHostname(origin.hostname));
    const crossSiteAgainstBackend = Boolean(
        backendOrigin && appOrigins.some((origin) =>
            origin.protocol !== backendOrigin.protocol || origin.hostname !== backendOrigin.hostname
        )
    );

    const secure = Boolean(
        (backendOrigin && backendOrigin.protocol === 'https:')
        || appOrigins.some((origin) => origin.protocol === 'https:')
    );

    const sameSite = (crossSiteAgainstBackend || hasRemoteAppOrigin) ? 'None' : 'Lax';

    return {
        secure,
        sameSite
    };
};

const normalizeAppContext = (value) => {
    const context = String(value || '').trim().toLowerCase();
    return context === 'admin' ? 'admin' : 'frontend';
};

const getAppContextFromRequest = (req) => {
    const headerContext = req?.headers?.['x-app-context'];
    if (typeof headerContext === 'string' && headerContext.trim()) {
        return normalizeAppContext(headerContext);
    }

    const queryTarget = req?.query?.target;
    if (typeof queryTarget === 'string' && queryTarget.trim()) {
        return normalizeAppContext(queryTarget);
    }

    return 'frontend';
};

const getSessionCookieName = (context) => SESSION_COOKIE_NAMES[normalizeAppContext(context)];

const getSessionTokenFromRequest = (req, options = {}) => {
    const { allowFallback = false } = options;
    const context = getAppContextFromRequest(req);
    const cookieName = getSessionCookieName(context);
    const contextualCookie = req?.cookies?.[cookieName];

    if (contextualCookie) {
        return contextualCookie;
    }

    if (allowFallback) {
        return req?.cookies?.session_token || req?.cookies?.admin_session_token || null;
    }

    return null;
};

const getSessionCookieOptions = () => {
    const siteConfig = buildCookieSiteConfig();

    return {
        httpOnly: true,
        secure: siteConfig.secure,
        sameSite: siteConfig.sameSite,
        path: '/',
        maxAge: 86400 * 30 * 1000
    };
};

const setSessionCookie = (res, token, context) => {
    const cookieName = getSessionCookieName(context);
    res.cookie(cookieName, token, getSessionCookieOptions());
};

const clearSessionCookie = (res, context) => {
    const cookieName = getSessionCookieName(context);
    const { maxAge, ...cookieOptions } = getSessionCookieOptions();
    res.clearCookie(cookieName, cookieOptions);
};

module.exports = {
    normalizeAppContext,
    getAppContextFromRequest,
    getSessionCookieName,
    getSessionTokenFromRequest,
    setSessionCookie,
    clearSessionCookie
};

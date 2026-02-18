export const getByteLength = (str: string) => new TextEncoder().encode(str).length;

export const validateUrl = (url: string) => {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return false;
        return true;
    } catch (_) {
        return false;
    }
};

export const validateMediaUrl = (url: string) => {
    if (!url) return false;
    try {
        new URL(url);
        return url.match(/\.(jpeg|jpg|gif|png|mp4)$/i) != null;
    } catch (_) {
        return false;
    }
};

export const validateMediaId = (id: string) => /^[0-9_]{10,50}$/.test(id);

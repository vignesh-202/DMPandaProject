const {
    APPWRITE_DATABASE_ID,
    SYSTEM_CONFIG_COLLECTION_ID
} = require('./appwrite');

const WATERMARK_POLICY_CONFIG_KEY = 'watermark_policy';
const SYSTEM_CONFIG_CACHE_TTL_MS = 30000;
const VALID_WATERMARK_TYPES = new Set(['text']);
const VALID_WATERMARK_POSITIONS = new Set(['secondary_message', 'inline_when_possible']);
const systemConfigCache = new Map();

const clampOpacity = (value, fallback = 1) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.min(1, numeric));
};

const DEFAULT_WATERMARK_POLICY = Object.freeze({
    enabled: String(process.env.DEFAULT_WATERMARK_ENABLED || 'true').trim().toLowerCase() !== 'false',
    type: VALID_WATERMARK_TYPES.has(String(process.env.DEFAULT_WATERMARK_TYPE || '').trim().toLowerCase())
        ? String(process.env.DEFAULT_WATERMARK_TYPE).trim().toLowerCase()
        : 'text',
    position: VALID_WATERMARK_POSITIONS.has(String(process.env.DEFAULT_WATERMARK_POSITION || '').trim().toLowerCase())
        ? String(process.env.DEFAULT_WATERMARK_POSITION).trim().toLowerCase()
        : 'secondary_message',
    opacity: clampOpacity(process.env.DEFAULT_WATERMARK_OPACITY, 1),
    updated_by: null,
    updated_at: null
});

const sanitizeWatermarkPolicy = (value = {}, fallback = DEFAULT_WATERMARK_POLICY) => {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const fallbackPolicy = fallback && typeof fallback === 'object' ? fallback : DEFAULT_WATERMARK_POLICY;
    const type = String(source.type || fallbackPolicy.type || DEFAULT_WATERMARK_POLICY.type).trim().toLowerCase();
    const position = String(source.position || fallbackPolicy.position || DEFAULT_WATERMARK_POLICY.position).trim().toLowerCase();
    return {
        enabled: source.enabled !== undefined ? source.enabled !== false : fallbackPolicy.enabled !== false,
        type: VALID_WATERMARK_TYPES.has(type) ? type : DEFAULT_WATERMARK_POLICY.type,
        position: VALID_WATERMARK_POSITIONS.has(position) ? position : DEFAULT_WATERMARK_POLICY.position,
        opacity: clampOpacity(source.opacity, fallbackPolicy.opacity ?? DEFAULT_WATERMARK_POLICY.opacity),
        updated_by: source.updated_by || fallbackPolicy.updated_by || null,
        updated_at: source.updated_at || fallbackPolicy.updated_at || null
    };
};

const readCache = (key) => {
    const cached = systemConfigCache.get(key);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
        systemConfigCache.delete(key);
        return null;
    }
    return { ...cached.value };
};

const writeCache = (key, value) => {
    systemConfigCache.set(key, {
        expiresAt: Date.now() + SYSTEM_CONFIG_CACHE_TTL_MS,
        value: { ...value }
    });
};

const readWatermarkPolicy = async (databases) => {
    const cached = readCache(WATERMARK_POLICY_CONFIG_KEY);
    if (cached) return sanitizeWatermarkPolicy(cached);

    try {
        const document = await databases.getDocument(
            APPWRITE_DATABASE_ID,
            SYSTEM_CONFIG_COLLECTION_ID,
            WATERMARK_POLICY_CONFIG_KEY
        );
        const policy = sanitizeWatermarkPolicy({
            enabled: document.enabled,
            type: document.type,
            position: document.position,
            opacity: document.opacity,
            updated_by: document.updated_by,
            updated_at: document.updated_at
        });
        writeCache(WATERMARK_POLICY_CONFIG_KEY, policy);
        return policy;
    } catch {
        const fallback = sanitizeWatermarkPolicy(DEFAULT_WATERMARK_POLICY);
        writeCache(WATERMARK_POLICY_CONFIG_KEY, fallback);
        return fallback;
    }
};

const saveWatermarkPolicy = async (databases, policy) => {
    const nextPolicy = sanitizeWatermarkPolicy({
        ...policy,
        updated_at: policy?.updated_at || new Date().toISOString()
    });
    const payload = {
        key: WATERMARK_POLICY_CONFIG_KEY,
        enabled: nextPolicy.enabled,
        type: nextPolicy.type,
        position: nextPolicy.position,
        opacity: nextPolicy.opacity,
        updated_by: nextPolicy.updated_by,
        updated_at: nextPolicy.updated_at
    };

    try {
        await databases.updateDocument(
            APPWRITE_DATABASE_ID,
            SYSTEM_CONFIG_COLLECTION_ID,
            WATERMARK_POLICY_CONFIG_KEY,
            payload
        );
    } catch (error) {
        const code = Number(error?.code || error?.response?.code || 0);
        if (code !== 404) throw error;
        await databases.createDocument(
            APPWRITE_DATABASE_ID,
            SYSTEM_CONFIG_COLLECTION_ID,
            WATERMARK_POLICY_CONFIG_KEY,
            payload
        );
    }

    writeCache(WATERMARK_POLICY_CONFIG_KEY, nextPolicy);
    return nextPolicy;
};

module.exports = {
    DEFAULT_WATERMARK_POLICY,
    VALID_WATERMARK_TYPES,
    VALID_WATERMARK_POSITIONS,
    WATERMARK_POLICY_CONFIG_KEY,
    sanitizeWatermarkPolicy,
    readWatermarkPolicy,
    saveWatermarkPolicy
};

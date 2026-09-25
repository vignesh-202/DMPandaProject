const crypto = require('crypto');

/**
 * Base64URL decode helper for decoding Meta signed_request components.
 * @param {string} str - Base64URL encoded string
 * @returns {Buffer} Decoded buffer
 */
const base64UrlDecode = (str) => {
    let base64 = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    return Buffer.from(base64, 'base64');
};

/**
 * Parses and verifies a Meta signed_request parameter using the App Secret.
 * @param {string} signedRequest - The raw signed_request string from Meta (sig.payload)
 * @param {string} secret - The Meta/Instagram App Secret
 * @returns {Object} The parsed payload object (containing user_id, issued_at, etc.)
 */
const parseSignedRequest = (signedRequest, secret) => {
    if (!signedRequest || typeof signedRequest !== 'string') {
        throw new Error('Missing or invalid signed_request parameter');
    }

    const parts = signedRequest.split('.');
    if (parts.length !== 2) {
        throw new Error('Malformed signed_request: expected exactly two parts separated by "."');
    }

    const [encodedSig, payloadStr] = parts;
    const sig = base64UrlDecode(encodedSig);
    const rawPayload = base64UrlDecode(payloadStr);

    let data;
    try {
        data = JSON.parse(rawPayload.toString('utf8'));
    } catch (_) {
        throw new Error('Failed to parse signed_request JSON payload');
    }

    if (String(data.algorithm || '').toUpperCase() !== 'HMAC-SHA256') {
        throw new Error(`Unsupported signature algorithm: ${data.algorithm || 'unknown'}`);
    }

    const appSecret = String(secret || '').trim();
    if (!appSecret) {
        throw new Error('Instagram/Facebook App Secret is not configured on the server');
    }

    const expectedSig = crypto
        .createHmac('sha256', appSecret)
        .update(payloadStr)
        .digest();

    if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(sig, expectedSig)) {
        throw new Error('Invalid signed_request signature');
    }

    return data;
};

module.exports = {
    base64UrlDecode,
    parseSignedRequest
};

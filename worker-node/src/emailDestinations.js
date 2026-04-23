const axios = require('axios');
const crypto = require('crypto');

const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

const parseServiceAccountJson = () => {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        if (!parsed?.client_email || !parsed?.private_key) return null;
        return parsed;
    } catch (_) {
        return null;
    }
};

const base64UrlEncode = (value) => Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const createGoogleAccessToken = async () => {
    const serviceAccount = parseServiceAccountJson();
    if (!serviceAccount) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing or invalid');
    }

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claimSet = {
        iss: serviceAccount.client_email,
        scope: GOOGLE_SHEETS_SCOPE,
        aud: GOOGLE_OAUTH_TOKEN_URL,
        exp: now + 3600,
        iat: now
    };

    const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claimSet))}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsignedToken);
    signer.end();
    const signature = signer.sign(serviceAccount.private_key);
    const jwt = `${unsignedToken}.${base64UrlEncode(signature)}`;

    const response = await axios.post(
        GOOGLE_OAUTH_TOKEN_URL,
        new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt
        }).toString(),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 15000
        }
    );

    if (!response.data?.access_token) {
        throw new Error('Failed to get Google access token');
    }

    return response.data.access_token;
};

const appendGoogleSheetRow = async (destination, payload) => {
    const destinationJson = destination?.destination_json || {};
    const spreadsheetId = destinationJson.spreadsheet_id || String(destination?.destination_id || '').split('::')[0];
    const sheetTitle = destinationJson.sheet_title || 'Sheet1';
    if (!spreadsheetId) {
        throw new Error('Verified Google Sheet metadata is missing');
    }

    const accessToken = await createGoogleAccessToken();
    const range = encodeURIComponent(`${sheetTitle}!A:I`);
    const rowValues = [[
        String(payload.email || '').trim(),
        String(payload.normalized_email || '').trim(),
        String(payload.sender_id || '').trim(),
        String(payload.sender_profile_url || '').trim(),
        String(payload.receiver_name || '').trim(),
        String(payload.automation_id || '').trim(),
        String(payload.automation_title || '').trim(),
        String(payload.automation_type || '').trim(),
        String(payload.received_at || '').trim()
    ]];

    const response = await axios.post(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append`,
        {
            majorDimension: 'ROWS',
            values: rowValues
        },
        {
            params: { valueInputOption: 'USER_ENTERED' },
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        }
    );

    return response.data || null;
};

const sendWebhookPayload = async (webhookUrl, payload) => {
    const response = await axios.post(
        String(webhookUrl || '').trim(),
        payload,
        {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 15000,
            validateStatus: (status) => status >= 200 && status < 300
        }
    );

    return {
        status: response.status,
        data: response.data
    };
};

const deliverCollectedEmail = async (destination, payload) => {
    const destinationType = String(destination?.destination_type || '').trim().toLowerCase();

    if (destinationType === 'sheet') {
        return appendGoogleSheetRow(destination, payload);
    }

    if (destinationType === 'webhook') {
        return sendWebhookPayload(destination?.webhook_url, payload);
    }

    throw new Error('Unsupported email collector destination type');
};

module.exports = {
    deliverCollectedEmail,
    sendWebhookPayload
};

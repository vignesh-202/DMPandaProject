const axios = require('axios');
const crypto = require('crypto');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

const base64UrlEncode = (value) => Buffer.from(value).toString('base64url');

const getGoogleServiceAccount = () => {
    const raw = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
    if (!raw) {
        throw new Error('Google service account is not configured.');
    }
    const parsed = JSON.parse(raw);
    if (!parsed.client_email || !parsed.private_key) {
        throw new Error('Google service account JSON is missing required fields.');
    }
    return parsed;
};

const createGoogleAccessToken = async () => {
    const serviceAccount = getGoogleServiceAccount();
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload = {
        iss: serviceAccount.client_email,
        scope: GOOGLE_SHEETS_SCOPE,
        aud: GOOGLE_TOKEN_URL,
        exp: issuedAt + 3600,
        iat: issuedAt
    };
    const header = { alg: 'RS256', typ: 'JWT' };
    const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
    const signature = crypto.createSign('RSA-SHA256').update(unsignedToken).sign(serviceAccount.private_key, 'base64url');
    const assertion = `${unsignedToken}.${signature}`;

    const response = await axios.post(
        GOOGLE_TOKEN_URL,
        new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion
        }).toString(),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    );

    return response.data?.access_token || '';
};

const parseGoogleSheetUrl = (sheetUrl) => {
    const safeUrl = String(sheetUrl || '').trim();
    if (!safeUrl) {
        throw new Error('Google Sheet URL is required.');
    }

    let url;
    try {
        url = new URL(safeUrl);
    } catch (_) {
        throw new Error('Enter a valid Google Sheet URL.');
    }

    if (!/docs\.google\.com$/i.test(url.hostname)) {
        throw new Error('Enter a valid Google Sheet URL.');
    }

    const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
        throw new Error('Enter a valid Google Sheet URL.');
    }

    const spreadsheetId = match[1];
    const gid = url.searchParams.get('gid');
    return {
        spreadsheetId,
        gid: gid ? String(gid).trim() : ''
    };
};

const loadSpreadsheetMetadata = async (sheetUrl) => {
    const token = await createGoogleAccessToken();
    const { spreadsheetId, gid } = parseGoogleSheetUrl(sheetUrl);
    const response = await axios.get(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    const sheets = Array.isArray(response.data?.sheets) ? response.data.sheets : [];
    let selectedSheet = sheets[0] || null;
    if (gid) {
        selectedSheet = sheets.find((sheet) => String(sheet?.properties?.sheetId || '') === gid) || selectedSheet;
    }
    if (!selectedSheet) {
        throw new Error('The Google Sheet does not contain any accessible tabs.');
    }

    return {
        spreadsheet_id: spreadsheetId,
        spreadsheet_name: String(response.data?.properties?.title || 'Untitled Spreadsheet').trim(),
        sheet_name: String(selectedSheet?.properties?.title || 'Sheet1').trim(),
        sheet_gid: String(selectedSheet?.properties?.sheetId || '').trim(),
        sheet_verified: true
    };
};

const sendWebhookPayload = async (webhookUrl, payload) => {
    const safeWebhookUrl = String(webhookUrl || '').trim();
    if (!safeWebhookUrl) {
        throw new Error('Webhook URL is required.');
    }
    try {
        const response = await axios.post(safeWebhookUrl, payload, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            },
            validateStatus: () => true
        });
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Webhook responded with status ${response.status}.`);
        }
        return true;
    } catch (error) {
        throw new Error(error?.message || 'Webhook verification failed.');
    }
};

module.exports = {
    getGoogleServiceAccount,
    createGoogleAccessToken,
    parseGoogleSheetUrl,
    loadSpreadsheetMetadata,
    sendWebhookPayload
};

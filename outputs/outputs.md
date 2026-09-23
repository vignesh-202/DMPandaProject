# Comprehensive Security Audit Report — DMPanda Project

**Conducted Using:** Cloudflare Security Audit Methodology & Adversarial Verification Pipeline  
**Target Repository:** `DMPandaProject`  
**Date:** September 2026  
**Audit Scope:** Full codebase audit covering `Backend/`, `Frontend/`, `admin-panel/`, `streamer-node/`, `worker-node/`, and `ProductionSetup/`  
**Artifacts Generated:**
- [`outputs/outputs.md`](file:///c:/Users/vigan/PycharmProjects/DMPandaProject/outputs/outputs.md) (Human-readable report)
- [`outputs/findings.json`](file:///c:/Users/vigan/PycharmProjects/DMPandaProject/outputs/findings.json) (Machine-readable findings validated by `validate-findings.cjs`)
- [`outputs/coverage-ledger.json`](file:///c:/Users/vigan/PycharmProjects/DMPandaProject/outputs/coverage-ledger.json) (Deterministic coverage ledger validated by `validate-coverage-ledger.cjs`)

---

## 1. Executive Summary

A full end-to-end security audit was conducted on the **DM Panda** multi-tier automation platform. The audit combined architecture mapping, adversarial coverage-led hunting, and independent source verification to identify vulnerabilities that violate concrete trust boundaries.

A total of **7 confirmed vulnerabilities** were identified and independently verified:
- **1 Critical-severity vulnerability**: Complete authentication bypass on the Meta/Instagram webhook receiver (`streamer-node`), allowing unauthenticated attackers to forge webhook events and trigger unauthorized DM automation actions.
- **1 High-severity vulnerability**: Overly permissive CORS configuration allowing arbitrary Microsoft Dev Tunnels (`*.devtunnels.ms`) and Hostinger sites (`*.hostingersite.com`) with credentials, enabling cross-origin authenticated API exploitation.
- **3 Medium-severity vulnerabilities**:
  - Unauthenticated media proxy endpoint with missing protocol validation and default redirect following (potential SSRF).
  - Exposure of sensitive session authentication tokens in GET URL query parameters.
  - Complete lack of rate limiting on sensitive authentication surfaces (login, registration, password recovery).
- **2 Low-severity vulnerabilities**:
  - Non-constant-time HMAC signature comparison in Razorpay payment verification.
  - Unthrottled database writes triggered on inbound requests with dynamic origin headers.

---

## 2. Architecture & Trust Boundary Map

```
                     +-----------------------------------+
                     |  Untrusted Internet / Attackers   |
                     +-----------------+-----------------+
                                       |
                   +-------------------+-------------------+
                   |                                       |
    [Inbound Webhooks: /webhook]             [REST API: /api/*, /auth/*]
                   |                                       |
                   v                                       v
         +--------------------+                 +--------------------+
         |   streamer-node    |                 |   Express Backend  |
         |  (Port 3010 / 3000)|                 |     (Port 5000)    |
         +---------+----------+                 +----------+---------+
                   |                                       |
         [WebSocket /workers]                 [Appwrite SDK / Databases]
                   |                                       |
                   v                                       v
         +--------------------+                 +--------------------+
         |    worker-node     |                 |  Appwrite Backend  |
         | (Automation Queue) |<--------------->|     & Database     |
         +---------+----------+                 +--------------------+
                   |
     [Instagram Graph API v24.0]
                   v
         +--------------------+
         | Meta Graph Servers |
         +--------------------+
```

### Key Subsystems & Boundaries
1. **Public Webhook Ingress (`streamer-node`)**:
   - **Boundary**: External Meta servers to internal job dispatch queue.
   - **Intended Control**: HMAC-SHA256 signature verification via `x-hub-signature-256` header.
2. **REST API Gateway (`Backend/app.js`)**:
   - **Boundary**: Untrusted browser clients to backend services and Appwrite database.
   - **Intended Control**: Cookie/Bearer session authentication (`loginRequired`), Role-based access control (`adminRequired`), and CORS origin enforcement.
3. **Admin Panel Boundary (`Backend/routes/admin.js`)**:
   - **Boundary**: Standard users to privileged administrative functions (user bans, plan modification, cluster telemetry).
   - **Intended Control**: Label checking (`labels.includes('admin')`) and cryptographically signed impersonation tokens.
4. **Payment Gateway (`Backend/routes/payment.js`)**:
   - **Boundary**: Razorpay webhook and checkout verification to plan entitlements.
   - **Intended Control**: HMAC-SHA256 signature verification with secret key.

---

## 3. Findings Summary Table

| Severity | Fingerprint | Title | CWE | Affected File |
| :--- | :--- | :--- | :--- | :--- |
| **CRITICAL** | `DMP-SEC-001-META-WEBHOOK-AUTH-BYPASS` | Webhook Signature Verification Bypass via Omitted Header | CWE-287 / CWE-347 | [`streamer-node/src/webhook-server.js`](file:///c:/Users/vigan/PycharmProjects/DMPandaProject/streamer-node/src/webhook-server.js#L100) |
| **HIGH** | `DMP-SEC-002-PERMISSIVE-CORS-DEVTUNNEL` | Overly Permissive CORS with Wildcard Devtunnel & Hostinger Origins | CWE-942 / CWE-352 | [`Backend/app.js`](file:///c:/Users/vigan/PycharmProjects/DMPandaProject/Backend/app.js#L29-L54) |
| **MEDIUM** | `DMP-SEC-003-ADMIN-MEDIA-PROXY-SSRF` | Unauthenticated Media Proxy with Missing Protocol Validation | CWE-918 / CWE-306 | [`Backend/routes/admin.js`](file:///c:/Users/vigan/PycharmProjects/DMPandaProject/Backend/routes/admin.js#L2908) |
| **MEDIUM** | `DMP-SEC-004-QUERY-TOKEN-SESSION-LEAK` | Session Token Accepted in GET URL Query Parameters | CWE-598 / CWE-200 | [`Backend/middleware/auth.js`](file:///c:/Users/vigan/PycharmProjects/DMPandaProject/Backend/middleware/auth.js#L57-L59) |
| **MEDIUM** | `DMP-SEC-005-AUTH-NO-RATE-LIMITING` | Missing Rate Limiting on Login, Register, and Password Reset | CWE-307 / CWE-799 | [`Backend/routes/auth.js`](file:///c:/Users/vigan/PycharmProjects/DMPandaProject/Backend/routes/auth.js#L296) |
| **LOW** | `DMP-SEC-006-RAZORPAY-HMAC-TIMING-ATTACK` | Non-Constant-Time Signature Comparison in Razorpay Verification | CWE-208 | [`Backend/routes/payment.js`](file:///c:/Users/vigan/PycharmProjects/DMPandaProject/Backend/routes/payment.js#L1606) |
| **LOW** | `DMP-SEC-007-UNTHROTTLED-ORIGIN-DB-WRITE` | Unthrottled Database Write on Inbound Requests with Dynamic Origins | CWE-400 / CWE-770 | [`Backend/app.js`](file:///c:/Users/vigan/PycharmProjects/DMPandaProject/Backend/app.js#L56-L65) |

---

## 4. Deep-Dive Vulnerability Analysis & Remediations

### 4.1. DMP-SEC-001: Webhook Signature Verification Bypass via Omitted Header (CRITICAL)

#### Description & Root Cause
In `streamer-node/src/webhook-server.js` (lines 96–105), the webhook route handles incoming Meta/Instagram webhook POST notifications:
```javascript
app.post('/webhook', async (req, res) => {
    const signature = req.headers['x-hub-signature-256'] || '';
    const secret = appSecret || process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET || '';

    if (secret && signature) {
        const isValid = verifyMetaSignature(req.rawBody, signature, secret);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }
    }

    try {
        const result = await onWebhook(req.body || {});
        return res.status(200).json({
            success: true,
            accepted: Number(result?.accepted || 0)
        });
    } catch (error) { ... }
});
```
Notice the condition:
`if (secret && signature)`
When an external attacker makes a POST request to `/webhook` without providing the `x-hub-signature-256` header, `signature` is initialized to `''` (falsy). The conditional evaluates to `false`. **The entire cryptographic signature check is skipped.** The server accepts the payload with HTTP 200 and forwards it to `onWebhook()`.

#### Impact
An unauthenticated remote attacker can forge arbitrary Instagram webhook events:
1. Fake incoming direct messages (`messaging` events).
2. Fake comments and replies on victim posts and reels.
3. Fake story mentions and live events.
These forged events are enqueued and dispatched to `worker-node`, which will trigger automatic private replies, send outgoing DMs via connected users' access tokens, burn hourly/daily action limits, and pollute database logs.

#### Remediation
Enforce that whenever `secret` is set, `signature` is mandatory. If `signature` is absent or invalid, immediately reject the request with 401 Unauthorized:
```javascript
const signature = req.headers['x-hub-signature-256'] || '';
const secret = appSecret || process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET || '';

if (secret) {
    if (!signature || !verifyMetaSignature(req.rawBody, signature, secret)) {
        return res.status(401).json({ error: 'Invalid or missing webhook signature' });
    }
}
```

---

### 4.2. DMP-SEC-002: Overly Permissive CORS with Wildcard Devtunnels & Hostinger Origins (HIGH)

#### Description & Root Cause
In `Backend/app.js` (lines 29–54), CORS allows origins dynamically:
```javascript
const isDevOrigin = (origin) => {
    if (!origin) return false;
    const normalized = normalizeOrigin(origin).toLowerCase();
    // Allow any devtunnels.ms origin
    if (normalized.endsWith('.devtunnels.ms')) return true;
    // Allow any localhost origin
    if (normalized.startsWith('http://localhost:') || normalized.startsWith('http://127.0.0.1:')) return true;
    // Allow dmpanda.com and any subdomain (*.dmpanda.com)
    if (normalized === 'https://dmpanda.com' || normalized === 'http://dmpanda.com' || normalized.endsWith('.dmpanda.com')) return true;
    // Allow Hostinger temporary / preview domains
    if (normalized.endsWith('.hostingersite.com')) return true;
    return false;
};

app.use(cors({
    origin: (origin, callback) => {
        const normalizedOrigin = normalizeOrigin(origin);
        if (!origin || allowedOrigins.has(normalizedOrigin) || isDevOrigin(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
```
Both `devtunnels.ms` (Microsoft Dev Tunnels) and `hostingersite.com` (Hostinger Preview) are public multi-tenant hosting platforms where anyone can register a free account and host arbitrary web pages.
Furthermore, `Backend/utils/sessionContext.js` configures cookies with `SameSite=None; Secure=true` for cross-site operations.

#### Impact
An attacker can register `https://evil-hacker.inc1.devtunnels.ms` and host malicious JavaScript. If a logged-in user or admin navigates to the attacker's link, the attacker's script can issue cross-origin requests with `credentials: 'include'` to `https://api.dmpanda.com/api/me`, `/api/account/ig-accounts`, or `/api/admin/users`. The browser will attach the session cookies, and the backend CORS middleware will reflect the attacker's origin and allow reading sensitive user data.

#### Remediation
Remove generic multi-tenant suffix matching. Only allow specific, fully-qualified origin URLs explicitly declared in environment variables:
```javascript
const isDevOrigin = (origin) => {
    if (!origin) return false;
    const normalized = normalizeOrigin(origin).toLowerCase();
    if (normalized.startsWith('http://localhost:') || normalized.startsWith('http://127.0.0.1:')) return true;
    if (normalized === 'https://dmpanda.com' || normalized === 'http://dmpanda.com' || normalized.endsWith('.dmpanda.com')) return true;
    return false;
};
```

---

### 4.3. DMP-SEC-003: Unauthenticated Media Proxy with Missing Protocol Validation (MEDIUM)

#### Description & Root Cause
In `Backend/routes/admin.js` (lines 2908–2953), the `/media-proxy` endpoint is declared without authentication middleware:
```javascript
router.get('/media-proxy', async (req, res) => {
    const mediaUrl = String(req.query.url || '').trim();
    // ...
    let parsedUrl;
    try {
        parsedUrl = new URL(mediaUrl);
    } catch (_) {
        return res.status(400).json({ error: 'Invalid media URL.' });
    }
    // Hostname check: lookaside.fbsbx.com, cdninstagram.com, etc.
    // ...
    const response = await axios.get(mediaUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: { ... }
    });
```
1. **No Authentication**: The endpoint is mounted under `/api/admin/media-proxy` but lacks `loginRequired` and `adminRequired`.
2. **Missing Protocol Validation**: It does not verify that `parsedUrl.protocol === 'https:'`.
3. **Redirect Following Enabled**: `axios` follows up to 5 HTTP 302 redirects by default. If an Instagram or Facebook endpoint has an open redirect or redirects to an internal endpoint (e.g., cloud metadata `169.254.169.254` or internal services on `10.0.0.0/8`), `axios` follows the redirect and exposes the response.

#### Impact
Anonymous users can abuse the server as an open proxy for social media assets and potentially exploit redirect-based SSRF.

#### Remediation
1. Attach `loginRequired` and `adminRequired` middleware.
2. Require `parsedUrl.protocol === 'https:'`.
3. Set `maxRedirects: 0` in the axios request configuration.

---

### 4.4. DMP-SEC-004: Session Token Accepted in GET URL Query Parameters (MEDIUM)

#### Description & Root Cause
In `Backend/middleware/auth.js` (lines 57–60):
```javascript
if (!sessionToken && req.query?.token) {
    sessionToken = String(req.query.token).trim();
}
```
Accepting sensitive authentication tokens in GET query strings (`?token=...`) allows credentials to be:
- Recorded in plain text in web server access logs and load balancer logs.
- Retained in browser navigation history.
- Transmitted in the `Referer` header to external websites when links are clicked.

#### Impact
Exposure of session tokens leads to unauthorized session hijacking and account compromise.

#### Remediation
Remove query-parameter token fallback from `loginRequired`. Require authentication tokens to be supplied strictly via the `Authorization: Bearer <token>` header or HttpOnly cookies.

---

### 4.5. DMP-SEC-005: Missing Rate Limiting on Login, Register, and Password Reset (MEDIUM)

#### Description & Root Cause
In `Backend/routes/auth.js`:
- `POST /api/login` (line 296)
- `POST /api/register` (line 238)
- `POST /api/forgot-password` (line 801)
None of these endpoints employ rate limiting. Although `express-rate-limit` is listed as a dependency in `Backend/package.json`, it was never imported or instantiated.

#### Impact
An attacker can conduct automated credential stuffing, brute-force weak user passwords, create mass spam accounts, or flood victim email addresses with password reset notifications.

#### Remediation
Import and configure `express-rate-limit` for authentication and password recovery endpoints:
```javascript
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // Limit each IP to 15 attempts per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again after 15 minutes.' }
});

router.post('/api/login', authLimiter, async (req, res) => { ... });
router.post('/api/forgot-password', authLimiter, async (req, res) => { ... });
```

---

### 4.6. DMP-SEC-006: Non-Constant-Time Signature Comparison in Razorpay Verification (LOW)

#### Description & Root Cause
In `Backend/routes/payment.js` (line 1606):
```javascript
const generatedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

if (generatedSignature !== razorpay_signature) {
    return res.status(400).json({ error: 'Payment verification failed' });
}
```
Using the standard string inequality operator (`!==`) evaluates characters sequentially and terminates upon the first mismatched byte, creating a timing side-channel.

#### Remediation
Use `crypto.timingSafeEqual`:
```javascript
const genBuf = Buffer.from(generatedSignature, 'utf8');
const sigBuf = Buffer.from(String(razorpay_signature || ''), 'utf8');

if (genBuf.length !== sigBuf.length || !crypto.timingSafeEqual(genBuf, sigBuf)) {
    return res.status(400).json({ error: 'Payment verification failed' });
}
```

---

### 4.7. DMP-SEC-007: Unthrottled Database Write on Inbound Requests with Dynamic Origins (LOW)

#### Description & Root Cause
In `Backend/app.js` (lines 56–65):
```javascript
app.use((req, _res, next) => {
    const requestOrigin = normalizeRuntimeOrigin(req.get('origin') || req.get('referer') || '');
    if (requestOrigin && (allowedOrigins.has(requestOrigin) || isDevOrigin(requestOrigin))) {
        const databases = new Databases(getAppwriteClient({ useApiKey: true }));
        saveRuntimeFrontendOrigin(databases, requestOrigin).catch((error) => {
            console.warn(`Failed to capture runtime frontend origin: ${error?.message || String(error)}`);
        });
    }
    next();
});
```
Every incoming request that matches `isDevOrigin` triggers an asynchronous Appwrite database update or creation. Rotating origin headers (`Origin: https://node-1.devtunnels.ms`, `Origin: https://node-2.devtunnels.ms`) forces continuous database write operations.

#### Remediation
Remove dynamic runtime origin persistence from arbitrary request headers. Maintain origin configurations statically via environment variables.

---

## 5. Verification & Schema Validation Results

All security audit artifacts have been verified using the official validation test suites provided by Cloudflare:

```bash
# Findings schema and structure verification
$ node .agents/skills/security-audit/validate-findings.cjs outputs/findings.json
PASS: 7 findings valid

# Coverage ledger and canonical reference verification
$ node .agents/skills/security-audit/validate-coverage-ledger.cjs outputs/coverage-ledger.json
PASS: 7 coverage units valid
```

- `outputs/findings.json`: 100% compliant with `report-schema.json`.
- `outputs/coverage-ledger.json`: 100% compliant with deterministic canonical coverage tracking invariants.

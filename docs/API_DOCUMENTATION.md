# 🐼 DM Panda Developer REST API Documentation (v1)

Welcome to the **DM Panda Developer REST API v1** reference. The API allows developers, automated workflows, and third-party tools (such as n8n, Zapier, Make, and custom web applications) to interact programmatically with DM Panda's Instagram DM & Comment Automation engine.

---

## 🔐 Base URL & Authentication

### Base URL
- **Production Base URL**: `https://api.yourdomain.com/api/v1`
- **Local Development**: `http://localhost:5000/api/v1`

### Authentication Headers
All requests must include an active API Key passed via the HTTP Header:

```http
X-API-Key: dmp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Alternatively, standard HTTP Authorization Bearer tokens are supported:

```http
Authorization: Bearer dmp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> [!NOTE]
> You can generate and manage API keys inside your DM Panda Dashboard under **API & Integrations**.

---

## 📡 Endpoints Reference

### 1. Account Profile & Limits
#### `GET /api/v1/me`
Retrieves authenticated user profile details, active subscription plan, and action limits.

**Example Request:**
```bash
curl -X GET "https://api.yourdomain.com/api/v1/me" \
     -H "X-API-Key: dmp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Example Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "67980a...",
    "name": "John Doe",
    "email": "john@example.com",
    "emailVerified": true,
    "plan": {
      "plan_id": "pro",
      "plan_name": "Pro Marketer Plan",
      "limits": {
        "monthly_action_limit": 50000,
        "max_ig_accounts": 10
      }
    },
    "authenticatedVia": "api_key"
  }
}
```

---

### 2. Connected Instagram Accounts
#### `GET /api/v1/accounts`
Lists all connected Instagram Business / Creator accounts.

**Example Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "acc_123",
      "igUserId": "1784140000000",
      "username": "mybrand_official",
      "name": "My Brand",
      "status": "connected",
      "monthlyActionsUsed": 1240,
      "dailyActionsUsed": 85
    }
  ]
}
```

---

### 3. Automations Management

#### `GET /api/v1/automations`
List existing automations. Supports optional query parameters:
- `account_id`: Filter by Instagram account ID.
- `trigger_type`: Filter by trigger type (`post_comment`, `story_reply`, `dm_message`, `live_comment`).
- `is_active`: Filter by active status (`true` / `false`).

#### `POST /api/v1/automations`
Creates a new Instagram automation flow.

**Request Body:**
```json
{
  "title": "Lead Magnet — Free Ebook DM",
  "triggerType": "post_comment",
  "keywords": ["EBOOK", "PDF", "GUIDE"],
  "matchRule": "contains",
  "replyText": "Hey! Here is your free eBook link: https://example.com/download.pdf 📚",
  "isActive": true
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "auto_987",
    "title": "Lead Magnet — Free Ebook DM",
    "triggerType": "post_comment",
    "keywords": ["EBOOK", "PDF", "GUIDE"],
    "isActive": true,
    "createdAt": "2026-07-26T17:00:00.000Z"
  }
}
```

#### `GET /api/v1/automations/:id`
Retrieves full details for a specific automation by ID.

#### `PATCH /api/v1/automations/:id`
Updates automation fields or toggles active status (`isActive: true | false`).

#### `DELETE /api/v1/automations/:id`
Deletes an automation.

#### `POST /api/v1/automations/:id/trigger`
Manually triggers an automation flow or dispatches a DM payload to a specific Instagram user.

**Request Body:**
```json
{
  "recipientUsername": "john_doe",
  "customMessage": "Special offer for you! Check your inbox."
}
```

---

### 4. Performance Analytics
#### `GET /api/v1/analytics`
Fetches aggregate performance metrics across all connected accounts.

**Example Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalAccounts": 3,
    "totalAutomations": 12,
    "activeAutomations": 10,
    "dmsSent24h": 412,
    "dmsSent30d": 12850,
    "successRate": "99%"
  }
}
```

---

### 5. Execution Logs
#### `GET /api/v1/logs`
List detailed execution logs for DM sends and public comment replies. Query parameters:
- `limit`: Number of records to return (default 50, max 100).
- `offset`: Pagination offset.
- `status`: Filter by status (`success`, `failed`, `skipped`).

**Example Response (200 OK):**
```json
{
  "success": true,
  "total": 1250,
  "limit": 50,
  "offset": 0,
  "data": [
    {
      "id": "log_001",
      "automationId": "auto_987",
      "recipientName": "jane_smith",
      "status": "success",
      "messageSent": "Hey! Here is your free eBook link...",
      "sentAt": "2026-07-26T16:55:00.000Z"
    }
  ]
}
```

---

### 6. API Key Management
#### `GET /api/v1/api-keys` — List API keys
#### `POST /api/v1/api-keys` — Create API key (`{ "name": "n8n Integration" }`)
#### `DELETE /api/v1/api-keys/:id` — Revoke API key

---

## 🛠️ SDK / Code Examples

### JavaScript / Node.js
```javascript
const response = await fetch('https://api.yourdomain.com/api/v1/automations', {
  headers: {
    'X-API-Key': 'dmp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  }
});
const data = await response.json();
console.log(data);
```

### Python
```python
import requests

headers = {
    'X-API-Key': 'dmp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
}
response = requests.get('https://api.yourdomain.com/api/v1/automations', headers=headers)
print(response.json())
```

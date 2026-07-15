# DM Panda — Multi-Service Deployment Guide

This project contains **5 independent services**, each deployed separately on its own Hostinger Cloud Startup instance with its own subdomain.

## 🗂️ Service Map

| Service | Folder | Suggested Subdomain | Description |
|---|---|---|---|
| **Frontend** | `Frontend/` | `app.yourdomain.com` | React + Vite customer dashboard |
| **Backend API** | `Backend/` | `api.yourdomain.com` | Express API server |
| **Admin Panel** | `admin-panel/` | `admin.yourdomain.com` | React + Vite admin dashboard |
| **Streamer Node** | `streamer-node/` | `streamer.yourdomain.com` | Meta webhook receiver |
| **Worker Node** | `worker-node/` | `worker.yourdomain.com` | Automation execution engine |

---

## ⚡ Hostinger Cloud Startup — Per-Service Setup

In Hostinger, create **one Node.js app per service**. Point each app to the **same GitHub repository** and set the **Root directory** to the service's folder.

---

### 1️⃣ Frontend — `app.yourdomain.com`

> **⚠️ IMPORTANT:** Set environment variables **before** building. `VITE_` variables are baked into the compiled bundle.

**Hostinger Settings:**
- **Root directory:** `Frontend`
- **Build command:** `npm run build`
- **Start command:** `npm start`

**Environment Variables (set in Hostinger panel):**
```
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
```

---

### 2️⃣ Backend API — `api.yourdomain.com`

**Hostinger Settings:**
- **Root directory:** `Backend`
- **Build command:** *(leave empty — no build step)*
- **Start command:** `npm start`

**Environment Variables (set in Hostinger panel):**
```
PORT=3000
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key
APPWRITE_DATABASE_ID=your_database_id
APPWRITE_STORAGE_ID=your_storage_id
FRONTEND_ORIGIN=https://app.yourdomain.com
ADMIN_PANEL_ORIGIN=https://admin.yourdomain.com
BACKEND_PUBLIC_ORIGIN=https://api.yourdomain.com
INSTAGRAM_APP_ID=your_meta_app_id
INSTAGRAM_APP_SECRET=your_meta_app_secret
INSTAGRAM_APP_VERSION=v24.0
INSTAGRAM_REDIRECT_URL=https://app.yourdomain.com/auth/ig-callback
RAZORPAY_KEY_ID=rzp_live_xxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
FUNCTION_REMOVE_INSTAGRAM=remove-instagram
```

---

### 3️⃣ Admin Panel — `admin.yourdomain.com`

> **⚠️ IMPORTANT:** Set environment variables **before** building.

**Hostinger Settings:**
- **Root directory:** `admin-panel`
- **Build command:** `npm run build`
- **Start command:** `npm start`

**Environment Variables (set in Hostinger panel):**
```
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your_project_id
VITE_APPWRITE_DATABASE_ID=your_database_id
VITE_API_BASE_URL=https://api.yourdomain.com
```

---

### 4️⃣ Streamer Node — `streamer.yourdomain.com`

**Hostinger Settings:**
- **Root directory:** `streamer-node`
- **Build command:** *(leave empty)*
- **Start command:** `npm start`

**Environment Variables:**
```
PORT=3000
META_VERIFY_TOKEN=your_webhook_verify_token
WORKER_SHARED_SECRET=your_long_random_shared_secret
STREAMER_ASSIGN_TIMEOUT_MS=3000
STREAMER_JOB_HEARTBEAT_TIMEOUT_MS=30000
STREAMER_TIMEOUT_SWEEP_MS=2000
STREAMER_MAX_JOB_ATTEMPTS=5
```

**After deploying:** Register `https://streamer.yourdomain.com/webhook` as your **Meta Webhook Callback URL** in the Meta Developer Console.

---

### 5️⃣ Worker Node — `worker.yourdomain.com`

**Hostinger Settings:**
- **Root directory:** `worker-node`
- **Build command:** *(leave empty)*
- **Start command:** `npm start`

**Environment Variables:**
```
PORT=3000
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key
APPWRITE_DATABASE_ID=your_database_id
IG_ACCOUNTS_COLLECTION_ID=ig_accounts
AUTOMATIONS_COLLECTION_ID=automations
TEMPLATES_COLLECTION_ID=templates
USERS_COLLECTION_ID=users
PROFILES_COLLECTION_ID=profiles
INSTAGRAM_APP_ID=your_meta_app_id
INSTAGRAM_APP_SECRET=your_meta_app_secret
IG_API_VERSION=v24.0
DM_PANDA_REDIRECT_BASE_URL=https://app.yourdomain.com
STREAMER_WS_URL=wss://streamer.yourdomain.com/workers
WORKER_SHARED_SECRET=your_long_random_shared_secret
WORKER_INSTANCE_ID=worker-prod-1
WORKER_MAX_CONCURRENCY=30
LOG_LEVEL=info
META_VERIFY_TOKEN=your_webhook_verify_token
```

---

## 🔗 How Services Connect

```
Browser → app.yourdomain.com  (Frontend)
              │
              └──► api.yourdomain.com   (Backend)
                       │
                       └──► Appwrite (database, auth)

Instagram → streamer.yourdomain.com  (Meta Webhooks)
                 │
                 └──► worker.yourdomain.com  (via WebSocket)
                           │
                           └──► Appwrite + Instagram Graph API
```

---

## 💻 Local Development

Each service runs independently on its own port:

```bash
# Terminal 1 — Frontend
cd Frontend && npm run dev -- --host       # http://localhost:5173

# Terminal 2 — Backend
cd Backend && npm run dev -- --host        # http://localhost:5000

# Terminal 3 — Admin Panel
cd admin-panel && npm run dev -- --host    # http://localhost:5174

# Terminal 4 — Streamer
cd streamer-node && npm start              # http://localhost:3000

# Terminal 5 — Worker
cd worker-node && npm start               # http://localhost:3001
```

---

## 📁 `.env.example` Reference Files

Each service has an `.env.example` file documenting all required variables:

| Service | Example File |
|---|---|
| Frontend | `Frontend/.env.example` |
| Backend | `Backend/.env.example` |
| Admin Panel | `admin-panel/.env.example` |
| Streamer | `streamer-node/.env.example` |
| Worker | `worker-node/.env.example` |

Copy the example file to `.env` and fill in real values before deploying.

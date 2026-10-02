# DM Panda — Key Service & Configuration URLs

This document lists the authoritative URLs for production and local development tunnel mode.

---

## 1. Production Service Architecture

| Service / Platform | Production Domain | Purpose |
| :--- | :--- | :--- |
| **Frontend Web App** | `https://dmpanda.com` | User facing dashboard, marketing, onboarding |
| **Admin Control Panel** | `https://admin.dmpanda.com` | Internal administrator operations and telemetry |
| **Backend REST API** | `https://api.dmpanda.com` | Express core API and webhook listeners |
| **Appwrite VPS Endpoint** | `https://appwrite.dmpanda.com/v1` | Database, auth, storage, and serverless functions |
| **Streamer Node** | `https://webhook.dmpanda.com` / `wss://webhook.dmpanda.com/workers` | High-throughput Meta webhook ingestion and worker hub |

---

## 2. Meta / Instagram App Configuration (Production)
**Portal:** [Meta App Dashboard](https://developers.facebook.com/) -> Instagram -> Facebook Login -> Settings

| Setting | URL |
| :--- | :--- |
| **Valid OAuth Redirect URI** | `https://dmpanda.com/auth/ig-callback` |
| **Deauthorize Callback URL** | `https://api.dmpanda.com/api/auth/instagram/deauthorize` |
| **Data Deletion Request URL** | `https://api.dmpanda.com/api/auth/instagram/delete-data` |
| **Privacy Policy URL** | `https://dmpanda.com/privacy` |
| **Terms of Service URL** | `https://dmpanda.com/terms` |
| **Data Deletion Instructions URL** | `https://dmpanda.com/delete-account-guide` |

---

## 3. Local Development Tunnel URLs (Active)

| Service | Active DevTunnel URL |
| :--- | :--- |
| **Frontend (5173)** | `https://k4871fhm-5173.inc1.devtunnels.ms` |
| **Admin Panel (5174)** | `https://k4871fhm-5174.inc1.devtunnels.ms` |
| **Backend API (5000)** | `https://k4871fhm-5000.inc1.devtunnels.ms` |

---

## 4. Coolify Infrastructure & Distributed Workers

| Service / Node | Dashboard / Access URL | Purpose / Notes |
| :--- | :--- | :--- |
| **Coolify Dashboard** | `http://13.233.7.21:8000/` | Coolify management portal where `worker-node` is deployed and running as `worker-2`. Use this URL to access container settings, logs, environment variables, or worker scaling. |


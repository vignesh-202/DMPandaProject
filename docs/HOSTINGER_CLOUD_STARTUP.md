# DM Panda — Hostinger Cloud Startup Deployment Guide

This guide explains how to deploy the entire DM Panda stack (Frontend, Backend, Admin-Panel, Worker, Streamer) on **Hostinger Cloud Startup** using either a **Single-App Unified Root Deployment** (simplest) or a **Multi-App Subdomain Deployment**.

---

## Architecture Overview

DM Panda contains:
1. **Frontend (`Frontend/`)**: React 18 + Vite customer dashboard and marketing site.
2. **Backend API (`Backend/`)**: Express.js REST API with Appwrite integration.
3. **Admin Panel (`admin-panel/`)**: React 19 + Vite admin management console.
4. **Streamer Node (`streamer-node/`)**: Meta webhook receiver and worker coordinator.
5. **Worker Node (`worker-node/`)**: Background automation job execution engine.

---

## Option A: Unified Root Deployment (Recommended)

In this setup, Hostinger Cloud Startup launches **one Node.js application** from the root of the repository. The built-in master server (`server.js`) automatically dispatches traffic based on subdomain or URL path.

### 1. In Hostinger hPanel -> Node.js
- **Repository URL:** Point to your DM Panda GitHub repo
- **Branch:** `main`
- **Node.js version:** `20.x` or `22.x`
- **Application root:** `/` (leave as root directory)
- **Application startup file:** `server.js`
- **Environment:** `production`

### 2. Environment Variables (set in Hostinger hPanel)
```env
PORT=3000
NODE_ENV=production
FRONTEND_ORIGIN=https://dmpanda.com
ADMIN_PANEL_ORIGIN=https://admin.dmpanda.com
BACKEND_PUBLIC_ORIGIN=https://api.dmpanda.com
APPWRITE_ENDPOINT=https://appwrite.dmpanda.com/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key
APPWRITE_DATABASE_ID=698b09ff002b91aff785
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
INSTAGRAM_APP_ID=your_meta_app_id
INSTAGRAM_APP_SECRET=your_meta_app_secret
```

### 3. Build & Start Commands
```bash
# Build both Frontend and Admin Panel:
npm run build-all

# Start the unified server:
npm start
```

### How Traffic is Handled:
- `dmpanda.com` / `app.dmpanda.com` -> Customer Frontend Dashboard & Marketing Site (with high-speed WebP images & Brotli compression)
- `admin.dmpanda.com` or `dmpanda.com/admin` -> Admin Console SPA
- `api.dmpanda.com` or `dmpanda.com/api` -> Backend Express API
- `dmpanda.com/robots.txt` & `dmpanda.com/sitemap.xml` -> Googlebot Indexing endpoints

---

## Option B: Multi-App Subdomain Deployment

If you prefer to assign dedicated Hostinger Cloud Startup applications to individual subdomains:

### 1. Customer Frontend (`app.dmpanda.com`)
- **Root directory:** `Frontend`
- **Build command:** `npm run build`
- **Start command:** `npm start` (runs `Frontend/server.js`)
- **Env Vars:**
  ```env
  PORT=3000
  VITE_API_BASE_URL=https://api.dmpanda.com
  ```

### 2. Admin Panel (`admin.dmpanda.com`)
- **Root directory:** `admin-panel`
- **Build command:** `npm run build`
- **Start command:** `npm start` (runs `admin-panel/server.js`)
- **Env Vars:**
  ```env
  PORT=3000
  VITE_API_BASE_URL=https://api.dmpanda.com
  ```

### 3. Backend API (`api.dmpanda.com`)
- **Root directory:** `Backend`
- **Build command:** *(leave blank)*
- **Start command:** `npm start` (runs `Backend/app.js`)
- **Env Vars:** Full backend database and Meta credentials.

---

## Option C: Hostinger VPS / SSH with PM2

If deploying on Hostinger Cloud VPS or via SSH terminal with PM2:

```bash
# 1. Install all dependencies across all workspaces
npm run install-all

# 2. Build Frontend and Admin Panel
npm run build-all

# 3. Start all services in the background using PM2
pm2 start ecosystem.config.js

# 4. Persist across server reboots
pm2 save
pm2 startup
```

---

## Digital Marketing & Google Indexing Verification

Before launching or after each deploy, run the automated SEO auditor:
```bash
npm run seo:audit
```
To optimize new images to modern WebP:
```bash
npm run optimize:images
```

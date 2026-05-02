# DM Panda

## Project Overview
DM Panda is an Instagram DM automation SaaS platform. It allows users to automate Instagram direct messages, set up reply templates, manage automations, and track analytics.

## Architecture

### Services
- **Frontend** (`Frontend/`) - Customer-facing React/Vite dashboard (port 5000)
- **admin-panel** (`admin-panel/`) - Admin console React/Vite app (port 5001)
- **Backend** (`Backend/`) - Express.js REST API (default port 3000 or 5000 via PORT env)
- **worker-node** (`worker-node/`) - Automation execution worker service
- **streamer-node** (`streamer-node/`) - Meta webhook streamer via WebSockets
- **functions** (`functions/`) - Appwrite serverless functions
- **shared** (`shared/`) - Shared utilities and plan feature config

### Tech Stack
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, React Router, Recharts
- **Backend**: Node.js, Express.js, Appwrite SDK, Razorpay, Instagram Graph API
- **Database/Auth**: Appwrite (self-hosted or cloud)
- **Payments**: Razorpay

## Workflow
- **Start application**: `cd Frontend && npm run dev` → port 5000 (webview)

## Environment Variables

### Backend (required)
- `PORT` - Backend server port (default: 5000, set to 3000 to avoid conflict with frontend)
- `APPWRITE_ENDPOINT` - Appwrite API endpoint URL
- `APPWRITE_PROJECT_ID` - Appwrite project ID
- `APPWRITE_API_KEY` - Appwrite server API key
- `APPWRITE_DATABASE_ID` / `DATABASE_ID` - Appwrite database ID
- `FRONTEND_ORIGIN` - Frontend URL for CORS and redirects
- `ADMIN_PANEL_ORIGIN` - Admin panel URL for CORS
- `INSTAGRAM_APP_ID` - Meta/Instagram App ID
- `INSTAGRAM_APP_SECRET` - Meta/Instagram App Secret
- `INSTAGRAM_REDIRECT_URI` - Instagram OAuth redirect URI
- `RAZORPAY_KEY_ID` - Razorpay public key
- `RAZORPAY_KEY_SECRET` - Razorpay secret key
- `RAZORPAY_WEBHOOK_SECRET` - Razorpay webhook signing secret
- `GOOGLE_SERVICE_ACCOUNT_JSON` - Google OAuth service account JSON

### Frontend (VITE_ prefix)
- `VITE_API_BASE_URL` - Backend API base URL
- `VITE_PUBLIC_SITE_URL` - Public site URL (default: https://dmpanda.com)
- `VITE_RAZORPAY_KEY_ID` - Razorpay public key for frontend

### Admin Panel (VITE_ prefix)
- `VITE_API_BASE_URL` - Backend API base URL

## Key Files
- `Frontend/vite.config.js` - Vite config with host 0.0.0.0, port 5000, allowedHosts: true
- `admin-panel/vite.config.ts` - Vite config with host 0.0.0.0, port 5001, allowedHosts: true
- `Backend/app.js` - Express app entry point with CORS, routes
- `shared/planFeatures.json` - Plan feature definitions
- `docs/appwrite-schema-live.json` - Appwrite database schema

## Deployment
Configured as a **static** deployment:
- Build: `cd Frontend && npm run build`
- Public dir: `Frontend/dist`

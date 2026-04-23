# Project Configuration URLs (Tunnel Mode)

This file contains all the external URLs that must be configured in 3rd-party platforms (Meta, Google, Appwrite) while using VS Code Port Forwarding.

---

## 1. Meta / Instagram Configuration
**Where to use:** [Meta App Dashboard](https://developers.facebook.com/) -> Instagram Options -> Facebook Login -> Settings

| Field Name | URL | Purpose |
| :--- | :--- | :--- |
| **Valid OAuth Redirect URIs** | `https://dfpvdcnb-5173.inc1.devtunnels.ms/auth/ig-callback` | Where Instagram sends the user after successful login to link their account. |
| **Deauthorize Callback URL** | `https://dfpvdcnb-5000.inc1.devtunnels.ms/api/auth/instagram/deauthorize` | Required for security. Instagram pings this if a user uninstalls the app. |
| **Data Deletion Request URL** | `https://dfpvdcnb-5000.inc1.devtunnels.ms/api/auth/instagram/delete-data` | Required for compliance. Pings the backend to initiate user data removal. |

---

## 2. Appwrite Configuration
**Where to use:** [Appwrite Console](https://cloud.appwrite.io/) -> Project -> Settings -> Platforms

| Platform | URL / Hostname | Purpose |
| :--- | :--- | :--- |
| **Web App Hostname** | `dfpvdcnb-5173.inc1.devtunnels.ms` | Allows your frontend tunnel to talk to Appwrite without CORS or Security errors. |

---

## 3. Google OAuth Configuration
**Where to use:** [Google Cloud Console](https://console.cloud.google.com/) -> APIs & Services -> Credentials

| Field Name | URL | Purpose |
| :--- | :--- | :--- |
| **Authorized JavaScript Origins** | `https://dfpvdcnb-5173.inc1.devtunnels.ms` | Allows the frontend to trigger the Google login popup. |
| **Authorized Redirect URIs** | `https://dfpvdcnb-5000.inc1.devtunnels.ms/auth/google/callback` | (If using backend flow) Where Google returns the auth code. |

---

## Why are these separate?
- **Port 5173 (Frontend):** Used for anything that involves a **User Interface** (Redirecting the user to a page).
- **Port 5000 (Backend):** Used for **Server-to-Server** communication (Instagram talking directly to your database).

**Note:** If your VS Code Tunnel URLs change (e.g., you close and reopen the project), you MUST update these URLs in both your `.env` files and the respective portals (Meta, Google, Appwrite).

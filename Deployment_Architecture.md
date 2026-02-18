# DM Panda - Production Deployment Architecture

This document outlines the setup for scaling DM Panda to 1,000+ users using **Coolify** and a two-VPS distribution (**8GB RAM Hub + 2GB RAM Worker**).

## 🟢 VPS 1: The Core Hub (2 Core, 8GB RAM)
**Role:** Main API, Database (Appwrite), and Dashboard Hub.

### 1. Installation
1.  Install **Coolify** on VPS 1.
2.  Deploy **Appwrite** via Coolify. 
    *   **RAM Optimization:** Since this VPS also runs your Backend API, monitor Appwrite's Redis and MariaDB usage.
3.  Deploy **Frontend** (Static) and **Backend** (API) here.

### 2. Configuration (Port Mapping)
*   **Domain:** `app.dmpanda.com` (Frontend)
*   **Domain:** `api.dmpanda.com` (Backend)
*   **Domain:** `db.dmpanda.com` (Appwrite Dashboard)

| Component | Type | Coolify Target | Notes |
| :--- | :--- | :--- | :--- |
| **Frontend** | Application | `/Frontend` | Build: `npm run build`, Serve: `dist` |
| **Backend** | Application | `/Backend` | Command: `gunicorn --worker-class gevent --workers 4 app:app` |
| **Appwrite** | Service | Official Template | Use external volumes for DB persistence |

---

## 🔵 VPS 2: The Worker Node (1 Core, 2GB RAM)
**Role:** Dedicated Instagram Automation Engine.

### 1. Configuration (Lean Mode)
Because this VPS has only 2GB RAM:
1.  **Strictly Worker Only:** Do NOT install Coolify's manager on this VPS. Instead, add it as a **"Server"** in your VPS 1 Coolify dashboard.
2.  **External DB:** The Worker must connect to the Appwrite instance on VPS 1.
3.  **Process Management:** Use only **one** worker process with many threads/tasks rather than multiple processes.

### 2. Deploying the Worker
1.  Create a new **Application** in Coolify.
2.  **Destination:** Select **VPS 2**.
3.  **Start Command:** `python main_worker.py` (Ensure you have a `requirements.txt` in the root).
4.  **Environment Variables:** Must include `APPWRITE_ENDPOINT` pointing to VPS 1 (`https://api.dmpanda.com/v1`).

---

## 🚀 Optimization for 1,000 Users

### 1. Database Indexing (CRITICAL)
Ensure the following indexes are created in your Appwrite Collections:
*   **Automations:** `user_id` (Index), `ig_user_id` (Index), `is_active` (Index).
*   **Profiles:** `user_id` (Unique Index).
*   **Logs:** `ig_user_id` (Index), `timestamp` (Index).

### 2. Memory Management (The Survival Setup)
To prevent VPS instances from crashing, especially the 2GB worker:
1.  **SWAP File:** Create a 4GB SWAP file on both VPS instances. **This is critical for VPS 2.**
    ```bash
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    ```
2.  **Health Checks:** Set Coolify to restart the Backend/Worker if memory usage exceeds 90%.

### 3. Networking
If possible, use **Private Networking** (VPC) between VPS 1 and VPS 2. This makes the Worker -> Appwrite communication 2x faster and more secure than using public URLs.

---

## 🛠 Required Environment Variables (Coolify Secret Management)
| Key | Value |
| :--- | :--- |
| `APPWRITE_ENDPOINT` | `https://db.dmpanda.com/v1` |
| `APPWRITE_PROJECT_ID` | `dmpanda-prod` |
| `APPWRITE_API_KEY` | `your_secret_key` |
| `INSTAGRAM_CLIENT_ID` | `...` |
| `INSTAGRAM_CLIENT_SECRET` | `...` |

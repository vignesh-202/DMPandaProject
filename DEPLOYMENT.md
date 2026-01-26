# Simple Deployment Guide

This guide explains how to set up automated deployments for your Web App (Coolify) and Mobile App (Expo).

---

## Part 1: Web App (Coolify)
**Goal:** Automatically deploy your Website and Backend when you push to GitHub.
**Note:** You do **NOT** need GitHub Actions for this. Coolify handles it automatically.

### 1. Setup in Coolify
You will create **two applications** in Coolify pointing to your **same** GitHub repository.

#### A. Backend (Python)
1.  **Source:** Your GitHub Repo.
2.  **Build Pack:** Nixpacks.
3.  **Base Directory:** `/Backend`.
4.  **Port:** `5000`.
5.  **Start Command:** `python app.py`.
6.  **Auto-Deploy:** Enabled (Webhook).

#### B. Frontend (React)
1.  **Source:** Your GitHub Repo.
2.  **Build Pack:** Nixpacks.
3.  **Base Directory:** `/Frontend`.
4.  **Port:** `80`.
5.  **Environment Variable:** Set `VITE_API_URL` to your live Backend URL.
6.  **Auto-Deploy:** Enabled (Webhook).

### How it Updates
*   Simply **push code** to your `main` branch.
*   Coolify detects the change, pulls the code, builds it, and restarts your site automatically.

---

## Part 2: Mobile App (Expo)
**Goal:** Automatically update the app on users' phones (OTA) when you push code.

### 1. The Strategy: Separate Repository (Recommended)
You mentioned creating a strictly separate GitHub repository for your `MobileApp` folder. This is cleaner and makes automation easier.

### 2. Migration Steps
1.  Create a **new empty repository** on GitHub (e.g., `DMPanda-Mobile`).
2.  Move **only** the contents of your `MobileApp` folder into this new repo.
3.  **Important:** The `package.json` should be at the *root* of this new repo.

### 3. AUTOMATION SETUP (The Important Adjustment)
Because the mobile app is now in its own repo, we must simplify the GitHub Action workflow file.

**Create this file in your NEW mobile repo:** `.github/workflows/update.yml`

```yaml
name: Mobile OTA Update

on:
  push:
    branches:
      - main

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Check Token
        run: |
          if [ -z "${{ secrets.EXPO_TOKEN }}" ]; then
            echo "Error: Add EXPO_TOKEN to GitHub Secrets"
            exit 1
          fi

      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 18.x
          cache: npm

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install Deps
        run: npm ci

      # COMMAND CHANGED: No longer needs "working-directory: ./MobileApp"
      - name: Publish Update
        run: eas update --auto
```

### 4. How it Updates (The Data Flow)
**Journey: GitHub -> Expo Servers -> User Mobile**

1.  **Push to GitHub:** You push code to the `main` branch -> **github triggers the Action**.
2.  **Upload to Cloud:** The GitHub Action builds your update and uploads it to **Expo's Cloud Servers**.
3.  **User Opens App:** The next time a user opens the app on their phone, it checks with Expo: *"Is there a new version?"*
4.  **Download:** If yes, the app downloads the new version in the background and applies it.

*   **Store Builds:** Create a GitHub Release/Tag (e.g., `v1.0.0`) to trigger a full native build (APK/IPA) for the App Store.

---

## Checklist
1.  [ ] **Web:** Add Coolify Webhooks (usually automatic) to your main repo.
2.  [ ] **Mobile:** Move code to new repo.
3.  [ ] **Mobile:** Add `EXPO_TOKEN` to the **new** repo's GitHub Secrets.

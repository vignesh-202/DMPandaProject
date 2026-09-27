#!/bin/bash
# ============================================================
# Hostinger Cloud Startup - DMPanda Build & Deploy Script
# Run this on your Hostinger Cloud server or via Git Webhook
# ============================================================

set -e

echo "🚀 Starting DMPanda Deployment on Hostinger..."

# 1. Pull latest code from GitHub
echo "📥 Pulling latest code from main branch..."
git pull origin main

# 2. Build Frontend
echo "📦 Building Frontend (Vite SPA)..."
cd Frontend
npm install --frozen-lockfile || npm install
npm run build
cd ..

# 3. Build Admin Panel
echo "📦 Building Admin Panel (Vite SPA)..."
cd admin-panel
npm install --frozen-lockfile || npm install
npm run build
cd ..

# 4. Sync Frontend dist to main public_html (e.g. /home/u123456789/domains/dmpanda.com/public_html)
# Adjust destination paths to match your Hostinger domain structure:
FRONTEND_TARGET="$HOME/public_html"
ADMIN_TARGET="$HOME/domains/admin.dmpanda.com/public_html"

if [ -d "$FRONTEND_TARGET" ]; then
    echo "🌐 Deploying Frontend to $FRONTEND_TARGET..."
    cp -r Frontend/dist/* "$FRONTEND_TARGET/"
    cp Frontend/dist/.htaccess "$FRONTEND_TARGET/" 2>/dev/null || true
fi

if [ -d "$ADMIN_TARGET" ]; then
    echo "🛡️ Deploying Admin Panel to $ADMIN_TARGET..."
    cp -r admin-panel/dist/* "$ADMIN_TARGET/"
    cp admin-panel/dist/.htaccess "$ADMIN_TARGET/" 2>/dev/null || true
fi

echo "✅ DMPanda deployment completed successfully!"

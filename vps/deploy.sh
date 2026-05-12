#!/bin/bash
# ============================================================
#  AutoForward — Quick Redeploy
#  Called automatically by GitHub Actions on push to main.
#  Can also be run manually: bash /var/www/autoforward/vps/deploy.sh
# ============================================================
set -e

APP_DIR="/var/www/autoforward"
cd $APP_DIR

echo ""
echo "[Deploy] Pulling latest from GitHub..."
git pull origin main

echo "[Deploy] Installing/updating dependencies..."
npm install --legacy-peer-deps

echo "[Deploy] Restarting app..."
pm2 restart autoforward --update-env

echo ""
echo "[Deploy] Status:"
pm2 status autoforward

echo ""
echo "✓ Deployed → https://autoforwardmessage.online"

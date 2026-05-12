#!/bin/bash
# Quick re-deploy script — run this whenever you update the app
# Usage: bash /var/www/autoforward/vps/deploy.sh

APP_DIR="/var/www/autoforward"
cd $APP_DIR

echo "[Deploy] Pulling latest code..."
# git pull origin main    # uncomment if using git

echo "[Deploy] Installing dependencies..."
npm install --production=false

echo "[Deploy] Restarting app..."
pm2 restart autoforward

echo "[Deploy] Status:"
pm2 status autoforward

echo "[Deploy] Done! https://autoforwardmessage.online"

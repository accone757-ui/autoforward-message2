#!/bin/bash
# AutoForward VPS Setup Script
# Run as root on Ubuntu/Debian (Singapore VPS)
# Usage: bash setup.sh

set -e

APP_DIR="/var/www/autoforward"
DOMAIN="autoforwardmessage.online"
APP_PORT=3000
NODE_VERSION=20

echo "======================================"
echo " AutoForward VPS Setup"
echo " Domain: $DOMAIN"
echo "======================================"

# ── 1. System update ──────────────────────────────────────────────────────────
echo "[1/8] Updating system packages..."
apt update -y && apt upgrade -y
apt install -y curl git nginx certbot python3-certbot-nginx ufw

# ── 2. Node.js 20 ─────────────────────────────────────────────────────────────
echo "[2/8] Installing Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt install -y nodejs
node -v && npm -v

# ── 3. PM2 ────────────────────────────────────────────────────────────────────
echo "[3/8] Installing PM2..."
npm install -g pm2

# ── 4. Clone / copy app ───────────────────────────────────────────────────────
echo "[4/8] Setting up application directory..."
mkdir -p $APP_DIR
# If deploying via git, uncomment below and set your repo URL:
# git clone https://github.com/YOUR_USERNAME/autoforward.git $APP_DIR
# For now, assumes you've already copied files to $APP_DIR via scp/rsync

cd $APP_DIR

# ── 5. Install dependencies ───────────────────────────────────────────────────
echo "[5/8] Installing npm dependencies..."
npm install --production=false

# ── 6. Environment variables ──────────────────────────────────────────────────
echo "[6/8] Writing environment file..."
cat > $APP_DIR/.env.production << 'ENVEOF'
SUPABASE_URL=https://vdkbetuwgozvbkzelmur.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZka2JldHV3Z296dmJremVsbXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTA2OTAsImV4cCI6MjA5NDA4NjY5MH0.rUhVcEKEjANp6VdMBiVLDdhU_L7V0Pu9Oqj8oRLgGfo
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZka2JldHV3Z296dmJremVsbXVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUxMDY5MCwiZXhwIjoyMDk0MDg2NjkwfQ.JGq_JII1T8LpKzYkzboahml89ygYx9U0v6K8sxW_mfA
NODE_ENV=production
PORT=3000
ENVEOF

# ── 7. PM2 ecosystem config ───────────────────────────────────────────────────
echo "[7/8] Configuring PM2..."
cat > $APP_DIR/ecosystem.config.cjs << 'PM2EOF'
module.exports = {
  apps: [{
    name: "autoforward",
    script: "npm",
    args: "run dev -- --port 3000 --host 0.0.0.0",
    cwd: "/var/www/autoforward",
    env_file: "/var/www/autoforward/.env.production",
    restart_delay: 3000,
    max_restarts: 10,
    watch: false,
    error_file: "/var/log/autoforward/err.log",
    out_file:   "/var/log/autoforward/out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss"
  }]
}
PM2EOF

mkdir -p /var/log/autoforward

# Start with PM2
pm2 start $APP_DIR/ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root | bash

echo "[8/8] PM2 started. App running on port $APP_PORT"
pm2 status

echo ""
echo "======================================"
echo " Next: run nginx_setup.sh then ssl_setup.sh"
echo "======================================"

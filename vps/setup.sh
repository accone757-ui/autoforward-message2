#!/bin/bash
# ============================================================
#  AutoForward — Full VPS Setup (Ubuntu 20.04 / 22.04)
#  Domain : autoforwardmessage.online
#  VPS IP : 103.3.63.46
#  SSL    : Cloudflare proxy handles HTTPS (no certbot needed)
#
#  Run as root:
#    bash <(curl -sSL https://raw.githubusercontent.com/accone757-ui/autoforward-message2/main/vps/setup.sh)
# ============================================================
set -e

REPO="https://accone757-ui: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@github.com/accone757-ui/autoforward-message2.git"
APP_DIR="/var/www/autoforward"
LOG_DIR="/var/log/autoforward"
NODE_VERSION=20

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   AutoForward VPS Setup                  ║"
echo "║   autoforwardmessage.online              ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. System packages ────────────────────────────────────────
echo "[1/7] Installing system packages..."
apt-get update -y
apt-get install -y curl git nginx ufw

# ── 2. Node.js 20 ─────────────────────────────────────────────
echo "[2/7] Installing Node.js $NODE_VERSION..."
if ! command -v node &>/dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt $NODE_VERSION ]]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
fi
echo "Node: $(node -v)  NPM: $(npm -v)"

# ── 3. PM2 ────────────────────────────────────────────────────
echo "[3/7] Installing PM2..."
npm install -g pm2 2>/dev/null
echo "PM2: $(pm2 -v)"

# ── 4. Clone / update repo ────────────────────────────────────
echo "[4/7] Cloning repository..."
if [ -d "$APP_DIR/.git" ]; then
  echo "  → Repo exists, pulling latest..."
  cd $APP_DIR
  git pull origin main
else
  rm -rf $APP_DIR
  git clone "$REPO" "$APP_DIR"
  cd $APP_DIR
fi

# ── 5. Environment & dependencies ────────────────────────────
echo "[5/7] Installing npm dependencies..."
npm install --legacy-peer-deps

echo "  → Writing .env..."
cat > $APP_DIR/.env << 'ENVEOF'
SUPABASE_URL=https://vdkbetuwgozvbkzelmur.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZka2JldHV3Z296dmJremVsbXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTA2OTAsImV4cCI6MjA5NDA4NjY5MH0.rUhVcEKEjANp6VdMBiVLDdhU_L7V0Pu9Oqj8oRLgGfo
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZka2JldHV3Z296dmJremVsbXVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUxMDY5MCwiZXhwIjoyMDk0MDg2NjkwfQ.JGq_JII1T8LpKzYkzboahml89ygYx9U0v6K8sxW_mfA
NODE_ENV=production
PORT=3000
ENVEOF

# ── 6. PM2 + Nginx ────────────────────────────────────────────
echo "[6/7] Configuring PM2 process..."
mkdir -p $LOG_DIR

cat > $APP_DIR/ecosystem.config.cjs << 'PM2EOF'
module.exports = {
  apps: [{
    name: "autoforward",
    script: "npm",
    args: "run dev -- --port 3000 --host 127.0.0.1",
    cwd: "/var/www/autoforward",
    env_file: "/var/www/autoforward/.env",
    restart_delay: 5000,
    max_restarts: 15,
    watch: false,
    error_file: "/var/log/autoforward/err.log",
    out_file:   "/var/log/autoforward/out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    env: {
      NODE_ENV: "production",
      PORT: "3000"
    }
  }]
}
PM2EOF

# Stop old instance if running
pm2 delete autoforward 2>/dev/null || true

# Start fresh
pm2 start $APP_DIR/ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash || true

echo "[6/7] App started with PM2. Waiting 5s for port 3000..."
sleep 5
curl -s -o /dev/null -w "  → Port 3000 status: %{http_code}\n" http://127.0.0.1:3000 || echo "  → App still starting (check: pm2 logs autoforward)"

# ── 7. Nginx ──────────────────────────────────────────────────
echo "[7/7] Configuring Nginx..."
cp $APP_DIR/vps/nginx.conf /etc/nginx/sites-available/autoforward
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/autoforward /etc/nginx/sites-enabled/autoforward

nginx -t
systemctl enable nginx
systemctl restart nginx

# Firewall
ufw allow OpenSSH   2>/dev/null || true
ufw allow 'Nginx HTTP' 2>/dev/null || true
ufw --force enable  2>/dev/null || true

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✓ Setup Complete!                       ║"
echo "║                                          ║"
echo "║  App  → http://127.0.0.1:3000            ║"
echo "║  Web  → https://autoforwardmessage.online║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Useful commands:"
echo "  pm2 logs autoforward     — view live logs"
echo "  pm2 status               — check process status"
echo "  bash $APP_DIR/vps/deploy.sh  — redeploy after update"
echo ""

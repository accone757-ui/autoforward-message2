#!/bin/bash
# ============================================================
#  AutoForward — Full VPS Setup (Ubuntu 20.04 / 22.04)
#  Domain : autoforwardmessage.online
#  SSL    : Cloudflare proxy handles HTTPS
#
#  Run as root on new VPS:
#    bash <(curl -sSL https://raw.githubusercontent.com/accone757-ui/autoforward-message2/main/vps/setup.sh)
#
#  Required env vars (or will prompt):
#    GITHUB_PAT            — GitHub personal access token
#    TELEGRAM_BOT_TOKEN    — Telegram bot token
#    SUPABASE_URL          — Supabase project URL
#    SUPABASE_ANON_KEY     — Supabase anon key
#    SUPABASE_SERVICE_ROLE_KEY — Supabase service role key
#    CF_TOKEN              — Cloudflare API token (for DNS update)
#    CF_ZONE_ID            — Cloudflare Zone ID
# ============================================================
set -e

APP_DIR="/var/www/autoforward"
LOG_DIR="/var/log/autoforward"
NODE_VERSION=20
DOMAIN="autoforwardmessage.online"
CF_TOKEN="${CF_TOKEN:-}"
CF_ZONE_ID="${CF_ZONE_ID:-1c2ab2e767b6a13619588c27ceffdccc}"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   AutoForward VPS Setup                  ║"
echo "║   $DOMAIN              ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Prompt for missing secrets ────────────────────────────────
if [ -z "$GITHUB_PAT" ]; then
  read -rsp "Enter GitHub PAT: " GITHUB_PAT; echo
fi
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  read -rsp "Enter Telegram Bot Token: " TELEGRAM_BOT_TOKEN; echo
fi
if [ -z "$SUPABASE_URL" ]; then
  SUPABASE_URL="https://vdkbetuwgozvbkzelmur.supabase.co"
fi
if [ -z "$SUPABASE_ANON_KEY" ]; then
  read -rsp "Enter Supabase Anon Key: " SUPABASE_ANON_KEY; echo
fi
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  read -rsp "Enter Supabase Service Role Key: " SUPABASE_SERVICE_ROLE_KEY; echo
fi

REPO="https://accone757-ui:${GITHUB_PAT}@github.com/accone757-ui/autoforward-message2.git"

# ── 0. Cloudflare DNS update (if token provided) ──────────────
if [ -n "$CF_TOKEN" ]; then
  echo "[0/7] Updating Cloudflare DNS to current VPS IP..."
  CURRENT_IP=$(curl -s https://api.ipify.org)
  echo "  → Current IP: $CURRENT_IP"

  # Get existing A record ID
  DNS_RECORDS=$(curl -s -X GET \
    "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records?type=A&name=${DOMAIN}" \
    -H "Authorization: Bearer ${CF_TOKEN}" \
    -H "Content-Type: application/json")

  RECORD_ID=$(echo "$DNS_RECORDS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -n "$RECORD_ID" ]; then
    # Update existing record
    curl -s -X PATCH \
      "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${RECORD_ID}" \
      -H "Authorization: Bearer ${CF_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "{\"content\":\"${CURRENT_IP}\",\"proxied\":true}" \
      | grep -o '"success":[^,}]*' | head -1
    echo "  → DNS A record updated: $DOMAIN → $CURRENT_IP"
  else
    # Create new A record
    curl -s -X POST \
      "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records" \
      -H "Authorization: Bearer ${CF_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "{\"type\":\"A\",\"name\":\"${DOMAIN}\",\"content\":\"${CURRENT_IP}\",\"proxied\":true,\"ttl\":1}" \
      | grep -o '"success":[^,}]*' | head -1
    echo "  → DNS A record created: $DOMAIN → $CURRENT_IP"
  fi
fi

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
echo "  → Node: $(node -v)  NPM: $(npm -v)"

# ── 3. PM2 ────────────────────────────────────────────────────
echo "[3/7] Installing PM2..."
npm install -g pm2 2>/dev/null
echo "  → PM2: $(pm2 -v)"

# ── 4. Clone / update repo ────────────────────────────────────
echo "[4/7] Cloning repository..."
if [ -d "$APP_DIR/.git" ]; then
  echo "  → Repo exists, pulling latest..."
  cd $APP_DIR
  git remote set-url origin "$REPO"
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
cat > $APP_DIR/.env << ENVEOF
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
NODE_ENV=production
PORT=3000
ENVEOF
chmod 600 $APP_DIR/.env
echo "  → .env written"

# ── 6. PM2 ────────────────────────────────────────────────────
echo "[6/7] Configuring PM2..."
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

pm2 delete autoforward 2>/dev/null || true
pm2 start $APP_DIR/ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash || true

echo "  → Waiting 5s for app to start..."
sleep 5
curl -s -o /dev/null -w "  → Port 3000 status: %{http_code}\n" http://127.0.0.1:3000 || echo "  → App still starting (pm2 logs autoforward)"

# ── 7. Nginx ──────────────────────────────────────────────────
echo "[7/7] Configuring Nginx..."
cp $APP_DIR/vps/nginx.conf /etc/nginx/sites-available/autoforward
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/autoforward /etc/nginx/sites-enabled/autoforward

nginx -t
systemctl enable nginx
systemctl restart nginx

ufw allow OpenSSH   2>/dev/null || true
ufw allow 'Nginx HTTP' 2>/dev/null || true
ufw --force enable  2>/dev/null || true

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✓ Setup Complete!                       ║"
echo "║                                          ║"
echo "║  App  → http://127.0.0.1:3000            ║"
echo "║  Web  → https://$DOMAIN║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Useful commands:"
echo "  pm2 logs autoforward        — view live logs"
echo "  pm2 status                  — check process status"
echo "  bash $APP_DIR/vps/deploy.sh — redeploy after update"
echo "  bash $APP_DIR/vps/change-vps.sh — migrate to new VPS IP"
echo ""

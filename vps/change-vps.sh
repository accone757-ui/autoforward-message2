#!/bin/bash
# ============================================================
#  AutoForward — New VPS Migration Script
#  Run this on a FRESH VPS to:
#  1. Update Cloudflare DNS to new VPS IP automatically
#  2. Install everything and start the app
#
#  One command setup on new VPS:
#    export CF_TOKEN="cfat_..." GITHUB_PAT="ghp_..." \
#           TELEGRAM_BOT_TOKEN="..." \
#           SUPABASE_ANON_KEY="..." SUPABASE_SERVICE_ROLE_KEY="..."
#    bash <(curl -sSL https://raw.githubusercontent.com/accone757-ui/autoforward-message2/main/vps/change-vps.sh)
# ============================================================
set -e

CF_TOKEN="${CF_TOKEN:-}"
CF_ZONE_ID="${CF_ZONE_ID:-1c2ab2e767b6a13619588c27ceffdccc}"
DOMAIN="autoforwardmessage.online"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   AutoForward — New VPS Migration        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Prompt for Cloudflare token if not set ────────────────────
if [ -z "$CF_TOKEN" ]; then
  read -rsp "Enter Cloudflare API Token: " CF_TOKEN; echo
fi

# ── Get current public IP ─────────────────────────────────────
CURRENT_IP=$(curl -s https://api.ipify.org)
if [ -z "$CURRENT_IP" ]; then
  CURRENT_IP=$(curl -s https://ifconfig.me)
fi
echo "→ New VPS IP: $CURRENT_IP"

# ── Update Cloudflare DNS ─────────────────────────────────────
echo "→ Updating Cloudflare DNS: $DOMAIN → $CURRENT_IP"

DNS_RECORDS=$(curl -s -X GET \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records?type=A&name=${DOMAIN}" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json")

RECORD_ID=$(echo "$DNS_RECORDS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$RECORD_ID" ]; then
  RESULT=$(curl -s -X PATCH \
    "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${RECORD_ID}" \
    -H "Authorization: Bearer ${CF_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"content\":\"${CURRENT_IP}\",\"proxied\":true}")
  echo "  ✓ DNS updated: $DOMAIN → $CURRENT_IP"
else
  RESULT=$(curl -s -X POST \
    "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records" \
    -H "Authorization: Bearer ${CF_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"A\",\"name\":\"${DOMAIN}\",\"content\":\"${CURRENT_IP}\",\"proxied\":true,\"ttl\":1}")
  echo "  ✓ DNS created: $DOMAIN → $CURRENT_IP"
fi

# Also update www subdomain
DNS_WWW=$(curl -s -X GET \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records?type=A&name=www.${DOMAIN}" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json")
WWW_ID=$(echo "$DNS_WWW" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$WWW_ID" ]; then
  curl -s -X PATCH \
    "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${WWW_ID}" \
    -H "Authorization: Bearer ${CF_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"content\":\"${CURRENT_IP}\",\"proxied\":true}" > /dev/null
  echo "  ✓ DNS updated: www.$DOMAIN → $CURRENT_IP"
fi

echo ""
echo "→ DNS propagation may take a few minutes via Cloudflare."
echo "→ Running full setup now..."
echo ""

# ── Run main setup ────────────────────────────────────────────
export CF_TOKEN CF_ZONE_ID
bash <(curl -sSL https://raw.githubusercontent.com/accone757-ui/autoforward-message2/main/vps/setup.sh)

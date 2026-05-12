#!/bin/bash
# SSL (Let's Encrypt) setup for autoforwardmessage.online
# Run after nginx_setup.sh AND after DNS A record is pointing to this VPS

DOMAIN="autoforwardmessage.online"
EMAIL="admin@autoforwardmessage.online"   # change to your real email

echo "[SSL] Getting Let's Encrypt certificate for $DOMAIN..."
certbot --nginx \
  -d $DOMAIN \
  -d www.$DOMAIN \
  --non-interactive \
  --agree-tos \
  --email $EMAIL \
  --redirect

echo "[SSL] Setting up auto-renewal..."
systemctl enable certbot.timer
systemctl start certbot.timer

echo "[SSL] Done! Site is now live at https://$DOMAIN"
echo ""
echo "Test: curl -I https://$DOMAIN"
curl -I https://$DOMAIN 2>/dev/null | head -5

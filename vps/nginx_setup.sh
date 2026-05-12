#!/bin/bash
# Nginx-only setup (if running separately from setup.sh)
APP_DIR="/var/www/autoforward"

cp $APP_DIR/vps/nginx.conf /etc/nginx/sites-available/autoforward
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/autoforward /etc/nginx/sites-enabled/autoforward

nginx -t && systemctl reload nginx

ufw allow OpenSSH
ufw allow 'Nginx HTTP'
ufw --force enable
ufw status

echo "✓ Nginx configured for autoforwardmessage.online (Cloudflare proxy mode)"

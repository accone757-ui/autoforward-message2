#!/bin/bash
# Nginx setup for autoforwardmessage.online
# Run after setup.sh

DOMAIN="autoforwardmessage.online"

echo "[Nginx] Installing site config..."
cp /var/www/autoforward/vps/nginx.conf /etc/nginx/sites-available/autoforward

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Enable our site
ln -sf /etc/nginx/sites-available/autoforward /etc/nginx/sites-enabled/autoforward

# Test config
nginx -t

# Reload
systemctl reload nginx
echo "[Nginx] Done. Site enabled for $DOMAIN"

# Firewall
echo "[UFW] Setting firewall rules..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status

echo ""
echo "=== Now run: bash /var/www/autoforward/vps/ssl_setup.sh ==="

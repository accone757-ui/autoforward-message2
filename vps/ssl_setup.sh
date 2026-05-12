#!/bin/bash
# ============================================================
#  SSL Note — autoforwardmessage.online uses Cloudflare Proxy
# ============================================================
#
#  Your domain is routed through Cloudflare (orange cloud).
#  Cloudflare provides HTTPS automatically — no certbot needed.
#
#  Cloudflare SSL settings (recommended):
#    Dashboard → SSL/TLS → Overview → set to "Flexible" or "Full"
#
#  "Flexible"  — Cloudflare ↔ VPS over HTTP (simplest, already works)
#  "Full"      — Cloudflare ↔ VPS over HTTPS (requires a self-signed cert on VPS)
#
#  To check SSL is working:
#    curl -I https://autoforwardmessage.online
#
echo "Cloudflare handles SSL for autoforwardmessage.online."
echo "No certbot setup required."
echo ""
echo "Check your Cloudflare dashboard → SSL/TLS → set to 'Flexible' or 'Full'."

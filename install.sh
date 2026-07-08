#!/usr/bin/env bash
# Разворачивает grafik.one (статика + Supabase) на этом сервере.
# Запуск:  sudo bash install.sh
set -uo pipefail

DOMAIN=grafik.one
WWW=/var/www/$DOMAIN
SRC="$(cd "$(dirname "$0")" && pwd)"
EMAIL=info.lumaflow@gmail.com

echo ">>> [1/6] Ставлю nginx + certbot..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx >/dev/null
echo "    ок"

echo ">>> [2/6] Копирую файлы сайта в $WWW..."
mkdir -p "$WWW/vendor"
cp "$SRC/index.html" "$SRC/app.js" "$SRC/store.js" "$SRC/styles.css" "$SRC/config.example.js" "$WWW/"
cp "$SRC/vendor/supabase.js" "$WWW/vendor/"
echo "    ок"

echo ">>> [3/6] Пишу config.js (publishable-ключ Supabase)..."
cat > "$WWW/config.js" <<'EOF'
window.APP_CONFIG = {
  SUPABASE_URL: 'https://jytkpulopcqtmktygejs.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_9u-M2UXBrlDHriT93w7cSw_KGPgRWqq',
};
EOF
chown -R www-data:www-data "$WWW"
echo "    ок"

echo ">>> [4/6] Настраиваю nginx..."
cat > /etc/nginx/sites-available/$DOMAIN <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name grafik.one www.grafik.one;
    root /var/www/grafik.one;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location = /config.js { add_header Cache-Control "no-store, must-revalidate"; }
    add_header X-Robots-Tag "noindex, nofollow" always;
    access_log /var/log/nginx/grafik.access.log;
    error_log  /var/log/nginx/grafik.error.log;
}
NGINX
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
rm -f /etc/nginx/sites-enabled/default
if nginx -t 2>/dev/null; then systemctl reload nginx; echo "    ок"; else echo "    !! ошибка конфига nginx"; nginx -t; fi

IP=$(curl -s --max-time 8 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
echo ">>> [5/6] HTTP поднят. Сайт уже открывается: http://$IP"

echo ">>> [6/6] Пробую HTTPS (сработает, только если DNS grafik.one уже указывает на этот сервер)..."
if certbot --nginx -d grafik.one -d www.grafik.one --non-interactive --agree-tos -m "$EMAIL" --redirect >/tmp/certbot.log 2>&1; then
  echo "    HTTPS готов -> https://grafik.one"
else
  echo "    HTTPS пока пропущен (DNS ещё не указывает сюда — это нормально)."
  echo "    Когда A-запись grafik.one -> $IP заработает, выполни:"
  echo "      certbot --nginx -d grafik.one -d www.grafik.one --agree-tos -m $EMAIL --redirect"
fi

echo ""
echo "=========================================================="
echo ">>> ГОТОВО."
echo ">>> Проверь сейчас:  http://$IP"
echo ">>> После DNS:       http://grafik.one  ->  https://grafik.one"
echo "=========================================================="

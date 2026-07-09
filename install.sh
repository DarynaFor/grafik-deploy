#!/usr/bin/env bash
# grafik.one — разворачивание сайта (статика + Supabase) + авто-обновление с GitHub.
# Запуск через веб-консоль:  bash install.sh
set -uo pipefail

DOMAIN=grafik.one
WWW=/var/www/$DOMAIN
REPO=/opt/grafik-deploy
EMAIL=daryna.fornalska@gmail.com
PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIC8xdRZiDwCqgxPZeGVFL1G2VKNTQFacGpFmQ+7nr8EQ grafik-deploy'

echo ">>> [1/8] Ставлю nginx + certbot + git..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx git >/dev/null
echo "    ок"

echo ">>> [2/8] Убираю блокировщик SSH (denyhosts) и ставлю ключ доступа..."
systemctl stop denyhosts sshguard crowdsec 2>/dev/null
systemctl disable denyhosts sshguard 2>/dev/null
apt-get purge -y denyhosts >/dev/null 2>&1
rm -rf /var/lib/denyhosts
: > /etc/hosts.deny
iptables -F 2>/dev/null; iptables -P INPUT ACCEPT 2>/dev/null
mkdir -p /root/.ssh && chmod 700 /root/.ssh
grep -qF "$PUBKEY" /root/.ssh/authorized_keys 2>/dev/null || echo "$PUBKEY" >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
echo "    ок"

echo ">>> [3/8] Клонирую репозиторий в $REPO (для авто-обновлений)..."
rm -rf "$REPO"
git clone -q https://github.com/DarynaFor/grafik-deploy.git "$REPO"
echo "    ок"

echo ">>> [4/8] Копирую файлы сайта в $WWW..."
mkdir -p "$WWW/vendor"
for f in index.html app.js store.js styles.css; do cp -f "$REPO/$f" "$WWW/$f"; done
cp -f "$REPO/vendor/supabase.js" "$WWW/vendor/"
echo "    ок"

echo ">>> [5/8] config.js (publishable-ключ Supabase)..."
cat > "$WWW/config.js" <<'EOF'
window.APP_CONFIG = {
  SUPABASE_URL: 'https://jytkpulopcqtmktygejs.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_9u-M2UXBrlDHriT93w7cSw_KGPgRWqq',
};
EOF
chown -R www-data:www-data "$WWW"
echo "    ок"

echo ">>> [6/8] Настраиваю nginx..."
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
nginx -t 2>/dev/null && systemctl reload nginx && echo "    ок"

echo ">>> [7/8] Авто-обновление (cron каждые 3 мин тянет свежий код с GitHub)..."
cat > /etc/cron.d/grafik-update <<'CRON'
*/3 * * * * root bash /opt/grafik-deploy/update.sh >> /var/log/grafik-update.log 2>&1
CRON
chmod 644 /etc/cron.d/grafik-update
echo "    ок — сайт теперь сам подтягивает изменения"

IP=$(curl -s --max-time 8 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
echo ">>> [8/8] Пробую HTTPS (сработает, если DNS grafik.one уже указывает сюда)..."
if certbot --nginx -d grafik.one -d www.grafik.one --non-interactive --agree-tos -m "$EMAIL" --redirect >/tmp/certbot.log 2>&1; then
  echo "    HTTPS готов -> https://grafik.one"
else
  echo "    HTTPS пока пропущен (DNS ещё не указывает сюда) — поднимем позже, это нормально."
fi

echo ""
echo "=========================================================="
echo ">>> ГОТОВО."
echo ">>> Проверь сейчас в браузере:  http://$IP"
echo ">>> Обновления кода теперь автоматические (~3 мин с GitHub)."
echo "=========================================================="

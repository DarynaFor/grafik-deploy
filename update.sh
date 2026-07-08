#!/usr/bin/env bash
# Тянет свежую версию сайта с GitHub. Вызывается по cron каждые 3 минуты.
# config.js (ключи) НЕ трогает — он живёт только на сервере.
set -uo pipefail
REPO=/opt/grafik-deploy
WWW=/var/www/grafik.one

cd "$REPO" || exit 0
BEFORE=$(git rev-parse HEAD 2>/dev/null)
git pull -q origin main 2>/dev/null
AFTER=$(git rev-parse HEAD 2>/dev/null)
[ "$BEFORE" = "$AFTER" ] && exit 0   # изменений нет — выходим тихо

for f in index.html app.js store.js styles.css; do
  cp -f "$REPO/$f" "$WWW/$f" 2>/dev/null
done
cp -f "$REPO/vendor/supabase.js" "$WWW/vendor/supabase.js" 2>/dev/null
chown -R www-data:www-data "$WWW"
echo "$(date '+%F %T') updated $BEFORE -> $AFTER"

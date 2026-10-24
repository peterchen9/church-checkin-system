#!/bin/bash
set -euo pipefail
test "$(id -u)" = 0 || { echo 'Run with sudo.'; exit 1; }
cd -- "$(dirname -- "$0")"
source_config=checkin-intranet.conf
if test ! -f "$source_config"; then
    source_config=nginx/checkin-intranet.conf.example
fi
test -f "$source_config" || { echo 'Nginx configuration file missing.'; exit 1; }
target=/etc/nginx/sites-available/checkin-intranet-8022-8033.conf
enabled=/etc/nginx/sites-enabled/checkin-intranet-8022-8033.conf
test ! -e "$target" && test ! -L "$target" && test ! -e "$enabled" && test ! -L "$enabled" || { echo 'Target already exists; stop for review.'; exit 1; }
if ss -H -ltn '( sport = :8022 or sport = :8033 )' | grep -q .; then
    echo 'Port 8022 or 8033 is occupied; no changes made.'
    exit 1
fi
nginx -t
rollback() {
    rm -f -- "$enabled" "$target"
    nginx -t && systemctl reload nginx
}
trap rollback ERR
install -o root -g root -m 644 "$source_config" "$target"
ln -s "$target" "$enabled"
nginx -t
systemctl reload nginx
trap - ERR
echo 'DEPLOYED: 8022 frontend; 8033 admin'
ss -ltn '( sport = :8022 or sport = :8033 )'
if command -v ufw >/dev/null; then ufw status; fi

#!/usr/bin/env bash
# Usage: sudo bash check-cert.sh <lineage> <name>...
# Fails unless the lineage's certificate covers every name, printing the
# certbot command that issues it. That command's -d list replaces the
# lineage's names, so pass every name the vhost serves. Run it before
# rendering a vhost: one pointing at a missing lineage fails every later
# `nginx -t`, other vhosts' deploys included, and one whose cert lacks a
# server_name passes `nginx -t` and then fails TLS in the browser.
[ $# -ge 2 ] || { echo "usage: check-cert.sh <lineage> <name>..." >&2; exit 2; }
lineage=$1
shift
cert="/etc/letsencrypt/live/$lineage/fullchain.pem"
sans=$(openssl x509 -noout -ext subjectAltName -in "$cert" 2>/dev/null | tr ',' '\n' | sed 's/^ *//')
missing=()
for name in "$@"; do
  grep -qxF "DNS:$name" <<<"$sans" || missing+=("$name")
done
[ ${#missing[@]} -eq 0 ] && exit 0
echo "$cert is missing or does not cover ${missing[*]}. Issue the cert on this box, then re-run this job:"
echo "  sudo certbot certonly --webroot -w /var/www/certbot --cert-name $lineage --expand$(printf ' -d %s' "$@")"
exit 1

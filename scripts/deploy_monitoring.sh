#!/usr/bin/env bash
#
# Copies the committed deploy/monitoring to ~/prometheus on the monitoring host
# and recreates its containers. Run from a checkout, logged in with
# `aws sso login --profile alliance-admin`. docs/monitoring.md has the rest.

set -Eeuo pipefail

key="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
root="$(git rev-parse --show-toplevel)"
rev="$(git -C "$root" rev-parse HEAD)"

aws_admin () { aws --profile alliance-admin --region us-west-2 "$@"; }
config_tar () { git -C "$root" archive --format=tar "$rev:deploy/monitoring"; }

[[ -r "$key.pub" ]] || { echo "no public key at $key.pub; set SSH_KEY to your private key's path"; exit 1; }

instance=$(aws_admin ec2 describe-instances \
  --filters Name=tag:Name,Values=MonitoringInstance Name=instance-state-name,Values=running \
  --query 'Reservations[0].Instances[0].[InstanceId,PublicIpAddress]' --output text)
read -r instance_id ip <<< "$instance"
[[ "$instance_id" == i-* ]] || { echo "no running MonitoringInstance found"; exit 1; }

webhook=$(aws_admin ssm get-parameter --name /alliance/prod/server/SLACK_WEBHOOK_URL \
  --with-decryption --query Parameter.Value --output text) ||
  { echo "Grafana's alerts need /alliance/prod/server/SLACK_WEBHOOK_URL in Parameter Store"; exit 1; }

# EC2 Instance Connect trusts the key for 60 seconds, so one master connection
# opens now and every later command rides on it.
work=$(mktemp -d)
ssh_opts=(-i "$key" -o StrictHostKeyChecking=accept-new -o ControlPath="$work/ssh")
host="ec2-user@$ip"
trap 'ssh "${ssh_opts[@]}" -O exit "$host" 2> /dev/null; rm -rf "$work"' EXIT
aws_admin ec2-instance-connect send-ssh-public-key --instance-id "$instance_id" \
  --instance-os-user ec2-user --ssh-public-key "file://$key.pub" > /dev/null
ssh "${ssh_opts[@]}" -o ControlMaster=yes -o ControlPersist=yes -fN "$host"
# shellcheck disable=SC2029 # callers expand their own values into the command on purpose
remote () { ssh "${ssh_opts[@]}" "$host" "$@"; }

mkdir "$work/host" "$work/repo"
config_tar | tar -C "$work/repo" -xf -
remote 'sudo tar -C ~/prometheus --exclude=./data --exclude=./grafana-data --exclude=./grafana.env -cf - .' |
  tar -C "$work/host" -xf - || echo "could not read all of ~/prometheus on the host"
(cd "$work" && diff -ru host repo) || true
[[ -z "$(git -C "$root" status --porcelain -- deploy/monitoring)" ]] ||
  echo "deploying ${rev:0:10}; uncommitted changes in deploy/monitoring stay behind"
# A pin older than what the host runs would downgrade it onto data the newer version wrote.
for app in prometheus grafana; do
  pinned=$(sed -n "s|^ *image: [^:]*/$app:v\{0,1\}||p" "$work/repo/docker-compose.yml")
  running=$(remote "docker exec $app $app --version 2> /dev/null" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1) || true
  if [[ -z "$running" ]]; then
    echo "could not read which $app version the host runs; check it is not newer than $pinned"
  elif [[ "$(printf '%s\n' "$running" "$pinned" | sort -V | tail -1)" != "$pinned" ]]; then
    echo "the host runs $app $running, newer than the pinned $pinned; pin $running or later first"
    exit 1
  fi
done
read -r -p "Back up ~/prometheus on the host and replace its config with the repo's? [y/N] " answer
[[ "$answer" == y ]] || { echo "nothing changed"; exit 1; }
sed -n 's/^ *image: *//p' "$work/repo/docker-compose.yml" | remote 'xargs -n1 docker pull -q > /dev/null' ||
  { echo "pulling the pinned images failed; nothing changed"; exit 1; }

backup="monitoring-backup-$(date -u +%Y%m%dT%H%M%SZ).tgz"
# Prometheus's own data is left out: it is large, and losing it costs only history.
# Grafana's SQLite database is only safe to copy once Grafana has stopped, and
# holds secrets, so the backup is root-only: sudo keeps the stricter umask.
remote "cd ~/prometheus && docker-compose stop && umask 077 && sudo tar -C ~/prometheus --exclude=./data -czf ~/$backup ." ||
  { echo "the backup failed; the containers may be stopped, so run docker-compose start in ~/prometheus on the host"; exit 1; }
echo "backed up to ~/$backup on the host"
failed () { echo "$1; ~/$backup on the host holds the previous config, and docs/monitoring.md says how to restore it"; exit 1; }

# Compose can't load a project whose env_file is missing, so grafana.env goes first.
printf 'SLACK_WEBHOOK_URL=%s\n' "$webhook" | remote 'umask 077 && cat > ~/prometheus/grafana.env' ||
  failed "writing grafana.env failed with the containers stopped"
# Grafana provisions every file it finds, so a file deleted from the repo must go too.
config_tar | remote 'rm -rf ~/prometheus/grafana/provisioning && tar -C ~/prometheus -xf -' || failed "copying the config failed with the containers stopped"
remote 'cd ~/prometheus && docker-compose up -d --force-recreate' || failed "starting the containers failed"
# Grafana answers HTTP for a few seconds before exiting on provisioning it can't parse.
sleep 30
# shellcheck disable=SC2016 # the host expands it
remote 'cd ~/prometheus && docker-compose ps &&
  curl -fsS -o /dev/null --retry 10 --retry-delay 3 --retry-all-errors http://localhost:9090/-/ready &&
  curl -fsS -o /dev/null --retry 10 --retry-delay 3 --retry-all-errors http://localhost:3001/api/health &&
  [ "$(docker-compose ps -q | xargs docker inspect -f "{{.RestartCount}}" | sort -u)" = 0 ]' ||
  failed "the containers did not all come up and stay up"

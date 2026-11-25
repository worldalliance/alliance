# Monitoring

Prometheus and Grafana run in Docker on the monitoring host (`terraform/monitoring.tf`, EC2 tag `MonitoringInstance`). Prometheus scrapes the production API's and frontend SSR server's `/metrics` every 15 seconds and, through the blackbox exporter, probes `GET /health/db`. Grafana, at https://metrics.worldalliance.org, reads from it, evaluates the alert rules and posts to the Slack channel the server's event log uses, through the same webhook (`/alliance/prod/server/SLACK_WEBHOOK_URL` in Parameter Store). The deploy copies the webhook to the host, so after changing it, deploy monitoring again. The deploy fails without that parameter.

Everything the host runs in Docker is in `deploy/monitoring/`, and `scripts/deploy_monitoring.sh` puts it there. The Prometheus data, Grafana's database (users, dashboards) and `grafana.env` live only on the host, in `~/prometheus`.

## Alerts

| Alert                                          | Fires when                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| Requests are waiting for a database connection | `db_pool_waiting_requests` above 0 for a minute                       |
| Database connection checkouts are timing out   | about three or more `db_pool_acquire_timeouts_total` in two minutes   |
| Prometheus cannot scrape the API               | the `app_server_api` scrape failing for a minute                      |
| The API cannot reach its database              | `GET /health/db` failing twice in a row while the API scrape succeeds |
| Prometheus cannot probe GET /health/db         | the blackbox exporter's scrape failing for a minute                   |

`GET /health/db` runs `SELECT 1` through the API's own pool and answers 503 when it fails or takes over 2 seconds, so it fails while the pool is starved. `GET /` never touches the database, because the backend deploy decides from it whether a release came up.

The rules, contact point and notification policy are provisioned from `deploy/monitoring/grafana/provisioning/`, so Grafana's UI can't edit them. Change the files and deploy. `scripts/readiness-rule.test.ts`, which CI runs with the other `scripts` tests, checks the readiness rule's settings and runs its expression through the pinned Prometheus release's `promtool` over outage, restart-gap and in-flight-probe cases. Provisioning the notification policy replaces Grafana's whole policy tree. Deleting an entry or file leaves its resource in Grafana; removing it takes a delete entry such as `deleteRules` or `deleteContactPoints`.

## Getting onto the host

Anyone signed in with `aws sso login --profile alliance-admin` can SSH in through EC2 Instance Connect, which trusts your public key for 60 seconds. You don't need the host's original key. Create that profile once the way `docs/local-secrets.md` creates `alliance-dev`, choosing the admin role and naming it `alliance-admin`.

```bash
aws ec2-instance-connect ssh --profile alliance-admin --region us-west-2 \
  --instance-id "$(aws ec2 describe-instances --profile alliance-admin --region us-west-2 \
    --filters Name=tag:Name,Values=MonitoringInstance Name=instance-state-name,Values=running \
    --query 'Reservations[0].Instances[0].InstanceId' --output text)"
```

That needs AWS CLI v2, the host's port 22 open (`monitoring_sg`), and Amazon Linux's `ec2-instance-connect` package, which the host's AMI ships with. If Prometheus or Grafana is down, `cd ~/prometheus && docker-compose up -d`.

## Deploying

```bash
aws sso login --profile alliance-admin
scripts/deploy_monitoring.sh
```

It deploys `deploy/monitoring/` as committed at your checkout's `HEAD`; uncommitted changes stay behind. It shows how every file in the host's `~/prometheus`, apart from Prometheus's and Grafana's data and `grafana.env`, differs from that, and asks before changing anything. It refuses to go on when the host runs a newer Prometheus or Grafana than `docker-compose.yml` pins, since the deploy would downgrade it. Then it pulls the pinned images, stops the containers, backs up `~/prometheus`, minus Prometheus's data, to `~/monitoring-backup-<time>.tgz` on the host, readable only by root, writes the webhook into `~/prometheus/grafana.env`, copies the files over and recreates the containers. It fails unless Prometheus and Grafana answer half a minute later with no container restarted. That catches a config Prometheus rejects and a provisioning file Grafana can't parse, but not an alert rule Grafana parses and can't evaluate, so check the rules in Grafana after changing them. `SSH_KEY` picks a key other than `~/.ssh/id_ed25519`.

Deploy a server that serves `GET /health/db` before a monitoring config that probes it. Otherwise the readiness alert fires on the 404.

To check that alerts reach Slack, open the "Slack event log" contact point in Grafana (Alerting, then Contact points) and press "Test".

To put a backup back, run this on the host, naming the backup:

```bash
cd ~/prometheus && docker-compose stop && sudo rm -rf grafana/provisioning &&
  sudo tar -C ~/prometheus -xzf ~/monitoring-backup-<time>.tgz && docker-compose up -d --force-recreate
```

The deploy replaces the host's copies of the repo's files outright, and the whole of `grafana/provisioning/`, so a scrape job or service that is only on the host, such as the node-exporter jobs the original setup had operators add to `prometheus.yml`, is gone after it unless you add it to the repo first. The diff shows any. The host's original setup is in `docs/legacy/monitoring.md`. That includes node-exporter itself and the nginx and TLS in front of Grafana, which the deploy doesn't touch.

# Evidence

## Monitoring host

Read-only checks with the `alliance-admin` login, 2026-11-14.

- `ec2 describe-instances`: `MonitoringInstance` is a running t3a.small launched 2026-03-31, on key pair `ssh-key`, with no IAM instance profile. `ssm describe-instance-information` lists only the two app hosts, so Session Manager can't reach it.
- Its AMI, `ami-05572e392e80aee89`, is `al2023-ami-2023.7.20250414.0-kernel-6.1-x86_64`, which is Amazon Linux 2023.
- SSH as `ec2-user` with the user's own key is refused (`Permission denied (publickey)`). The public key in `aws_key_pair.ssh-key` (`terraform/main.tf`) is a different key.
- `https://metrics.worldalliance.org/api/health` reports Grafana `12.2.1`.
- `alliance-dev` is denied `ec2:DescribeInstances`.

## Monitoring options and cost

The second opinion was from a codex subagent, read-only, 2026-11-14, given the options unranked. It ranked hosted Grafana Cloud first, CloudWatch second and the self-hosted host last for a small team that wants alerts, not dashboards (agent judgement). Its vendor-doc claims, as it reported them:

- The CloudWatch agent scrapes Prometheus endpoints on EC2 (vendor documentation): https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Agent-PrometheusEC2.html
- AWS Chatbot is now Amazon Q Developer in chat applications and needs its own Slack app, so it can't reuse an incoming webhook (vendor documentation): https://docs.aws.amazon.com/chatbot/latest/adminguide/slack-setup.html
- Grafana Cloud doesn't take the local file provisioning used here (vendor documentation): https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/file-provisioning/
- Alerting on the alerting pipeline itself (metamonitoring) is Prometheus's documented practice (vendor recommendation): https://prometheus.io/docs/practices/alerting/

Free tiers, searched 2026-11-14:

- Grafana Cloud Free: 10,000 active metric series with 14-day retention, covering all services within usage limits. No published free-plan alerting cap was found (vendor pricing page): https://www.grafana.com/pricing/
- CloudWatch: 10 custom metrics and 10 alarms always free, per third-party summaries and AWS's China pricing page. AWS's own page was only partly retrieved: https://aws.amazon.com/cloudwatch/pricing/ and https://www.cloudzero.com/blog/cloudwatch-pricing
- healthchecks.io Hobbyist: $0 for 20 checks (vendor pricing page): https://healthchecks.io/pricing

## Prometheus pin

2026-11-15. `gh api repos/prometheus/prometheus/releases/latest` gives v3.16.0, published 2026-11-05; Docker Hub has `prom/prometheus:v3.16.0`. GitHub release dates: Prometheus v3.5.0 2025-07-14, v3.6.0 2025-09-22, v3.7.0 2025-10-15; Grafana v12.2.1 2025-10-21. With the official darwin-arm64 promtool 3.16.0 (sha256 matching the release's `sha256sums.txt`), `promtool check config deploy/monitoring/prometheus.yml` passed.

## pg-pool

Read from `node_modules/pg-pool/index.js` 3.13.0 (pg 8.20.0, typeorm 0.3.28), 2026-11-14.

- `connectionTimeoutMillis` (TypeORM's `connectTimeoutMS`) bounds both the wait in `_pendingQueue`, which fails with `timeout exceeded when trying to connect`, and opening a new client, which fails with `Connection terminated due to connection timeout`.
- The pool exposes `totalCount`, `idleCount` and `waitingCount`, and emits no event on a timeout.
- TypeORM's `PostgresDriver.loadDependencies` uses `options.driver` in place of `require("pg")`, and `createPool` calls `new this.postgres.Pool(...)` and later `pool.connect(callback)`.

## nginx

2026-11-14, Homebrew nginx 1.31.4 with only `location /api/` and the `/api/health/` block from `deploy/nginx/alliance.conf`, in front of a stub that answers 200 to everything. `/api/health/db`, `/api/health/db/`, `/api/Health/DB`, `/api//health/db`, `/api/%68ealth/db` and `/api/health/db?x=1` answered 404, and `/api/metrics` and `/api/healthz` 200. An exact `location = /api/health/db` had let `/api/health/db/` through.

## Grafana pin

2026-11-16. `gh api repos/grafana/grafana/releases` lists v12.2.2 through v12.2.10 (published 2026-06-23) after v12.2.1, plus `+security` builds. The release notes of v12.2.8+security-01, v12.2.8+security-04 and v12.2.9 list CVE fixes. Docker Hub has `grafana/grafana:12.2.10`. The official darwin-arm64 Grafana 12.2.10, its sha256 matching dl.grafana.com's `.sha256`, started with a fresh data directory and a copy of `deploy/monitoring/grafana/provisioning/`, answered `/api/health` with version 12.2.10 and listed the provisioned datasource. With a provisioning file that isn't valid YAML it exited, logging `failure to parse file`. With `.gitkeep` alone in `dashboards/`, `plugins/` and `alerting/` it logged no provisioning error.

## Grafana provisioning errors

2026-11-14, the official darwin-arm64 Grafana 12.2.1 started from `.scratch/` with a fresh data directory and a copy of the provisioning files.

- A `rules.yaml` that isn't valid YAML: Grafana logged `HTTP Server Listen`, then exited 1 about four seconds later with `failure to parse file rules.yaml`.
- A `rules.yaml` whose threshold expression has `type: bogus` and whose query names a datasource uid that doesn't exist: Grafana started, `/api/health` answered 200, and nothing about the rule was logged.

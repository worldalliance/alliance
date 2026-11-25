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

## Local run

2026-11-14, on macOS arm64. A local server ran this branch's code. The official darwin-arm64 releases of Prometheus 3.5.0, blackbox_exporter 0.27.0 and Grafana 12.2.1 ran from `.scratch/`, with `deploy/monitoring/`'s files changed only in hosts and ports. A local HTTP sink stood in for Slack. `promtool check config deploy/monitoring/prometheus.yml` passed.

- Grafana 12.2.1 rejected a rule group interval of 15s: `interval (15s) should be non-zero and divided exactly by scheduler interval: 10`.
- Blackbox exporter resolves `localhost` to `::1` first, which failed against a server listening on IPv4 only. The local run probed `127.0.0.1`, and production probes an IPv4 address.
- Pool starvation: one psql session held `LOCK TABLE action IN ACCESS EXCLUSIVE MODE` for 150 s while 45 concurrent loops requested `GET /actions/slug/1`. The metrics read 30 connections, 16 waiting, and acquire timeouts rising about 2 a second. `GET /health/db` answered 503. The timeout and readiness rules fired within about 45 s and the waiter rule after its one-minute hold. After the lock was released, all three resolved. The sink received `[FIRING:1]` and `[RESOLVED]` Slack payloads for the waiter and timeout alerts and `[RESOLVED]` for readiness.
- Stopping the server fired "Prometheus cannot scrape the API" after its one-minute hold.
- 2026-11-16, Grafana 12.2.10 with a fresh data directory and the provisioning files provisioned the datasource, the Slack contact point, the notification policy and all five rules, as 12.2.1 did.
- Grafana's contact-point test sent a Slack-format payload to the sink, with the URL taken from `SLACK_WEBHOOK_URL` in the environment.

## Grafana provisioning errors

2026-11-14, the official darwin-arm64 Grafana 12.2.1 started from `.scratch/` with a fresh data directory and a copy of the provisioning files.

- A `rules.yaml` that isn't valid YAML: Grafana logged `HTTP Server Listen`, then exited 1 about four seconds later with `failure to parse file rules.yaml`.
- A `rules.yaml` whose threshold expression has `type: bogus` and whose query names a datasource uid that doesn't exist: Grafana started, `/api/health` answered 200, and nothing about the rule was logged.

## Blackbox exporter pin

2026-11-15. `gh api repos/prometheus/blackbox_exporter/releases/latest` gives v0.29.1, published 2026-10-21; Docker Hub has `prom/blackbox-exporter:v0.29.1`. The official darwin-arm64 build (sha256 matching the release's `sha256sums.txt`) accepted `deploy/monitoring/blackbox.yml` with `--config.check`, and through it a local stub's 200 read `probe_success 1` and its 503 `probe_success 0`.

## Rule edge cases

2026-11-14, `promtool test rules` from the official darwin-arm64 Prometheus 3.5.0, 15-second samples, and Grafana 12.2.1 from `.scratch/`.

- Readiness with `probe_success` `1 1 0 _`, the newest probe still running, and the API scrape up: the expression without the `count_over_time` term fired at 45 s on that one failure; with it, it stayed quiet. Both still fired on `1 1 1 0 0 0` with the API up and stayed quiet through a restart gap where both series failed together.
- In-flight probes, 2026-11-14, with Prometheus 3.5.0 and blackbox_exporter 0.27.0 probing, through `deploy/monitoring/blackbox.yml`, a local stub whose `/health/db` answered 503 after 2 s and whose `/metrics` answered at once: the readiness expression without `offset` read 1 (healthy) on 13 of 105 one-second queries once warmed up, two consecutive seconds in each 15-second probe cycle. With `offset 10s` on all three ranges it read 0 on all 105. `promtool test rules` gave the offset expression the same results as the cases above, one 15-second evaluation later.
- `sum(increase(...[2m]))` over a counter going `0 0 1 1 1 1 2 2 2 3 3`, three timeouts inside the window ending at 135 s, read 2.2857.
- Grafana with the provisioned rules and contact point, a Prometheus with no `probe_success` series, and a local sink as the Slack webhook: the readiness rule with `noDataState: NoData` went to NoData, and the sink received `[FIRING:1] DatasourceNoData Alliance API (alliance-prometheus A The API cannot reach its database)`. On that fresh Grafana's first start, the first dispatch went to the default email contact point before the provisioned policy took effect; the retry 30 s later reached the sink.
- 2026-11-15, `promtool test rules` from the official darwin-arm64 Prometheus 3.16.0, the pinned release, passed the readiness expression's cases above unchanged.
- 2026-11-15, `scripts/readiness-rule.test.ts` on macOS arm64, downloading and checksum-checking promtool 3.16.0 into an empty cache: all cases passed. Each change to the readiness rule in `rules.yaml` failed it: dropping `offset 10s` failed four cases (sustained failure, newest probe running, probe gap, recovery), dropping the count term two (single failure with the next probe running, probe gap), dropping the `up` term one (restart gap), and `noDataState: NoData` the settings check. Not run on Linux, where CI runs it.

## Restart gap

2026-11-15, the official darwin-arm64 Prometheus 3.16.0, blackbox_exporter 0.27.0 and Grafana 12.2.1 from `.scratch/`, with `deploy/monitoring/`'s files changed only in hosts and ports, a local stub answering 200 to `/health/db` and `/metrics`, and a local sink as the Slack webhook. Each run started the three, stopped them all after 2.5 to 3 minutes, as the deploy does, and started them again 30 s later.

- With the readiness rule's `noDataState: NoData`, the rule went to NoData 8 s after the restart, and Grafana sent `DatasourceNoData` to its notifier, then resolved it 30 s later, the same as the policy's `group_wait`. The sink received nothing that time.
- With `noDataState: OK` and the probe-down rule, nothing was sent after the restart. The probe-down rule went to Pending on no data and back. Killing the blackbox exporter two minutes later sent the probe-down alert after 75 s, and the sink received `[FIRING:1] Prometheus cannot probe GET /health/db` 30 s after that. The readiness rule never fired.

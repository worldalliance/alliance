# Decisions

This task is step 1 of the plan in `docs/provenance/01a1dd1c-671e-76d3-8697-d491bf5e870e-cron-lease-locks` (its decisions 4, 5 and 7) and follows those decisions except where noted. The user deferred how the work is split, so the choices below are the agent's.

## One PR for the whole issue

The user left the split open. Metrics, readiness endpoint, #992's leftovers and the monitoring config go in one PR, as the plan's "Order of work" proposes: the alert rules query the metrics and probe the endpoint, so neither half can be checked end to end without the other.

## Pool metrics come from a `pg.Pool` subclass passed as TypeORM's `driver`

TypeORM builds its pool with `new this.postgres.Pool(...)`, where `postgres` is the `driver` option or `require("pg")`. `instrumentedPg` is `pg` with `Pool` replaced by `InstrumentedPool`, so the metrics read the very pool the app's `DataSource` uses (a requirement in the plan's decision 4), through TypeORM's own extension point instead of patching an instance. `InstrumentedPool` counts acquire timeouts in `connect()`, the one place a checkout that times out is visible. TypeORM's query logger never sees one. Both of pg-pool's timeout errors count: waiting in the queue, and opening a connection that outlasts `connectTimeoutMS` (EVIDENCE.md, "pg-pool"). The gauges sum over live pools, and a pool leaves that set when it ends, so a process with one pool reports that pool's counts.

## `GET /health/db`, bounded at 2 seconds

The probe is a `SELECT 1` through `DataSource.query`, so it needs a connection from the app's pool and fails while that pool is starved. It is bounded with the shared `withTimeout` (`common/src/timeout.ts`) at 2 seconds. That bound is agent judgement, not a researched value: it is well under the 10-second `connectTimeoutMS`, so the endpoint answers 503 before pg-pool gives up. A query that fails is logged at warn and answers 503 too.

`@nestjs/terminus` was not used. It would add a dependency and its own response shape for one check, and its ping check's timeout doesn't cancel the query either. The endpoint lives in its own `HealthModule` so `AppController` keeps no database dependency, and the existing `app.e2e-spec.ts` builds it alone. It is `@Public()` alone, like `GET /`: it reads no session, and `AuthOptionalGuard` returns early on public routes anyway. nginx answers 404 for everything under `/api/health/`, in any case (EVIDENCE.md, "nginx"), since each call takes a connection from the pool real requests use and its only caller, the monitoring host, reaches the API directly over the VPC.

## #992's leftovers

`connectionOptions()` moves to `server/src/datasources/connection-options.ts`. `dataSource.ts` builds the CLI `DataSource` and loads `dotenv` as soon as it is imported, which is what kept a unit test from importing it. The test now builds a `DataSource` from `connectionOptions()` and checks that its driver carries the pool size, timeout and `InstrumentedPool`. The app no longer imports `dotenv/config` through `dataSource.ts`. Bun loads `.env` itself before any code runs, and the CLI still loads it through `dataSource.ts`.

The `poolSize` comment now states the plan's threshold: the 11 locked crons hold at least 25 connections while each waits for another, so a pool under 26 can deadlock. The comment names the spec that sums those connections rather than the number, so a recount can't leave it stale. The old test's `LOCK_KEYS × 2` bound understated that. Its replacement lists that audit's per-job connection counts in the spec as a `Record` over `LOCK_KEYS`, so a new lock-taking cron doesn't compile until someone counts its connections, and checks the pool is larger than their sum less one per job.

## The monitoring host keeps running, configured from `deploy/monitoring/`

REQUIREMENTS.md 3 keeps the host. Its compose file and Prometheus config are reconstructed from `docs/legacy/monitoring.md`, because nobody had access to read the live files when this was written. So `scripts/deploy_monitoring.sh` first diffs every file the host has in `~/prometheus`, apart from Prometheus's and Grafana's data and `grafana.env`, against the repo's and asks before changing anything, then pulls the pinned images, so a pull neither lengthens the outage nor fails with the containers stopped, then stops the containers, since Grafana's SQLite database can tear when copied while Grafana writes it, and backs up `~/prometheus` (minus Prometheus's own data) on the host, readable only by root since Grafana's database holds secrets. It ships `HEAD`'s `deploy/monitoring/` through `git archive`, so uncommitted edits and local run data never reach the host, and the diff shows exactly what it ships. It deletes the host's `grafana/provisioning/` first, since Grafana provisions every file there and a file deleted from the repo would otherwise stay live. It recreates every container, then fails unless Prometheus and Grafana answer and no container restarted. A step that fails after the containers stop says where the backup is. Grafana 12.2.1 and 12.2.10 exit a few seconds after starting on a provisioning file they can't parse, having briefly answered HTTP, but 12.2.1 starts normally with a rule that names an unknown expression type or datasource (EVIDENCE.md, "Grafana provisioning errors"), so the check catches the first and not the second.

- Image tags are pinned: `grafana/grafana:12.2.10`, the newest patch of the 12.2 line the host answered with on 2026-11-14 (12.2.1, which misses patch releases that fix CVEs, EVIDENCE.md "Grafana pin"), and `prom/prometheus:v3.16.0`, the newest stable release on 2026-11-15. The host's compose file used untagged images, so a restart could pull any version. Which Prometheus version runs there can't be read without host access, but `latest` only ever names a stable release, so it is at most v3.16.0, and with Grafana 12.2.1 (released 2025-10-21) on the host its images were pulled after Prometheus v3.7.0, so it is newer than the v3.5 line (agent judgement from release dates, EVIDENCE.md "Prometheus pin"). The deploy still reads the versions running on the host and refuses to go on when either is newer than its pin, rather than downgrade it onto data the newer version wrote. Prometheus 3 reads data written by 2.x (agent judgement from the 3.0 migration notes, not checked here).
- `grafana/provisioning/` keeps `.gitkeep` files in `dashboards/` and `plugins/`, since its mount hides the image's empty directories and Grafana logs an error on every start for each one missing.
- The readiness probe needs the blackbox exporter, Prometheus's standard way to probe an HTTP endpoint, so it joins the compose file, pinned to `prom/blackbox-exporter:v0.29.1`, the newest stable release on 2026-11-15 (EVIDENCE.md, "Blackbox exporter pin"). Its 5-second probe timeout is longer than the endpoint's 2-second bound, so a starved pool reads as the endpoint's 503 rather than a probe timeout.
- The provisioned datasource, which the alert rules query, is named "Prometheus (provisioned)" with uid `alliance-prometheus`, so it can't collide with the one someone set up in Grafana's UI and dashboards may use.
- Provisioning the notification policy replaces Grafana's whole policy tree. Whether the host has one is unknown, and the deploy's backup covers it.

## The Slack webhook is the event log's, read from Parameter Store at deploy

REQUIREMENTS.md 2 picks the event log's channel. Its webhook is already `/alliance/prod/server/SLACK_WEBHOOK_URL`. The deploy script reads it with the deployer's `alliance-admin` login, pipes it over SSH into `~/prometheus/grafana.env` (mode 600), and Grafana expands `$SLACK_WEBHOOK_URL` in the contact-point file. The webhook stays out of the repo and off any command line, and rotating it means redeploying monitoring as well as the backend.

## Access through EC2 Instance Connect, with no Terraform change

REQUIREMENTS.md 5. The host runs Amazon Linux 2023, which ships `ec2-instance-connect`, and its security group opens port 22. So `alliance-admin`'s `ec2-instance-connect:SendSSHPublicKey` is enough to get in without the original key pair (EVIDENCE.md, "Monitoring host"). An IAM role for Session Manager was the alternative. It would be a lasting infrastructure change for something Instance Connect already allows. The deploy script uses Instance Connect too, opening one multiplexed SSH connection inside the key's 60-second window.

## Not done here

- The host's `prometheus.yml` keeps the `app_server_ssr` job from the legacy setup, though the frontend may no longer serve `/metrics` on port 3000. The deploy's diff shows what the host actually scrapes.
- `GET /metrics` answers on the API without authentication, as it did before this task. Prometheus scrapes it over the VPC, but nothing here checks whether nginx exposes it publicly.

## Restarting monitoring if down:

`ssh ec2-user@[monitoring-ip]`

`cd prometheus && docker-compose up -d`

## Steps for setting up Prometheus / Grafana monitoring.

### Infra setup.

We are self-hosting metrics on a separate ec2 instance. See `monitoring.tf` for the setup of that instance. The overall architecture is:

- Our api server collects metrics via `prom-client` with a global interceptor, and exposes `/metrics` endpoints locally on the VPC which return prometheus structured logs.

- The frontend ssr server (see `server.js`) similarly captures all requests with `prom-client` and exposes `/metrics`

- The ec2 runs `node-exporter` on port 9100 which exposes its own `metrics` for information about the instance itself (memory/cpu usage, etc.)

- Prometheus (in a docker container) hits each `/metrics` every 15 seconds and stores it, then serves the data at `9090` on the monitoring ec2. It retains the stored logs on disk for 15 days right now. The prometheus data endpoint not secured at all so the 9090 port is not exposed publicly.

- Grafana (in another docker container) reads prometheus data from `prometheus:9090` (internal docker container port) and hosts the grafana ui on `:3001`. (This is set up in the Grafana UI data sources panel)

### Monitoring setup on EC2

- `ssh ec2-user@[monitoring-ec2-ip]`

- (if needed) Install docker-compose

```
sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose

sudo chmod +x /usr/local/bin/docker-compose

docker-compose version
```

- setup docker containers

`mkdir -p ~/prometheus`

`cd ~/prometheus`

`nano prometheus.yml`

Paste in:

```
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'app_server_ssr'
    static_configs:
      - targets: ['10.0.4.27:3000']  # take from `app_server_private_ip` tf output
  - job_name: 'app_server_api'
    static_configs:
      - targets: ['10.0.4.27:3005']  # take from `app_server_private_ip` tf output

```

`nano docker-compose.yml`

```
services:
  prometheus:
    image: prom/prometheus
    container_name: prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=15d'
    ports:
      - '9090:9090'
    restart: unless-stopped

  grafana:
    image: grafana/grafana
    container_name: grafana
    ports:
      - '3001:3000'
    volumes:
      - ./grafana-data:/var/lib/grafana
    restart: unless-stopped
```

Running now will likely run into permission issues for the containers. To fix:

In `~/prometheus`:

`mkdir -p data`

`sudo chown -R 65534:65534 data`

`mkdir -p grafana-data`

`sudo chown -R 472:472 grafana-data`

Now we can run:

`docker-compose up -d`

Now `docker ps` should show both prometheus and grafana as running

At this point you should be able to go to [monitoring-ec2-ip]:3001 and see grafana running

## debugging data sources

You can access the prometheus ui at [monitoring-ec2-ip]:9090, but only after adding the following to `monitoring.tf (resource "aws_security_group" "monitoring_sg")`

```
ingress {
    description = "prometheus (temp)"
    from_port   = 9090
    to_port     = 9090
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
```

This allows totally unsecured access to the server monitoring data, so be sure to remove the ingress after.

## http stuff

We currently have this visible at `metrics.worldalliance.org`. Setting this up basically requires:

- Adding the appropriate dns record in [porkbun](https://porkbun.com) pointing to the ec2 ip

- Installing `nginx` on the ec2 and directing traffic from port 80 -> 3001 where grafana lives

- Installing `certbot` and running it to update the config to allow for 443 https -> 3001 also. (`sudo yum install -y certbot python3-certbot-nginx && sudo certbot --nginx -d metrics.worldalliance.org`)

- Note `ingress` blocks in monitoring.tf for 80 and 443 to allow this.

### Node-exporter setup

We run this on each ec2 server to export data about the instance to prometheus on :9100s

```
# Get the latest node_exporter (change version if needed)
cd /tmp
curl -LO https://github.com/prometheus/node_exporter/releases/download/v1.8.2/node_exporter-1.8.2.linux-amd64.tar.gz
tar xzf node_exporter-1.8.2.linux-amd64.tar.gz

sudo mv node_exporter-1.8.2.linux-amd64/node_exporter /usr/local/bin/
sudo useradd --no-create-home --shell /usr/sbin/nologin node_exporter || true
sudo chown node_exporter:node_exporter /usr/local/bin/node_exporter

sudo tee /etc/systemd/system/node_exporter.service >/dev/null <<'EOF'
[Unit]
Description=Prometheus Node Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF


sudo systemctl daemon-reload
sudo systemctl enable node_exporter
sudo systemctl start node_exporter
sudo systemctl status node_exporter
```

For node-exporter, we need to update `prometheus.yml` on the monitoring instance with the ips (local to the network) of all the instances we want to fetch node-exporter data from.

## prod → staging sync

`scripts/sync_prod_to_staging.sh` runs nightly from cron on the staging host, and the backend deploy reinstalls it as `~/sync_prod_to_staging.sh` on every non-production branch. It reports each run twice, to Slack and to a dead man's switch.

Slack covers the runs that live long enough to post. The switch covers the ones that don't: a SIGKILL, a dead host, a cron that never fires, a `db-sync.env` that won't source. All of those send nothing, and the check alerts on the ping that never arrives.

The start and the outcome carry the run's timestamp, as in `prod → staging (20260901_020000)`, which is how you tell which start an outcome belongs to hours later. That same string names the dump file in the host log, so a message in Slack leads to its own lines in the log. A failure before the sync starts has no start to pair with and posts untagged.

Use a healthchecks.io check and set `HEALTHCHECK_URL` in `/home/ec2-user/db-sync.env` to its bare ping URL. The script appends `/start` and `/fail` itself, so don't include either, and a trailing slash is fine. Give the check a period of a day and a grace window longer than a full sync takes. A Better Stack heartbeat is not a drop-in replacement. It takes the bare URL and `/fail`, with no `/start`.

The sync refuses to start without `HEALTHCHECK_URL` and posts an `:x:` to Slack saying so. That is on purpose. A monitor that turns itself off when someone forgets a variable is worse than no monitor. It does mean a freshly provisioned staging host needs the variable in `db-sync.env` before the first run, not after.

Runs serialize on `/home/ec2-user/sync_prod_to_staging.lock`, so a manual re-run that collides with the nightly cron posts a `:no_entry:` and exits 0 instead of racing it over the same databases. The host needs `flock` for that. Without it the sync refuses to start and says so in Slack.

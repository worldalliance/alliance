# Outside sources

Checked 2026-11-16 by a research subagent. Status per root `AGENTS.md` **Established practice**.

- `log_format` is valid only in the `http` context; `access_log` is valid in `http`, `server` and `location`, and one at a lower level replaces those inherited from above. Several `access_log` lines at one level all write. Vendor documentation. https://nginx.org/en/docs/http/ngx_http_log_module.html, https://docs.nginx.com/nginx/admin-guide/monitoring/logging/
- The RHEL-family nginx package's `nginx.conf` includes `/etc/nginx/conf.d/*.conf` inside `http`, after `log_format main` and its `access_log`. Vendor configuration. https://gitlab.com/redhat/centos-stream/rpms/nginx/-/raw/c9s/nginx.conf

# Measurements

2026-11-17, production app host, read-only over SSM Run Command:

- `rpm -V nginx` reports no changes; `/etc/nginx/nginx.conf` defines `log_format main '$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent" "$http_x_forwarded_for"'` and `access_log /var/log/nginx/access.log main;`, with no host.
- `/etc/logrotate.d/nginx` rotates `/var/log/nginx/*.log` daily, `rotate 10`, compressed with `delaycompress`.
- One server block serves the legacy and new names, so `access.log` can't separate them. By referer, legacy-site `/api`, `/events` and `/socket.io` requests (images excluded) fell from 417 on 2026-11-12 to 3 on 2026-11-17 up to 06:53 UTC; about 2,500 to 2,900 a day carry no referer (the mobile app) and can't be attributed to a host.

2026-11-17, local nginx running the vhost with production names substituted, under a copy of the package's `http` block: `nginx -t` passes. In `access_host.log`, HTTP/2 requests log their `:authority` and HTTP/1.1 ones their Host header, as sent. An HTTP/1.0 request with no Host header logs `-`, where `$host` had logged the first `server_name`, the legacy domain.

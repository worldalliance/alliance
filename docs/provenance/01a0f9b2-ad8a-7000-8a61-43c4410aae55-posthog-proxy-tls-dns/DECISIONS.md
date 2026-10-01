# Decisions

## Certificate verification

- `proxy_ssl_verify on` with `proxy_ssl_trusted_certificate /etc/pki/tls/certs/ca-bundle.crt`. The deploy installs nginx with `yum` on EC2 hosts as `ec2-user`, i.e. Amazon Linux, where the system CA bundle lives at that path; PostHog's guide uses the Debian path `/etc/ssl/certs/ca-certificates.crt`.
- A missing bundle fails `nginx -t`, which the deploy runs before reload, so a wrong path stops the deploy instead of breaking analytics.
- No `proxy_ssl_verify_depth`. Against PostHog's live chain, the default depth of 1 verifies.
- Verified with a local nginx running the committed `/events/` block (macOS CA bundle swapped in): proxied responses match direct ones for `/`, `/static/array.js`, `/flags/?v=2`, and `/i/v0/e/`, and setting `proxy_ssl_name` to another host makes every request 502 with "upstream SSL certificate does not match".

## Post-deploy check

- `verify-https` fetches `https://<DOMAIN_NAME>/events/static/array.js`. A rejected certificate passes `nginx -t` and fails only per request, so without this step a broken proxy would drop analytics silently. `/static/array.js` is a public GET that ingests nothing; it returned 200 through the proxy on production and staging before this change.
- It runs after the deploy and does not roll back; it makes the failure visible through the existing Slack alert.
- It is the job's last step: steps after a failed one are skipped, and a PostHog outage shouldn't hide the checks on our own hosts.

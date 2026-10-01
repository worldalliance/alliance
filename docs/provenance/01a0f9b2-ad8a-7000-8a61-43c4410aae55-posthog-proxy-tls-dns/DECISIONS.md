# Decisions

## Certificate verification

- `proxy_ssl_verify on` with `proxy_ssl_trusted_certificate /etc/pki/tls/certs/ca-bundle.crt`. The deploy installs nginx with `yum` on EC2 hosts as `ec2-user`, i.e. Amazon Linux, where the system CA bundle lives at that path; PostHog's guide uses the Debian path `/etc/ssl/certs/ca-certificates.crt`.
- A missing bundle fails `nginx -t`, which the deploy runs before reload, so a wrong path stops the deploy instead of breaking analytics.
- No `proxy_ssl_verify_depth`. Against PostHog's live chain, the default depth of 1 verifies.
- Verified with a local nginx running the committed `/events/` block (macOS CA bundle swapped in): proxied responses match direct ones for `/`, `/static/array.js`, `/flags/?v=2`, and `/i/v0/e/`, and setting `proxy_ssl_name` to another host makes every request 502 with "upstream SSL certificate does not match".

## DNS re-resolution

- nginx resolves a literal `proxy_pass` host once, at start or reload, and the deploy reloads only on push. The host now goes through `$posthog_host`, which nginx resolves per request through `resolver`, caching each answer for its TTL.
- `resolver 169.254.169.253`, the Amazon VPC DNS server reachable from any EC2 instance, rather than PostHog's example of Google DNS, so lookups stay inside AWS. Its reachability from the hosts is unverified before deploy; the post-deploy check catches it.
- No `valid=`: PostHog's guide sets `valid=300s`, but `us.i.posthog.com` is a CNAME to an AWS ELB whose A records carry a 60s TTL, so overriding it would keep a released IP for up to five minutes.
- `ipv6=off`: the ELB also publishes AAAA records, which nginx's resolver returns by default. The startup lookup it replaces (getaddrinfo with AI_ADDRCONFIG) left them out on a host without IPv6, so on such a host about half the peers would be unreachable. Whether the hosts have IPv6 is unverified; IPv4 reaches PostHog either way.
- A variable in `proxy_pass` stops nginx from replacing the matched `/events/` prefix, so `rewrite ^/events/(.*)$ /$1 break` strips it. Without the rewrite, the local nginx test gets 404 for `/static/array.js`, `/flags/?v=2`, and `/i/v0/e/`.
- The upstream TLS name follows the variable's host, so no `proxy_ssl_name` is needed: the mismatched-name test above still fails every request with 502 once the host is a variable.
- Upstream TLS sessions are no longer reused: with a variable host, nginx builds a fresh peer per request, so each proxied request does a full handshake. Accepted for the small per-batch cost.
- No nginx `upstream` with `server ... resolve`: it needs nginx 1.27.3, and the `/assets/` comment in `alliance.conf` records the hosts on 1.26.
- Verified locally with the resolver swapped for a public one: proxied GETs match direct ones, POST bodies and query strings reach PostHog unchanged, and an unreachable resolver makes requests fail with "could not be resolved", so the lookup happens per request.

## Post-deploy check

- `verify-https` fetches `https://<DOMAIN_NAME>/events/static/array.js`. An unreachable resolver or a rejected certificate passes `nginx -t` and fails only per request, so without this step a broken proxy would drop analytics silently. `/static/array.js` is a public GET that ingests nothing; it returned 200 through the proxy on production and staging before this change.
- It runs after the deploy and does not roll back; it makes the failure visible through the existing Slack alert.
- It is the job's last step: steps after a failed one are skipped, and a PostHog outage shouldn't hide the checks on our own hosts.

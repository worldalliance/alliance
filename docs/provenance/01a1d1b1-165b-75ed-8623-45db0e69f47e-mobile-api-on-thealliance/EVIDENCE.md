# Evidence

## Hosts serve the same paths

Method: `curl` of `/api/health`, `/events/decide/` and `/socket.io/` on `thealliance.org`, `staging.thealliance.org` and `worldalliance.org`, 2026-11-12. Each path answered with the same status on every host (404, 200, 400), consistent with one nginx vhost naming both domains (`deploy/nginx/alliance.conf:73`) and proxying `/api/`, `/socket.io/` and `/events/` (`:169`, `:220`, `:243`).

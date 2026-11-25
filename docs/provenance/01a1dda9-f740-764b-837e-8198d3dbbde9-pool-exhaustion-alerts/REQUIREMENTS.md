---
user: Charles Lien
task: Pick the next issue in the "Cron locks that hold no connection" Linear project and open a PR for it. The agent picked ALL-2234, alert when the database pool is exhausted, step 1 of the plan in docs/provenance/01a1dd1c-671e-76d3-8697-d491bf5e870e-cron-lease-locks.
---

# Requirements

1. Implement ALL-2234 as a PR. (User-originated; the issue was the agent's pick.)
2. Alerts post to the Slack channel the server's event log already posts to. (Agent-proposed option, user-selected.)
3. Keep the existing self-hosted Prometheus and Grafana monitoring host (`terraform/monitoring.tf`) for now, rather than moving to Grafana Cloud or CloudWatch. (User-originated.)
4. Add no paid service. (User-originated.)
5. Anyone with the `alliance-admin` AWS login must be able to reach the monitoring host, without depending on whoever holds the host's original SSH key. (User-originated.)

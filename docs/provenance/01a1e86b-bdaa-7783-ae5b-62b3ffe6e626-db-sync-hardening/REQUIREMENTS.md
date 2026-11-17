---
user: Charles Lien
task: Harden the nightly prod → staging sync (ALL-2240, ALL-2241, ALL-2242, ALL-2256, ALL-2257) and open a PR from the envvars branch.
---

# Requirements

Follows `docs/provenance/01a1dd13-4193-71a0-b302-c04d1e8a6996-db-sync-parameter-store` (ALL-2025), whose review filed these issues.

1. The staging password hash is not passed to psql as an argument, so other users on the staging host can't read it through `ps`. (Linear issue ALL-2240, agent-proposed, user-approved.)
2. The sync's database connections to production and staging verify the RDS certificate against the committed RDS bundle (`server/src/config/rds-us-west-2-bundle.pem`), as the server's own connections do. (Linear issue ALL-2241, agent-proposed, user-approved.)
3. The Slack webhook URL and the healthcheck ping URL are not passed to curl as arguments. (Linear issue ALL-2242, agent-proposed, user-approved.)
4. CI shellchecks `scripts/sync_prod_to_staging.sh`, `scripts/download_staging_data.sh` and `scripts/disable_action_update_texts_emails.sh`. (Linear issue ALL-2256, agent-proposed, user-approved.)
5. A backend deploy that replaces `~/nest-backend` while the sync runs doesn't break the sync's later reads from it. (Linear issue ALL-2257, agent-proposed, user-approved.)
6. This PR adds no test that runs real psql on the anonymize step; that coverage, including a test of the whole `anonymize.sql` through real psql from a working directory outside `scripts/anonymize`, is left to Linear issue ALL-1940. (User-originated.)
7. Open the PR from the `envvars` branch. (User-originated.)

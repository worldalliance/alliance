---
user: Charles Lien
task: Open a PR for ALL-2152, so the worldalliance.org hosts stop serving the API, analytics and messaging socket, the worldalliance.org origins leave the CloudFront/S3 CORS rules, and the legacy-host sign-in block goes
---

- On the legacy hosts (`worldalliance.org`, `staging.worldalliance.org` and their `www.` names), `/api`, `/events` and `/socket.io` stop being served. This is the contract step for the legacy API host in `01a1ccef-8e76-75bb-9655-d39c48ef9c28-finish-thealliance-move`. (agent-proposed in that task and ALL-2152, user-approved)
- Images stored as `https://<legacy host>/api/images/<key>` in content that is never rewritten (old form snapshots, members' posts and comments) keep loading. (agent-proposed in ALL-2152, user-approved)
- The worldalliance.org origins leave the CloudFront response-header CORS policies and the S3 CORS rules in `terraform/main.tf` and `terraform/staging.tf`. (agent-proposed in ALL-2152, user-approved)
- The legacy-host sign-in block goes: `POST /auth/login` no longer refuses a migrated account's cookie sign-in on a legacy host with `ACCOUNT_MOVED_MESSAGE`, and the web login no longer handles that refusal. (agent-proposed in ALL-2152, user-approved)
- The PR merges only once no API traffic comes from mobile builds older than the release that moved the API to thealliance.org. (agent-proposed in ALL-2152, user-approved)
- The PR opens as a draft, so it can't merge before that traffic check. (agent-proposed, user-approved)
- The work happens on the `domain` branch. (user-originated)

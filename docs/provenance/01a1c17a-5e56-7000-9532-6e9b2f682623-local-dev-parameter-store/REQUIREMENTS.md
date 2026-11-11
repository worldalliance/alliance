---
user: Charles Lien
task: Run local dev through a Parameter Store wrapper, with test fakes and a drift check (Linear ALL-1964, step 5 of the Env Var Overhaul project)
---

# Requirements

## Context: the env var overhaul

- Local dev and agents get secrets through a wrapper that reads the `dev` path with the person's AWS login (IAM Identity Center). Each app's config module validates at startup and refuses to boot, naming what's missing, so a missing wrapper or an expired login fails loudly. (Linear project decision, user)
- Secrets live in AWS SSM Parameter Store, account `751910243706`, us-west-2, as SecureStrings under `/alliance/<env>/<consumer>/<NAME>`. Non-secret settings are committed to the repo. (Linear project decisions, user)

## The wrapper

- A separate `scripts/with-secrets.sh <consumer>`, run inside `scripts/with-env.sh`, wraps only the commands that need secrets. Commands with no secrets, such as `frontend:dev`, keep working without an AWS login. (agent-proposed after research, user-approved)
- It fetches at each start, keeps no cache, and exits before running the command when the fetch fails. (agent-proposed after research, user-approved)
- It refuses to override a variable that is already set, naming the variables, with nested wrapper runs exempt. On an expired login it fails with a clear message. (Linear ALL-1964, amended after research, user-approved)

## Developer tool credentials

- Agent transcripts upload with each person's own login, and the `alliance-agent-chats` IAM user is deleted. On an expired login the transcript stays on disk, a warning appears, and the upload retries after login. (agent-proposed after research, user-approved)
- Agent transcript uploads honour `HTTPS_PROXY` and `NO_PROXY` through a maintained proxy-agent package, keeping the existing connect and idle timeouts. (agent-proposed, user-approved)
- Linear's credentials move to Parameter Store under `/alliance/dev/devtools/`. (agent-proposed after research, user-approved)

## The server's local AWS access

- The local server uses each person's login, limited to the dev assets bucket, in place of the `alliance-dev` IAM user's keys. The wrapper sets `AWS_PROFILE` and refuses static AWS keys. (agent-proposed after research, user-approved)
- The Identity Center portal session lasts 24 hours. The setting is console-only and instance-wide. The permission set session stays at 1 hour. (agent-proposed after research, user-approved)
- Whether a failed credential refresh can exit a running server is tested before relying on this. (agent-proposed after research, user-approved)

## Rollout

- Two PRs. The first adds the wrapper, with `.env` secrets used only behind an explicit flag that prints each key it falls back on. The second removes the flag once everyone has run without it. (agent-proposed after research, user-approved)
- Shared secrets are rotated after the second PR wherever exposure can't be ruled out. Moving a secret does not by itself require rotating it. (agent-proposed after research, user-approved)

## Store contents, tests and checks

- Development's non-secret settings, such as `MAIL_FROM`, `SMTP_HOST`, `GOOGLE_CLIENT_ID`, the Apple IDs and `POSTHOG_KEY`, are committed as a development entry in the typed config in `common/src/deployed-config.ts`, including the Google client ID. (agent-proposed after research, user-approved)
- Only secrets go in Parameter Store, never `DB_NAME`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD` (local Postgres), `APP_URL`, `ADMIN_URL`, `NODE_ENV`, `TZ`, or anything committed as config. (Linear ALL-1964, user-approved)
- Unit and e2e tests run on committed fake values, without AWS or real credentials. (Linear ALL-1964, user-approved)
- Per-person values, such as `POSTHOG_API_KEY`, stay local and out of the shared store. (Linear ALL-1964, user-approved)
- A CI job fails when an environment's path lacks a key its schema requires or holds one no schema declares. It reads names only, with `ssm:DescribeParameters` and no decryption, and pages until `NextToken` is absent. (Linear ALL-1964, amended after research, user-approved)
- Identity Center permission sets and assignments are managed in Terraform. (Linear ALL-1964, user-approved)
- A new Identity Center group named `alliance-dev` holds the people who get the daily login. Terraform creates the group, taking the identity store id from the `aws_ssoadmin_instances` data source rather than hard-coding it, and assigns the `alliance-dev` permission set to it. The `admin` group, which holds every user and is for admin access, does not get this assignment. (user-originated; the name agent-proposed, user-approved)
- An admin manages the `alliance-dev` group's membership in the IAM Identity Center console, not in Terraform, so joining or leaving needs no PR and user ids stay out of this public repository. (agent-proposed, user-approved)
- The `web` and `mobile` paths from the issue are dropped. Nothing reads Turnstile, so `VITE_TURNSTILE_SITE_KEY`, `EXPO_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are neither copied nor committed. (agent-proposed, user-approved)

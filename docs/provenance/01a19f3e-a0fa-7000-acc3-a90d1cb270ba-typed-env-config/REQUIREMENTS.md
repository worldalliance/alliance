---
user: Charles Lien
task: Validate each app's config with a typed schema at startup (Linear ALL-1961, step 1 of the Env Var Overhaul project)
---

# Requirements

## Context: the env var overhaul

These hold for the whole overhaul; this task is its first step.

- Move every env var off GitHub Actions secrets and hand-made `.env` files; GitHub secrets are phased out. (user)
- Secrets live in Infisical, in one project, `alliance`, with environments `dev`, `staging` and `prod`. Every member may read every environment. (user)
- Non-secret per-environment settings (domains, Apple/Google IDs, mail sender, caps) are committed to the repo as typed per-environment config; Infisical holds only secrets. (agent-proposed, user-approved)
- Staging and production servers fetch their own secrets from Infisical at process start, authenticating with Infisical's AWS Auth through a per-server EC2 IAM role. (agent-proposed, user-approved)
- CI authenticates to Infisical through GitHub OIDC and reads only the secrets CI needs. (agent-proposed, user-approved)
- Local dev and agents get secrets through `infisical run`. Each app validates its config at startup and refuses to start, naming what's missing, so a missing wrapper or an expired login fails loudly. (agent-proposed, user-approved)

## This task

- Each app (server, frontend, admin, mobile) gets one typed config module that is the only code reading its env vars, validated with zod. (agent-proposed, user-approved)
- An invalid config stops the app at startup, listing every bad key at once. (agent-proposed, user-approved)
- Values come out typed (numbers, booleans, URLs), so callers don't parse them. (agent-proposed, user-approved)
- A key is optional only where the code runs without it. (agent-proposed, user-approved)
- Every server key the schema reads that Infisical's `alliance` project sets (non-empty) in an environment is required when `NODE_ENV` is that environment: `development` for Infisical `dev`, `staging` for `staging`, `production` for `prod`. A server missing one refuses to start, even where the code could run without it. Flags, whose unset value means off, stay unrequired. `NODE_ENV=test` has no Infisical environment and requires only the keys every server needs. (user)
- Where values come from doesn't change in this task. (agent-proposed, user-approved)
- Ship it as one pull request. (user)

---
user: Charles Lien
task: Servers fetch secrets from AWS SSM Parameter Store at startup via per-server IAM roles (Linear ALL-1963, step 3 of the Env Var Overhaul project)
---

# Requirements

## Context: the env var overhaul

- Staging and production servers fetch their own secrets at process start, authenticating through the EC2 instance role. Each server has its own IAM role so staging can't read production secrets. GitHub never handles app secrets. (Linear project decision, user)
- The secrets live in AWS SSM Parameter Store, not Infisical. Infisical's Free plan counts people and machine identities together against a cap of five, and the team needs up to ten people; Pro would cost about $260 a month, and the other hosted stores that work without stored keys cost $210 or more. Parameter Store is free at this size and uses the IAM roles and Identity Center logins the account already has. (user, after agent research comparing hosted, self-hosted, AWS and encrypted-in-repo options)

## This task

- Each environment (`staging`, `prod`) has the server's secrets under `/alliance/<env>/server/`, one SecureString parameter per secret, named by the server's own env var names (`DB_HOST`, `ASSETS_BUCKET`, …). Each server's role can read only its own environment's path. Values are copied from Infisical's `/server` folders, where they were assembled; Infisical stays as it is until the cleanup issue (ALL-1965). (agent-proposed, user-approved)
- The deploy stops exporting the app's GitHub secrets in this change, with no fallback. Before the running backend is stopped, the deploy validates the new release's config under the Parameter Store fetch, so an unreachable store or a missing key fails the deploy and leaves the old backend running. Reverting the change restores the old path. (agent-proposed, user-approved)
- The staging and production EC2 instances get separate IAM roles. Staging's role has read/write on the staging assets bucket and read-only on the production assets bucket, for the nightly prod → staging copy. Production's role has access to the production assets bucket only. (agent-proposed, user-approved)
- The agent writes the Terraform and the setup and shows the `terraform plan`; the apply runs as a non-root AWS admin rather than with root credentials. (agent-proposed, user-approved)
- The database CA certificate (`DB_CA_CERT`, AWS's public RDS us-west-2 bundle) is committed to the repo instead of coming from a secret. Moving the nightly sync's hand-made `~/db-sync.env` into the store is a separate issue. (agent-proposed, user-approved)

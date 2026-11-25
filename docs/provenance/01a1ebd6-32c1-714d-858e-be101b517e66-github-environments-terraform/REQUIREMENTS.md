---
user: Charles Lien
task: Work on ALL-2294 of the Faster CI deploys Linear project (manage the GitHub environments' branch rules in Terraform, derived from the CI role trust) and open its PR from the `ci` branch; also commit the Terraform provider lock file (ALL-1970).
---

# Requirements

Follows the Faster CI deploys plan in `docs/provenance/01a1ce4b-16f7-713d-9845-fe08e3ffa147-ci-deploy-speed`. The user approved Linear ALL-2294 as written; its points come from an earlier conversation with the user.

## Environments in Terraform

- **The existing `terraform/` root manages the GitHub environments CI's roles use**, with the `integrations/github` provider, so changes go through PRs and `terraform plan` shows drift (user-approved, from ALL-2294). One apply changes both the IAM trust and the GitHub rules; the cost, accepted, is that every apply of the root also needs a GitHub login.
- **The five environments are `pr-screenshots`, `staging`, `production`, `staging-hosts` and `production-hosts`**, each with custom deployment branch policies and one policy per allowed branch or pattern (user-approved, from ALL-2294).
- **Each environment's branch rules are derived from `local.ci_roles[*].trust` in `terraform/ci-oidc.tf`**, the map the IAM trust is built from: `refs/heads/` stripped for branches, `refs/pull/*/merge` kept for `pr-screenshots`, so the IAM trust and GitHub's rules can't disagree (user-approved, from ALL-2294).
- **`staging-live` and `production-live` stay out**: they hold the deploy guard's deployment records and have no branch rules (user-approved, from ALL-2294).
- **The existing environments and policies are imported**, so the first `plan` after the import shows no changes (user-approved, from ALL-2294).
- **The provider authenticates with the person applying's own login** (`gh auth token`, which needs repository admin rights to write). No credential is stored, in GitHub or SSM (user-approved, from ALL-2294).
- **Never applied from CI**: writing environment settings needs repository Administration permission, which `GITHUB_TOKEN` can't be granted, and a stored admin credential for CI is the excessive pipeline privilege OWASP CI/CD Top 10 lists as CICD-SEC-5 (user-approved, from ALL-2294).
- **`terraform/README.md` and `docs/ci-secrets.md` say how to apply, and that the branch rules now come from the trust map** (user-approved, from ALL-2294).
- **Done when** `terraform plan` after the import shows no changes, and a test change to one role's trust shows both the IAM and the GitHub rule changing in one plan (user-approved, from ALL-2294).

## Provider lock file

- **Commit `terraform/.terraform.lock.hcl`**, locked for macOS arm64 and Linux amd64, and stop ignoring it, closing ALL-1970 (agent-proposed, user-approved; HashiCorp recommends committing it).

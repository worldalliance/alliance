# Evidence

## Research (2026-11-17)

Gathered by a Claude researcher subagent and checked by a Codex second opinion.

- `github_repository_environment` defaults `can_admins_bypass` to true and `prevent_self_review` to false; omitting `deployment_branch_policy` lets every branch deploy; import id `repo:env`. [docs](https://github.com/integrations/terraform-provider-github/blob/v6.13.0/docs/resources/repository_environment.md), [source](https://github.com/integrations/terraform-provider-github/blob/v6.13.0/github/resource_github_repository_environment.go). Vendor documentation.
- `github_repository_environment_deployment_policy` takes one of `branch_pattern` or `tag_pattern`; switching between them recreates it; import id `repo:env:<policy_id>`. The older `github_repository_deployment_branch_policy` is deprecated. [docs](https://github.com/integrations/terraform-provider-github/blob/v6.13.0/docs/resources/repository_environment_deployment_policy.md). Vendor documentation.
- Open provider bug: creating a pattern that already exists stores `policy_id = 0` and plans a create forever; importing existing policies avoids it. [#3611](https://github.com/integrations/terraform-provider-github/issues/3611). Vendor issue tracker.
- With no `token` and no `GITHUB_TOKEN`, the provider runs `gh auth token` itself. [provider.go](https://github.com/integrations/terraform-provider-github/blob/v6.13.0/github/provider.go). Vendor source.
- Writing environments and branch policies needs Administration: write; the Actions `GITHUB_TOKEN` can't be granted Administration. [permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens), [workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax). Vendor documentation.
- GitHub accepts `refs/pull/*/merge` as a deployment branch rule. [deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments). Vendor documentation.
- HashiCorp recommends keeping import blocks after import as a historical artifact. [import](https://developer.hashicorp.com/terraform/language/import/single-resource). Vendor recommendation.
- HashiCorp recommends committing `.terraform.lock.hcl`. [dependency lock](https://developer.hashicorp.com/terraform/language/files/dependency-lock). Vendor recommendation.

## Live state (read-only GitHub API, 2026-11-17)

Every environment below has `can_admins_bypass` true, custom branch policies, and no other protection rule. Policies (id, name):

- `pr-screenshots`: 65811615 `refs/pull/*/merge`
- `staging`: 65811619 `main`
- `production`: 65811620 `main`, 65811621 `production`
- `staging-hosts`: 65811616 `main`
- `production-hosts`: 65811617 `production`

`staging-live` and `production-live` have no branch policy. These match the trust map in `terraform/ci-oidc.tf` on `main` at 75705e1e6e.

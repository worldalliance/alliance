provider "github" {
  owner = local.github_owner
}

locals {
  github_environment_sub_prefix = "${local.github_sub_prefix}:environment:"

  # A second role trusting the same environment fails as a duplicate key.
  github_environment_refs = {
    for trust in flatten([for role in values(local.ci_roles) : [for sub, refs in role.trust : { sub = sub, refs = refs }]]) :
    trimprefix(trust.sub, local.github_environment_sub_prefix) => trust.refs
    if startswith(trust.sub, local.github_environment_sub_prefix)
  }

  github_deployment_policies = merge([
    for environment, refs in local.github_environment_refs : {
      for ref in refs : "${environment}:${trimprefix(ref, "refs/heads/")}" => { environment = environment, branch = trimprefix(ref, "refs/heads/") }
    }
  ]...)
}

resource "github_repository_environment" "ci" {
  for_each = local.github_environment_refs

  repository  = local.github_repo_name
  environment = each.key

  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }

  lifecycle {
    # Deleting an environment deletes its deployment history.
    prevent_destroy = true

    # IAM and GitHub read wildcards differently, and tags aren't branches.
    precondition {
      condition     = alltrue([for ref in each.value : ref == "refs/pull/*/merge" || can(regex("^refs/heads/[^*?[]+$", ref))])
      error_message = "Environment ${each.key} is trusted for a ref other than a literal refs/heads/<branch> or refs/pull/*/merge, which its branch rules can't match the way IAM does."
    }
  }
}

resource "github_repository_environment_deployment_policy" "ci" {
  for_each = local.github_deployment_policies

  repository     = local.github_repo_name
  environment    = github_repository_environment.ci[each.value.environment].environment
  branch_pattern = each.value.branch
}

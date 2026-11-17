import {
  for_each = toset(["pr-screenshots", "staging", "production", "staging-hosts", "production-hosts"])
  to       = github_repository_environment.ci[each.key]
  id       = "${local.github_repo_name}:${each.key}"
}

import {
  for_each = {
    "pr-screenshots:refs/pull/*/merge" = 65811615
    "staging-hosts:main"               = 65811616
    "production-hosts:production"      = 65811617
    "staging:main"                     = 65811619
    "production:main"                  = 65811620
    "production:production"            = 65811621
  }
  to = github_repository_environment_deployment_policy.ci[each.key]
  id = "${local.github_repo_name}:${split(":", each.key)[0]}:${each.value}"
}

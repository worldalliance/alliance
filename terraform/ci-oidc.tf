locals {
  github_oidc         = "token.actions.githubusercontent.com"
  github_repo         = "worldalliance/alliance"
  github_sub_prefix   = "repo:${local.github_repo}"
  github_repo_id      = "968852531"
  github_repo_owner   = "214721520"
  ci_parameter_prefix = "${local.ssm_parameter_arn}/alliance"

  ci_shared_parameters = ["ci/shared/SLACK_WEBHOOK_URL_DEPLOYMENT"]
  ci_deploy_parameters = ["ci/deploy/POSTHOG_SOURCEMAP_KEY", "ci/deploy/EXPO_ACCESS_TOKEN"]

  ci_roles = {
    review = {
      test = "StringLike"
      # A pull_request_target run carries the pull_request subject with a
      # branch ref, so each subject is paired with its own refs.
      trust = {
        "${local.github_sub_prefix}:ref:refs/heads/*" = ["refs/heads/*"]
        "${local.github_sub_prefix}:pull_request"     = ["refs/pull/*/merge"]
      }
      parameters = concat(local.ci_shared_parameters, [
        "ci/review/CLAUDE_CODE_OAUTH_TOKEN",
        "ci/review/OPENAI_API_KEY",
        "ci/review/SLACK_WEBHOOK_URL_CLA",
      ])
      max_session_duration = 3600
    }
    # The PR screenshots post job's environment, kept apart from review
    # because review jobs run untrusted code that can assume their role.
    pr-screenshots = {
      test                 = "StringLike"
      trust                = { "${local.github_sub_prefix}:environment:pr-screenshots" = ["refs/pull/*/merge"] }
      parameters           = ["ci/pr-screenshots/PR_SCREENSHOTS_GH_TOKEN"]
      max_session_duration = 3600
    }
    staging = {
      test  = "StringEquals"
      trust = { "${local.github_sub_prefix}:environment:staging" = ["refs/heads/main"] }
      parameters = concat(local.ci_shared_parameters, local.ci_deploy_parameters, [
        "staging/ci/ASC_API_ISSUER_ID",
        "staging/ci/ASC_API_KEY_ID",
        "staging/ci/ASC_API_KEY_P8_BASE64",
        "staging/ci/PLAY_SERVICE_ACCOUNT_JSON",
      ])
      max_session_duration = 3600
    }
    production = {
      test                 = "StringEquals"
      trust                = { "${local.github_sub_prefix}:environment:production" = ["refs/heads/main", "refs/heads/production"] }
      parameters           = concat(local.ci_shared_parameters, local.ci_deploy_parameters)
      max_session_duration = 3600
    }
    # Run Command is a root shell on the host, so only deploy.yaml's jobs
    # deploying to a host can assume these. run-on-host polls for over two
    # hours on one session.
    staging-hosts = {
      test                 = "StringEquals"
      trust                = { "${local.github_sub_prefix}:environment:staging-hosts" = ["refs/heads/main"] }
      workflows            = { "${local.github_sub_prefix}:environment:staging-hosts" = "${local.github_repo}/.github/workflows/deploy.yaml@refs/heads/main" }
      parameters           = []
      max_session_duration = 10800
    }
    production-hosts = {
      test                 = "StringEquals"
      trust                = { "${local.github_sub_prefix}:environment:production-hosts" = ["refs/heads/production"] }
      workflows            = { "${local.github_sub_prefix}:environment:production-hosts" = "${local.github_repo}/.github/workflows/deploy.yaml@refs/heads/production" }
      parameters           = []
      max_session_duration = 10800
    }
  }
}

# AWS validates GitHub's certificate against its own trusted CAs and ignores
# these thumbprints; provider 4.x still requires the argument.
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://${local.github_oidc}"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]
}

data "aws_iam_policy_document" "ci_assume" {
  for_each = local.ci_roles

  dynamic "statement" {
    for_each = each.value.trust
    content {
      actions = ["sts:AssumeRoleWithWebIdentity"]
      principals {
        type        = "Federated"
        identifiers = [aws_iam_openid_connect_provider.github.arn]
      }
      condition {
        test     = "StringEquals"
        variable = "${local.github_oidc}:aud"
        values   = ["sts.amazonaws.com"]
      }
      condition {
        test     = "StringEquals"
        variable = "${local.github_oidc}:repository_id"
        values   = [local.github_repo_id]
      }
      condition {
        test     = "StringEquals"
        variable = "${local.github_oidc}:repository_owner_id"
        values   = [local.github_repo_owner]
      }
      condition {
        test     = each.value.test
        variable = "${local.github_oidc}:sub"
        values   = [statement.key]
      }
      condition {
        test     = each.value.test
        variable = "${local.github_oidc}:ref"
        values   = statement.value
      }
      dynamic "condition" {
        for_each = contains(keys(each.value), "workflows") ? [each.value.workflows[statement.key]] : []
        content {
          test     = "StringEquals"
          variable = "${local.github_oidc}:job_workflow_ref"
          values   = [condition.value]
        }
      }
    }
  }
}

resource "aws_iam_role" "ci" {
  for_each = local.ci_roles

  name                 = "alliance-ci-${each.key}"
  assume_role_policy   = data.aws_iam_policy_document.ci_assume[each.key].json
  max_session_duration = each.value.max_session_duration
}

# By name, so a parameter added later under the same prefix stays unreadable
# until it is granted here.
resource "aws_iam_role_policy" "ci_parameters" {
  for_each = { for k, v in local.ci_roles : k => v if length(v.parameters) > 0 }

  name = "ci-parameters-read"
  role = aws_iam_role.ci[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action   = ["ssm:GetParameters"]
      Effect   = "Allow"
      Resource = [for p in each.value.parameters : "${local.ci_parameter_prefix}/${p}"]
    }]
  })
}

resource "aws_iam_role_policy" "ci_deploy" {
  for_each = local.deploy_hosts

  name = "ci-deploy"
  role = aws_iam_role.ci["${each.key}-hosts"].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "DeployArtifacts"
        Action   = ["s3:PutObject", "s3:GetObject"]
        Effect   = "Allow"
        Resource = ["${aws_s3_bucket.deploy_artifacts.arn}/${each.key}/*"]
      },
      {
        Sid       = "ListDeployOutput"
        Action    = ["s3:ListBucket"]
        Effect    = "Allow"
        Resource  = [aws_s3_bucket.deploy_artifacts.arn]
        Condition = { StringLike = { "s3:prefix" = ["${each.key}/*"] } }
      },
      {
        Sid    = "RunOnHost"
        Action = ["ssm:SendCommand"]
        Effect = "Allow"
        # IAM may check the output bucket too: the service authorization
        # reference lists it among SendCommand's resources.
        Resource = [
          each.value.instance,
          "arn:aws:ssm:us-west-2::document/AWS-RunShellScript",
          aws_s3_bucket.deploy_artifacts.arn,
        ]
      },
      {
        # GetCommandInvocation has no resource-level permissions.
        Sid      = "ReadCommandResult"
        Action   = ["ssm:GetCommandInvocation"]
        Effect   = "Allow"
        Resource = ["*"]
      },
    ]
  })
}

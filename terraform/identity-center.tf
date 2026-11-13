locals {
  sso_instance_arn  = one(data.aws_ssoadmin_instances.sso.arns)
  sso_account       = "751910243706"
  dev_parameter_arn = "${local.ssm_parameter_arn}/alliance/dev"
}

data "aws_ssoadmin_instances" "sso" {}

resource "aws_ssoadmin_permission_set" "dev" {
  name             = "alliance-dev"
  description      = "Daily login for local development and agents"
  instance_arn     = local.sso_instance_arn
  session_duration = "PT1H"
}

data "aws_iam_policy_document" "sso_dev" {
  statement {
    sid       = "DevSecrets"
    actions   = ["ssm:GetParametersByPath"]
    resources = [local.dev_parameter_arn, "${local.dev_parameter_arn}/*"]
  }

  statement {
    sid = "DevAssets"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
      "s3:ListBucket",
      "s3:AbortMultipartUpload",
    ]
    resources = [aws_s3_bucket.dev_assets.arn, "${aws_s3_bucket.dev_assets.arn}/*"]
  }

  statement {
    sid = "AgentTranscripts"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:ListBucket",
      "s3:AbortMultipartUpload",
    ]
    resources = [aws_s3_bucket.agent_chats.arn, "${aws_s3_bucket.agent_chats.arn}/*"]
  }
}

resource "aws_ssoadmin_permission_set_inline_policy" "dev" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.dev.arn
  inline_policy      = data.aws_iam_policy_document.sso_dev.json
}

resource "aws_identitystore_group" "dev" {
  identity_store_id = one(data.aws_ssoadmin_instances.sso.identity_store_ids)
  display_name      = "alliance-dev"
  description       = "Gets the alliance-dev login. Members are managed in this console, not Terraform."
}

resource "aws_ssoadmin_account_assignment" "dev" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.dev.arn
  principal_type     = "GROUP"
  principal_id       = aws_identitystore_group.dev.group_id
  target_type        = "AWS_ACCOUNT"
  target_id          = local.sso_account
}

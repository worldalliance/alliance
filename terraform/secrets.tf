# Each backend reads only its own environment's parameters under
# /alliance/<env>/server/, through scripts/secrets_run.sh. They are
# SecureStrings under the AWS managed aws/ssm key, whose key policy lets SSM
# decrypt for any caller in the account, so the roles need no KMS grant.
# AWS's docs don't say whether GetParametersByPath is authorized against the
# path or the parameters under it, so each grant names both.
# The parameters themselves stay out of Terraform, so their values never
# reach the state file.

locals {
  ssm_parameter_arn = "arn:aws:ssm:us-west-2:751910243706:parameter"
}

resource "aws_iam_role_policy" "ec2_secrets_policy" {
  name = "ec2-secrets-read"
  role = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = ["ssm:GetParametersByPath"]
      Effect = "Allow"
      Resource = [
        "${local.ssm_parameter_arn}/alliance/prod/server",
        "${local.ssm_parameter_arn}/alliance/prod/server/*",
      ]
    }]
  })
}

resource "aws_iam_role_policy" "ec2_secrets_policy_staging" {
  name = "ec2-secrets-read-staging"
  role = aws_iam_role.ec2_role_staging.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = ["ssm:GetParametersByPath"]
      Effect = "Allow"
      Resource = [
        "${local.ssm_parameter_arn}/alliance/staging/server",
        "${local.ssm_parameter_arn}/alliance/staging/server/*",
      ]
    }]
  })
}

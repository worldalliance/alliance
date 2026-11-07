resource "aws_s3_bucket" "deploy_artifacts" {
  bucket = "alliance-deploy-artifacts-${random_id.bucket_suffix.hex}"
  tags = {
    Name = "alliance-deploy-artifacts"
  }
}

resource "aws_s3_bucket_public_access_block" "deploy_artifacts" {
  bucket                  = aws_s3_bucket.deploy_artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "deploy_artifacts" {
  bucket = aws_s3_bucket.deploy_artifacts.id

  rule {
    id     = "expire-deploy-artifacts"
    status = "Enabled"
    filter {}
    expiration {
      days = 1
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

locals {
  deploy_hosts = {
    staging = {
      instance = aws_instance.app_server_staging.arn
      role     = aws_iam_role.ec2_role_staging.id
    }
    production = {
      instance = aws_instance.app_server.arn
      role     = aws_iam_role.ec2_role.id
    }
  }
}

# Not AmazonSSMManagedInstanceCore: it allows ssm:GetParameters on every
# parameter, which would let the staging host read production's secrets.
resource "aws_iam_role_policy" "ec2_run_command" {
  for_each = local.deploy_hosts

  name = "ec2-run-command"
  role = each.value.role

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SsmAgent"
        Effect = "Allow"
        Action = [
          "ssm:UpdateInstanceInformation",
          "ec2messages:AcknowledgeMessage",
          "ec2messages:DeleteMessage",
          "ec2messages:FailMessage",
          "ec2messages:GetEndpoint",
          "ec2messages:GetMessages",
          "ec2messages:SendReply",
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel",
        ]
        Resource = ["*"]
      },
      {
        # AWS requires this to write Run Command output to an encrypted bucket.
        Sid      = "DeployArtifactsEncryption"
        Effect   = "Allow"
        Action   = ["s3:GetEncryptionConfiguration"]
        Resource = [aws_s3_bucket.deploy_artifacts.arn]
      },
      {
        Sid      = "ListDeployArtifacts"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = [aws_s3_bucket.deploy_artifacts.arn]
        Condition = {
          StringLike = { "s3:prefix" = ["${each.key}/*"] }
        }
      },
      {
        Sid      = "DeployArtifactObjects"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = ["${aws_s3_bucket.deploy_artifacts.arn}/${each.key}/*"]
      },
    ]
  })
}

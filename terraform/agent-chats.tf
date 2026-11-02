resource "aws_s3_bucket" "agent_chats" {
  bucket = "alliance-agent-chats"
  tags = {
    Name        = "alliance-agent-chats"
    Environment = "prod"
  }
}

resource "aws_s3_bucket_public_access_block" "agent_chats" {
  bucket                  = aws_s3_bucket.agent_chats.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "agent_chats" {
  bucket = aws_s3_bucket.agent_chats.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "agent_chats" {
  bucket     = aws_s3_bucket.agent_chats.id
  depends_on = [aws_s3_bucket_versioning.agent_chats]

  rule {
    id     = "expire-overwritten-uploads"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }

  rule {
    id     = "abort-incomplete-multipart-uploads"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 3
    }
  }
}

resource "aws_iam_user" "agent_chats" {
  name = "alliance-agent-chats"
  tags = {
    Purpose = "Agent chat transcript uploads and reads"
  }
}

data "aws_iam_policy_document" "agent_chats" {
  statement {
    sid    = "AllowAgentChatsUploadDownload"
    effect = "Allow"

    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:ListBucket",
      "s3:AbortMultipartUpload"
    ]

    resources = [
      aws_s3_bucket.agent_chats.arn,
      "${aws_s3_bucket.agent_chats.arn}/*"
    ]
  }
}

resource "aws_iam_user_policy" "agent_chats" {
  name   = "alliance-agent-chats-s3"
  user   = aws_iam_user.agent_chats.name
  policy = data.aws_iam_policy_document.agent_chats.json
}

resource "aws_iam_access_key" "agent_chats" {
  user = aws_iam_user.agent_chats.name
}

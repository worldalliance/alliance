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

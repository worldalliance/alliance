# ─── Visual Regression Screenshot Storage ───────────────────────────

resource "aws_s3_bucket_public_access_block" "ci_storage" {
  bucket                  = aws_s3_bucket.ci_storage.id
  block_public_policy     = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "ci_storage_policy" {
  statement {
    sid    = "AllowCIStorageAccess"
    effect = "Allow"

    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
      "s3:ListBucket"
    ]

    resources = [
      aws_s3_bucket.ci_storage.arn,
      "${aws_s3_bucket.ci_storage.arn}/*"
    ]
  }
}

resource "aws_iam_user_policy" "dev_ci_storage" {
  name   = "alliance-dev-ci-storage"
  user   = aws_iam_user.dev.name
  policy = data.aws_iam_policy_document.ci_storage_policy.json
}

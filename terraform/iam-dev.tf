resource "aws_iam_user" "dev" {
  name = "alliance-dev"
  tags = {
    Purpose = "Local development"
  }
}

# Inline policy that lets the user do exactly what your server does
data "aws_iam_policy_document" "dev_s3_policy" {
  statement {
    sid    = "AllowUploadDownloadToAssetsBucket"
    effect = "Allow"

    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
      "s3:ListBucket"
    ]

    resources = [
      aws_s3_bucket.assets.arn,
      "${aws_s3_bucket.assets.arn}/*"
    ]
  }
}

resource "aws_iam_user_policy" "dev_inline" {
  name   = "alliance-dev-s3"
  user   = aws_iam_user.dev.name
  policy = data.aws_iam_policy_document.dev_s3_policy.json
}

resource "aws_iam_access_key" "dev" {
  user = aws_iam_user.dev.name
}
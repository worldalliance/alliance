terraform {
  backend "s3" {
    bucket       = "alliance-terraform-state-751910243706"
    key          = "terraform.tfstate"
    region       = "us-west-2"
    encrypt      = true
    use_lockfile = true
  }
}

resource "aws_s3_bucket" "terraform_state" {
  bucket = "alliance-terraform-state-751910243706"
  tags = {
    Name        = "alliance-terraform-state-751910243706"
    Environment = "prod"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

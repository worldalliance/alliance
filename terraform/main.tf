terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
  required_version = ">= 1.2.0"
}

provider "aws" {
  region = "us-west-2"
  #shared_credentials_files = [".aws/credentials"]
}

resource "aws_key_pair" "ssh-key" {
  key_name   = "ssh-key"
  public_key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOz1KSgclpafFCsqUAoZLv8hkOFTXzNCFRNOLx9kyKdy"
}

resource "aws_security_group" "ec2_security_group" {
  name        = "ec2 security group"
  description = "allow access on ports 80 and 22"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "http access"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "desktop access"
    from_port   = 8443
    to_port     = 8443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "https access"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "ssh access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = -1
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "ssr app internal"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"] # only within VPC
  }

  ingress {
    description      = "node_exporter from monitoring"
    from_port        = 9100
    to_port          = 9100
    protocol         = "tcp"
    security_groups  = [aws_security_group.monitoring_sg.id]
    cidr_blocks = ["10.0.0.0/16"]
  }

  ingress {
    description = "nest backend"
    from_port   = 3005
    to_port     = 3005
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  tags = {
    Name = "aws server sg"
  }
}

resource "aws_instance" "app_server" {
  ami           = "ami-05572e392e80aee89"
  instance_type = "t3a.medium"
  subnet_id = module.vpc.public_subnets[0]
  vpc_security_group_ids     = [aws_security_group.ec2_security_group.id]
  iam_instance_profile = aws_iam_instance_profile.ec2_profile.name  
  associate_public_ip_address = true
  key_name = "ssh-key"

  user_data = ""
  user_data_replace_on_change = true

  root_block_device {
    volume_type = "gp3"
    volume_size = 30
    # iops      = 3000
    # throughput= 125
    delete_on_termination = true
    tags = {
      Name = "AllianceServerRoot"
    }
  }

  tags = {
    Name = "AllianceServerInstance"
  }
  lifecycle {
    ignore_changes = [
      associate_public_ip_address,
    ]
  }
}

resource "aws_eip" "app_eip" {
  instance = aws_instance.app_server.id
  vpc      = true
}

data "aws_availability_zones" "available" {}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "2.77.0"

  name                 = "alliance"
  cidr                 = "10.0.0.0/16"
  azs                  = data.aws_availability_zones.available.names
  public_subnets       = ["10.0.4.0/24", "10.0.5.0/24", "10.0.6.0/24"]
  private_subnets      = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  
  enable_nat_gateway   = false
  single_nat_gateway   = true
  enable_dns_hostnames = true
  enable_dns_support   = true
}

resource "aws_db_subnet_group" "alliance" {
  name       = "alliance"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name = "alliance"
  }
}

resource "aws_security_group" "rds" {
  name   = "alliance_rds"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port                = 5432
    to_port                  = 5432
    protocol                 = "tcp"
    security_groups          = [aws_security_group.ec2_security_group.id]
  }

  egress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "alliance_rds"
  }
}

resource "aws_db_parameter_group" "alliance" {
  name   = "alliance"
  family = "postgres17"

  parameter {
    name  = "log_connections"
    value = "1"
  }
}

resource "random_id" "db_suffix" {
  byte_length = 3
}

resource "aws_db_instance" "alliance" {
  identifier             = "alliance"
  db_name                = "alliance"
  instance_class         = "db.t3.micro"
  allocated_storage      = 10 # changes won't apply without apply_immediately = true
  engine                 = "postgres"
  engine_version         = "17"
  username               = "edu"
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.alliance.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.alliance.name
  publicly_accessible    = false

  snapshot_identifier    = "rds:alliance-2025-09-19-12-03"

  deletion_protection        = true
  skip_final_snapshot        = false
  final_snapshot_identifier  = "alliance-final-${random_id.db_suffix.hex}"

  backup_retention_period = 7
  copy_tags_to_snapshot   = true
}

resource "random_id" "bucket_suffix" {
  byte_length = 4        # 8-char hex string
}

resource "aws_s3_bucket" "assets" {
  bucket        = "alliance-assets-${random_id.bucket_suffix.hex}"
  force_destroy = true
  tags = {
    Name        = "alliance-assets"
    Environment = "prod"
  }
}

resource "aws_s3_bucket" "dev_assets" {
  bucket        = "alliance-assets-dev-${random_id.bucket_suffix.hex}"
  force_destroy = true
  tags = {
    Name        = "alliance-dev-assets"
    Environment = "dev"
  }
}


resource "aws_s3_bucket" "ci_storage" {
  bucket        = "alliance-ci-storage-${random_id.bucket_suffix.hex}"
  force_destroy = true
  tags = {
    Name        = "alliance-ci-storage"
    Environment = "prod"
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "dev_assets" {
  bucket                  = aws_s3_bucket.dev_assets.id
  block_public_policy     = true
  restrict_public_buckets = true
}


resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_cloudfront_origin_access_control" "assets" {
  name                              = "alliance-assets-oac"
  description                       = "OAC for alliance assets bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_response_headers_policy" "cors" {
  name = "alliance-cors-policy"

  cors_config {
    access_control_allow_origins {
      items = [
        "https://thealliance.org",
        "https://admin.thealliance.org",
        "https://worldalliance.org",
        "https://admin.worldalliance.org",
      ]
    }
    access_control_allow_methods {
      items = ["GET", "HEAD", "OPTIONS"]
    }
    access_control_allow_headers {
      items = ["*"]
    }
    access_control_max_age_sec = 3000
    origin_override            = true
    access_control_allow_credentials = false
  }
}


# CloudFront distribution
resource "aws_cloudfront_distribution" "assets" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Alliance assets CDN"
  default_root_object = ""
  price_class         = "PriceClass_100"  # US, Canada, Europe only (cheapest)

  origin {
    domain_name              = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id                = "S3-assets"
    origin_access_control_id = aws_cloudfront_origin_access_control.assets.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-assets"
    viewer_protocol_policy = "redirect-to-https"

    # Use managed cache policy for optimized caching
    cache_policy_id          = "658327ea-f89d-4fab-a63d-7e88639e58f6"  # CachingOptimized
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf"  # CORS-S3Origin
    response_headers_policy_id = aws_cloudfront_response_headers_policy.cors.id

    compress = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name        = "alliance-assets-cdn"
    Environment = "prod"
  }
}

# Update S3 bucket policy to allow CloudFront access
resource "aws_s3_bucket_policy" "assets" {
  bucket = aws_s3_bucket.assets.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.assets.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.assets.arn
          }
        }
      }
    ]
  })
}

resource "aws_iam_role" "ec2_role" {
  name               = "alliance-ec2-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "ec2_s3_policy" {
  name = "ec2-s3-access"
  role = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = ["s3:GetObject", "s3:PutObject", "s3:ListBucket", "s3:AbortMultipartUpload", "s3:DeleteObject"]
      Effect   = "Allow"
      Resource = [
        aws_s3_bucket.assets.arn,
        "${aws_s3_bucket.assets.arn}/*",
        aws_s3_bucket.dev_assets.arn,
        "${aws_s3_bucket.dev_assets.arn}/*"
      ]
    }]
  })
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "alliance-ec2-profile"
  role = aws_iam_role.ec2_role.name
}


resource "aws_s3_bucket_cors_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD", "PUT"]
    allowed_origins = [
      "https://thealliance.org",
      "https://admin.thealliance.org",
      "https://worldalliance.org",
      "https://admin.worldalliance.org",
    ]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_cors_configuration" "dev_assets" {
  bucket = aws_s3_bucket.dev_assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD", "PUT"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_cors_configuration" "staging_assets" {
  bucket = aws_s3_bucket.staging_assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD", "PUT"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# ---- Lifecycle configurations ----

resource "aws_s3_bucket_lifecycle_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    id     = "abort-incomplete-multipart-uploads"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 3
    }

    filter {}
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "dev_assets" {
  bucket = aws_s3_bucket.dev_assets.id

  rule {
    id     = "abort-incomplete-multipart-uploads"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 3
    }

    filter {}
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "staging_assets" {
  bucket = aws_s3_bucket.staging_assets.id

  rule {
    id     = "abort-incomplete-multipart-uploads"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 3
    }

    filter {}
  }
}
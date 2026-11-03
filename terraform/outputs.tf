output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.app_server.id
}

output "server_ip" {
  value = aws_eip.app_eip.public_ip
}

output "rds_hostname" {
  description = "RDS instance hostname"
  value       = aws_db_instance.alliance.address
  #sensitive   = true
}

output "rds_port" {
  description = "RDS instance port"
  value       = aws_db_instance.alliance.port
  #sensitive   = true
}

output "rds_username" {
  description = "RDS instance root username"
  value       = aws_db_instance.alliance.username
  #sensitive   = true
}

output "assets_bucket_name" {
  description = "S3 bucket used for static assets and uploads"
  value       = aws_s3_bucket.assets.bucket
}

output "dev_assets_bucket_name" {
  description = "S3 bucket used for static assets and uploads"
  value       = aws_s3_bucket.dev_assets.bucket
}

output "dev_access_key_id" {
  value = aws_iam_access_key.dev.id
  sensitive   = true
}

output "dev_secret_access_key" {
  value       = aws_iam_access_key.dev.secret
  sensitive   = true
}

output "app_server_private_ip" {
  value = aws_instance.app_server.private_ip
}

# ---------- STAGING ----------
output "staging_instance_id" {
  description = "ID of the staging EC2 instance"
  value       = aws_instance.app_server_staging.id
}

output "staging_server_ip" {
  description = "Public IP (EIP) of the staging EC2 instance"
  value       = aws_eip.app_eip_staging.public_ip
}

output "staging_rds_hostname" {
  description = "Staging RDS instance hostname"
  value       = aws_db_instance.alliance_staging.address
}

output "staging_rds_port" {
  description = "Staging RDS instance port"
  value       = aws_db_instance.alliance_staging.port
}

output "staging_rds_username" {
  description = "Staging RDS master username"
  value       = aws_db_instance.alliance_staging.username
  # If you restored from a snapshot, this may come from the snapshot's master user.
}

output "staging_assets_bucket_name" {
  description = "S3 bucket used for staging static assets and uploads"
  value       = aws_s3_bucket.staging_assets.bucket
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.assets.domain_name
}

output "cloudfront_domain_staging" {
  value = aws_cloudfront_distribution.staging_assets.domain_name
}

output "metrics_server_ip" {
    value = aws_eip.monitoring_eip.public_ip
}

output "ci_storage_bucket_name" {
  description = "S3 bucket used for CI storage (visual regression baselines, etc.)"
  value       = aws_s3_bucket.ci_storage.bucket
}

output "agent_chats_bucket_name" {
  description = "S3 bucket holding Claude Code and Codex session transcripts"
  value       = aws_s3_bucket.agent_chats.bucket
}

output "agent_chats_access_key_id" {
  value     = aws_iam_access_key.agent_chats.id
  sensitive = true
}

output "agent_chats_secret_access_key" {
  value     = aws_iam_access_key.agent_chats.secret
  sensitive = true
}

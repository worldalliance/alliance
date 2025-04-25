terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16"
    }
  }
  required_version = ">= 1.2.0"
}

provider "aws" {
  region = "us-west-2"
  #shared_credentials_files = [".aws/credentials"]
}

resource "aws_default_vpc" "default_vpc" {
  tags = {
    Name = "default vpc"
  }
}

resource "aws_key_pair" "ssh-key" {
  key_name   = "ssh-key"
  public_key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOz1KSgclpafFCsqUAoZLv8hkOFTXzNCFRNOLx9kyKdy"
}

resource "aws_security_group" "ec2_security_group" {
  name        = "ec2 security group"
  description = "allow access on ports 80 and 22"
  vpc_id      = aws_default_vpc.default_vpc.id

  ingress {
    description = "http access"
    from_port   = 80
    to_port     = 80
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

  tags = {
    Name = "aws server sg"
  }
}

resource "aws_instance" "app_server" {
  ami           = "ami-05572e392e80aee89"
  instance_type = "t2.micro"
  vpc_security_group_ids     = [aws_security_group.ec2_security_group.id]
  associate_public_ip_address = true
  key_name = "ssh-key"

    user_data = <<-EOF
    #!/bin/bash
    sudo yum install git -y
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    source ~/.bashrc
    nvm install --lts
    git clone https://github.com/CaseyManning/alliance.git /home/ec2-user/app
    cd /home/ec2-user/app
    npm install
    npm run build # if applicable
    npm start &
  EOF

  tags = {
    Name = "AllianceServerInstance"
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
  enable_dns_hostnames = true
  enable_dns_support   = true
}

resource "aws_db_subnet_group" "alliance" {
  name       = "alliance"
  subnet_ids = module.vpc.public_subnets

  tags = {
    Name = "alliance"
  }
}

resource "aws_security_group" "rds" {
  name   = "alliance_rds"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
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

resource "aws_db_instance" "alliance" {
  identifier             = "alliance"
  instance_class         = "db.t3.micro"
  allocated_storage      = 5
  engine                 = "postgres"
  engine_version         = "17"
  username               = "edu"
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.alliance.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.alliance.name
  publicly_accessible    = true
  skip_final_snapshot    = true
}
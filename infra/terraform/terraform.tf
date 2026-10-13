terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    encrypt              = true
    bucket               = "medallia-webhook-demo-terraform-state-storage-s3"
    use_lockfile         = true
    region               = "us-east-1"
    key                  = "terraform.tfstate"
    workspace_key_prefix = "distribution-webhook"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
  }
}

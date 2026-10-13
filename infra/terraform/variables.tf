variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used in resource naming"
  type        = string
  default     = "distribution-webhook"
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "dev"
}

variable "fcm_service_account_json" {
  description = "Firebase service account JSON used by the push worker Lambda"
  type        = string
  sensitive   = true
  default     = "{\"type\":\"service_account\",\"project_id\":\"replace-me\"}"
}

variable "medallia_oauth_token_url" {
  description = "Optional OAuth token URL for outbound Medallia status callbacks"
  type        = string
  default     = ""
}

variable "medallia_oauth_client_id" {
  description = "Optional OAuth client ID for outbound Medallia status callbacks"
  type        = string
  default     = ""
  sensitive   = true
}

variable "medallia_oauth_client_secret" {
  description = "Optional OAuth client secret for outbound Medallia status callbacks"
  type        = string
  default     = ""
  sensitive   = true
}

variable "hash_hmac_key" {
  description = "HMAC key for keyed contact ID hashing. Leave empty to use plain SHA-256 (backward compatible). Must re-hash existing DB entries before enabling."
  type        = string
  sensitive   = true
  default     = ""
}

variable "callback_url_allowlist" {
  description = "Regex pattern for allowed status callback URLs. Defaults to *.medallia.com in app code if empty."
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

variable "enable_api_gateway_logging" {
  description = "Enable API Gateway access logging to CloudWatch"
  type        = bool
  default     = true
}

variable "app_bundle_id" {
  description = "App bundle identifier used for APNs-to-FCM token conversion"
  type        = string
  default     = "com.medallia.demo.mecwebhook"
}

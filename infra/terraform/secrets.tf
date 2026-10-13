resource "random_password" "webhook_password" {
  length  = 32
  special = false
}

resource "random_password" "device_api_key" {
  length  = 40
  special = false
}

resource "aws_secretsmanager_secret" "webhook_basic_auth" {
  name = "${local.name_prefix}-webhook-basic-auth"
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "webhook_basic_auth" {
  secret_id = aws_secretsmanager_secret.webhook_basic_auth.id
  secret_string = jsonencode({
    username = "webhook-user"
    password = random_password.webhook_password.result
  })
}

resource "aws_secretsmanager_secret" "device_api_key" {
  name = "${local.name_prefix}-device-api-key"
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "device_api_key" {
  secret_id     = aws_secretsmanager_secret.device_api_key.id
  secret_string = random_password.device_api_key.result
}

resource "aws_secretsmanager_secret" "fcm_service_account" {
  name = "${local.name_prefix}-fcm-service-account"
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "fcm_service_account" {
  secret_id     = aws_secretsmanager_secret.fcm_service_account.id
  secret_string = var.fcm_service_account_json
}

resource "aws_secretsmanager_secret" "hash_hmac_key" {
  count = var.hash_hmac_key != "" ? 1 : 0
  name  = "${local.name_prefix}-hash-hmac-key"
  tags  = local.common_tags
}

resource "aws_secretsmanager_secret_version" "hash_hmac_key" {
  count         = var.hash_hmac_key != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.hash_hmac_key[0].id
  secret_string = var.hash_hmac_key
}

resource "aws_secretsmanager_secret" "medallia_oauth" {
  count = var.medallia_oauth_token_url != "" ? 1 : 0
  name  = "${local.name_prefix}-medallia-oauth"
  tags  = local.common_tags
}

resource "aws_secretsmanager_secret_version" "medallia_oauth" {
  count     = var.medallia_oauth_token_url != "" ? 1 : 0
  secret_id = aws_secretsmanager_secret.medallia_oauth[0].id
  secret_string = jsonencode({
    token_url     = var.medallia_oauth_token_url
    client_id     = var.medallia_oauth_client_id
    client_secret = var.medallia_oauth_client_secret
  })
}

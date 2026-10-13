resource "aws_cloudwatch_log_group" "distribute" {
  name              = "/aws/lambda/${local.name_prefix}-distribute"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "push_worker" {
  name              = "/aws/lambda/${local.name_prefix}-push-worker"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "device_register" {
  name              = "/aws/lambda/${local.name_prefix}-device-register"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "device_delete" {
  name              = "/aws/lambda/${local.name_prefix}-device-delete"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "delivery_ack" {
  name              = "/aws/lambda/${local.name_prefix}-delivery-ack"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  count             = var.enable_api_gateway_logging ? 1 : 0
  name              = "/aws/apigateway/${local.name_prefix}-api"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

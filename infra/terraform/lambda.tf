data "archive_file" "backend_placeholder" {
  type        = "zip"
  output_path = "${path.module}/../../backend/dist/lambda/placeholder.zip"

  source {
    content  = "exports.handler = async () => ({ statusCode: 503, body: 'Deploy backend bundle before use' });"
    filename = "index.js"
  }
}

locals {
  lambda_environment = {
    DEVICES_TABLE_NAME        = aws_dynamodb_table.devices.name
    MESSAGES_TABLE_NAME       = aws_dynamodb_table.messages.name
    PUSH_QUEUE_URL            = aws_sqs_queue.push.url
    FCM_SECRET_ARN            = aws_secretsmanager_secret.fcm_service_account.arn
    WEBHOOK_AUTH_SECRET_ARN   = aws_secretsmanager_secret.webhook_basic_auth.arn
    DEVICE_API_KEY_SECRET_ARN = aws_secretsmanager_secret.device_api_key.arn
    MEDALLIA_OAUTH_SECRET_ARN = length(aws_secretsmanager_secret.medallia_oauth) > 0 ? aws_secretsmanager_secret.medallia_oauth[0].arn : ""
    CALLBACK_URL_ALLOWLIST    = var.callback_url_allowlist
    HASH_HMAC_SECRET_ARN      = length(aws_secretsmanager_secret.hash_hmac_key) > 0 ? aws_secretsmanager_secret.hash_hmac_key[0].arn : ""
    LOG_REDACTION_ENABLED     = "true"
    APP_BUNDLE_ID             = var.app_bundle_id
  }

  lambda_definitions = {
    distribute = {
      artifact    = "${path.module}/../../backend/dist/lambda/distribute.zip"
      timeout     = 15
      memory_size = 256
    }
    push_worker = {
      artifact    = "${path.module}/../../backend/dist/lambda/pushWorker.zip"
      timeout     = 30
      memory_size = 512
    }
    device_register = {
      artifact    = "${path.module}/../../backend/dist/lambda/deviceRegister.zip"
      timeout     = 10
      memory_size = 256
    }
    device_delete = {
      artifact    = "${path.module}/../../backend/dist/lambda/deviceDelete.zip"
      timeout     = 10
      memory_size = 256
    }
    delivery_ack = {
      artifact    = "${path.module}/../../backend/dist/lambda/deliveryAck.zip"
      timeout     = 10
      memory_size = 256
    }
  }
}

resource "aws_lambda_function" "handlers" {
  for_each = local.lambda_definitions

  function_name = "${local.name_prefix}-${replace(each.key, "_", "-")}"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  timeout       = each.value.timeout
  memory_size   = each.value.memory_size

  filename         = fileexists(each.value.artifact) ? each.value.artifact : data.archive_file.backend_placeholder.output_path
  source_code_hash = fileexists(each.value.artifact) ? filebase64sha256(each.value.artifact) : data.archive_file.backend_placeholder.output_base64sha256

  environment {
    variables = local.lambda_environment
  }

  depends_on = [
    aws_cloudwatch_log_group.distribute,
    aws_cloudwatch_log_group.push_worker,
    aws_cloudwatch_log_group.device_register,
    aws_cloudwatch_log_group.device_delete,
    aws_cloudwatch_log_group.delivery_ack,
  ]

  tags = local.common_tags
}

resource "aws_lambda_event_source_mapping" "push_worker" {
  event_source_arn = aws_sqs_queue.push.arn
  function_name    = aws_lambda_function.handlers["push_worker"].arn
  batch_size       = 1
  enabled          = true
}

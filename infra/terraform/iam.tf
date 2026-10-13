data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_execution" {
  name               = "${local.name_prefix}-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = local.common_tags
}

locals {
  lambda_log_group_arns = [
    aws_cloudwatch_log_group.distribute.arn,
    aws_cloudwatch_log_group.push_worker.arn,
    aws_cloudwatch_log_group.device_register.arn,
    aws_cloudwatch_log_group.device_delete.arn,
    aws_cloudwatch_log_group.delivery_ack.arn,
  ]
}

data "aws_iam_policy_document" "lambda_policy" {
  statement {
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = [for arn in local.lambda_log_group_arns : "${arn}:*"]
  }

  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
    ]
    resources = [
      aws_dynamodb_table.devices.arn,
      aws_dynamodb_table.messages.arn,
    ]
  }

  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.push.arn]
  }

  statement {
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
    ]
    resources = [aws_sqs_queue.push.arn]
  }

  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = compact([
      aws_secretsmanager_secret.fcm_service_account.arn,
      aws_secretsmanager_secret.webhook_basic_auth.arn,
      aws_secretsmanager_secret.device_api_key.arn,
      length(aws_secretsmanager_secret.medallia_oauth) > 0 ? aws_secretsmanager_secret.medallia_oauth[0].arn : "",
      length(aws_secretsmanager_secret.hash_hmac_key) > 0 ? aws_secretsmanager_secret.hash_hmac_key[0].arn : "",
    ])
  }
}

resource "aws_iam_role_policy" "lambda_policy" {
  name   = "${local.name_prefix}-lambda-policy"
  role   = aws_iam_role.lambda_execution.id
  policy = data.aws_iam_policy_document.lambda_policy.json
}


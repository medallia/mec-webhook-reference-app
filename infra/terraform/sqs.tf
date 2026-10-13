resource "aws_sqs_queue" "push_dlq" {
  name                      = "${local.name_prefix}-push-dlq"
  message_retention_seconds = 1209600
  tags                      = local.common_tags
}

resource "aws_sqs_queue" "push" {
  name                       = "${local.name_prefix}-push"
  visibility_timeout_seconds = 60
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.push_dlq.arn
    maxReceiveCount     = 3
  })
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "push_dlq_alarm" {
  alarm_name          = "${local.name_prefix}-push-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Alert when push worker DLQ receives messages"
  dimensions = {
    QueueName = aws_sqs_queue.push_dlq.name
  }
  tags = local.common_tags
}

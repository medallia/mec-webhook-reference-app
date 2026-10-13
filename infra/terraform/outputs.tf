output "api_base_url" {
  description = "Public API Gateway base URL"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "distribute_endpoint" {
  description = "Medallia webhook receiver endpoint"
  value       = "${aws_apigatewayv2_stage.default.invoke_url}/distribute"
}

output "device_register_endpoint" {
  description = "Mobile device registration endpoint"
  value       = "${aws_apigatewayv2_stage.default.invoke_url}/devices/register"
}

output "delivery_ack_endpoint" {
  description = "Mobile delivery acknowledgement endpoint"
  value       = "${aws_apigatewayv2_stage.default.invoke_url}/devices/delivery-ack"
}

output "webhook_basic_auth_username" {
  description = "Inbound webhook Basic Auth username"
  value       = "webhook-user"
}

output "webhook_basic_auth_password" {
  description = "Inbound webhook Basic Auth password"
  value       = random_password.webhook_password.result
  sensitive   = true
}

output "device_api_key" {
  description = "API key used by the mobile app"
  value       = random_password.device_api_key.result
  sensitive   = true
}

output "devices_table_name" {
  description = "DynamoDB table storing device registrations"
  value       = aws_dynamodb_table.devices.name
}

output "messages_table_name" {
  description = "DynamoDB table storing processed message records"
  value       = aws_dynamodb_table.messages.name
}

output "push_queue_url" {
  description = "SQS queue URL for async push processing"
  value       = aws_sqs_queue.push.url
}

output "api_gateway_log_group" {
  description = "CloudWatch log group for API Gateway access logs"
  value       = var.enable_api_gateway_logging ? aws_cloudwatch_log_group.api_gateway[0].name : null
}

output "example_distribute_curl" {
  description = "Example curl command for testing the distribute endpoint"
  value       = "curl -X POST '${aws_apigatewayv2_stage.default.invoke_url}/distribute' -H 'Content-Type: application/cloudevents+json' -u webhook-user:${random_password.webhook_password.result} -d @docs/api/sample-auth-check.json"
  sensitive   = true
}

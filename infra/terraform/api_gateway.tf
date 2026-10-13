resource "aws_apigatewayv2_api" "http" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"
  tags          = local.common_tags

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["POST", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "x-api-key", "Authorization"]
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
  tags        = local.common_tags

  default_route_settings {
    throttling_burst_limit = 50
    throttling_rate_limit  = 20
  }

  dynamic "access_log_settings" {
    for_each = var.enable_api_gateway_logging ? [1] : []
    content {
      destination_arn = aws_cloudwatch_log_group.api_gateway[0].arn
      format = jsonencode({
        requestId          = "$context.requestId"
        ip                 = "$context.identity.sourceIp"
        userAgent          = "$context.identity.userAgent"
        requestTime        = "$context.requestTime"
        httpMethod         = "$context.httpMethod"
        routeKey           = "$context.routeKey"
        path               = "$context.path"
        status             = "$context.status"
        protocol           = "$context.protocol"
        responseLength     = "$context.responseLength"
        latency            = "$context.responseLatency"
        integrationError   = "$context.integrationErrorMessage"
        integrationStatus  = "$context.integrationStatus"
        integrationLatency = "$context.integrationLatency"
        errorMessage       = "$context.error.message"
        errorResponseType  = "$context.error.responseType"
        authorizerError    = "$context.authorizer.error"
        dataProcessed      = "$context.dataProcessed"
      })
    }
  }
}

resource "aws_apigatewayv2_integration" "distribute" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.handlers["distribute"].invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "device_register" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.handlers["device_register"].invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "device_delete" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.handlers["device_delete"].invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "delivery_ack" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.handlers["delivery_ack"].invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "distribute" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /distribute"
  target    = "integrations/${aws_apigatewayv2_integration.distribute.id}"
}

resource "aws_apigatewayv2_route" "device_register" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /devices/register"
  target    = "integrations/${aws_apigatewayv2_integration.device_register.id}"
}

resource "aws_apigatewayv2_route" "device_delete" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "DELETE /devices/{contactId}"
  target    = "integrations/${aws_apigatewayv2_integration.device_delete.id}"
}

resource "aws_apigatewayv2_route" "delivery_ack" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /devices/delivery-ack"
  target    = "integrations/${aws_apigatewayv2_integration.delivery_ack.id}"
}

resource "aws_lambda_permission" "distribute" {
  statement_id  = "AllowAPIGatewayInvokeDistribute"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.handlers["distribute"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_lambda_permission" "device_register" {
  statement_id  = "AllowAPIGatewayInvokeDeviceRegister"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.handlers["device_register"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_lambda_permission" "device_delete" {
  statement_id  = "AllowAPIGatewayInvokeDeviceDelete"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.handlers["device_delete"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_lambda_permission" "delivery_ack" {
  statement_id  = "AllowAPIGatewayInvokeDeliveryAck"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.handlers["delivery_ack"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

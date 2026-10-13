resource "aws_dynamodb_table" "devices" {
  name         = "${local.name_prefix}-devices"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "contactId"

  attribute {
    name = "contactId"
    type = "S"
  }

  tags = local.common_tags
}

resource "aws_dynamodb_table" "messages" {
  name         = "${local.name_prefix}-messages"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "messageId"

  attribute {
    name = "messageId"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = local.common_tags
}

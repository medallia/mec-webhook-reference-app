import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { getConfig } from "../config.js";
import { EventTypes } from "../models/cloudevents.js";
import type { DeliveryAckRequest } from "../models/device.js";
import { getProcessedMessage, updateMessageStatus } from "../services/idempotency.js";
import { postStatusCallback } from "../services/statusCallback.js";
import { validateApiKey } from "../utils/auth.js";
import { buildDistributionUpdate } from "../utils/cloudevents.js";
import { logger } from "../utils/logger.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const config = await getConfig();

  if (!validateApiKey(event, config.deviceApiKey)) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  if (!event.body) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Request body is required" }),
    };
  }

  let request: DeliveryAckRequest;
  try {
    request = JSON.parse(event.body) as DeliveryAckRequest;
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  if (!request.messageId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "messageId is required" }),
    };
  }

  const messageRecord = await getProcessedMessage(
    config.messagesTableName,
    request.messageId,
  );

  if (!messageRecord) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Message not found" }),
    };
  }

  if (messageRecord.status === EventTypes.DELIVERY_DELIVERED) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId: request.messageId,
        status: EventTypes.DELIVERY_DELIVERED,
      }),
    };
  }

  const deliveredUpdate = buildDistributionUpdate({
    messageId: request.messageId,
    traceparent: messageRecord.traceparent,
    type: EventTypes.DELIVERY_DELIVERED,
  });

  await updateMessageStatus(
    config.messagesTableName,
    request.messageId,
    EventTypes.DELIVERY_DELIVERED,
  );

  await postStatusCallback({
    callbackUrl: messageRecord.callbackUrl,
    update: deliveredUpdate,
    oauthTokenUrl: config.medalliaOAuthTokenUrl,
    oauthClientId: config.medalliaOAuthClientId,
    oauthClientSecret: config.medalliaOAuthClientSecret,
  });

  logger.info("Delivery acknowledged", {
    messageId: request.messageId,
    contactId: messageRecord.contactId,
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messageId: request.messageId,
      status: EventTypes.DELIVERY_DELIVERED,
    }),
  };
};

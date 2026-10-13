import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import { getConfig } from "../config.js";
import {
  EventTypes,
  type AuthCheckRequest,
  type CloudEventBase,
  type DistributionRequest,
  type QueueMessage,
  isAuthCheckRequest,
  isDistributionRequest,
} from "../models/cloudevents.js";
import {
  createQueuedMessage,
  getProcessedMessage,
} from "../services/idempotency.js";
import { validateBasicAuth, getHeader } from "../utils/auth.js";
import {
  buildAuthCheckResponse,
  buildDistributionUpdate,
  validateCloudEventEnvelope,
} from "../utils/cloudevents.js";
import { parseJsonBody, jsonResponse, emptyResponse } from "../utils/http.js";
import { isInvitationExpired } from "../utils/locale.js";
import { logger } from "../utils/logger.js";

const sqsClient = new SQSClient({});

const SENSITIVE_HEADERS = new Set(["authorization", "x-api-key", "cookie"]);

function logDistributeRequestMetadata(event: APIGatewayProxyEventV2): void {
  const requestHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (typeof value !== "string") {
      continue;
    }
    requestHeaders[key] = SENSITIVE_HEADERS.has(key.toLowerCase())
      ? "[REDACTED]"
      : value;
  }

  logger.info("Distribute request metadata", {
    httpMethod: event.requestContext?.http?.method,
    path: event.requestContext?.http?.path,
    sourceIp: event.requestContext?.http?.sourceIp,
    contentType: event.headers?.["content-type"],
    requestHeaders,
  });
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const config = await getConfig();

  logDistributeRequestMetadata(event);

  if (!validateBasicAuth(event, {
    username: config.webhookUsername,
    password: config.webhookPassword,
  })) {
    return emptyResponse(401);
  }

  const contentType = getHeader(event, "content-type");
  const allowedContentTypes = ["application/cloudevents+json", "application/json"];
  const normalizedContentType = contentType?.split(";")[0].trim().toLowerCase();

  logger.info("Incoming request", { contentType, normalizedContentType });

  if (!normalizedContentType || !allowedContentTypes.includes(normalizedContentType)) {
    logger.warn("Rejected request: unsupported Content-Type", { contentType });
    return jsonResponse(400, {
      error: "Content-Type must be application/cloudevents+json or application/json",
    });
  }

  let cloudEvent: CloudEventBase;
  try {
    cloudEvent = parseJsonBody<CloudEventBase>(event.body);
    validateCloudEventEnvelope(cloudEvent);
  } catch (error) {
    logger.warn("Invalid CloudEvent payload", {
      errorMessage: error instanceof Error ? error.message : "Invalid payload",
    });
    return jsonResponse(400, { error: "Invalid CloudEvents payload" });
  }

  if (isAuthCheckRequest(cloudEvent as AuthCheckRequest)) {
    const response = buildAuthCheckResponse({
      messageId: cloudEvent.id,
      traceparent: cloudEvent.traceparent,
      success: true,
      debugInfo: {
        handler: "distribute",
      },
    });

    return jsonResponse(200, response);
  }

  if (!isDistributionRequest(cloudEvent as DistributionRequest)) {
    return jsonResponse(400, { error: `Unsupported event type: ${cloudEvent.type}` });
  }

  const distribution = cloudEvent as DistributionRequest;

  if (!distribution.data?.contact_id || !distribution.data?.survey_url || !distribution.data?.callback) {
    return jsonResponse(400, { error: "Missing required invitation data fields" });
  }

  logger.info("Received distribution request", {
    messageId: distribution.id,
    traceparent: distribution.traceparent,
    contactId: distribution.data.contact_id,
    recordType: distribution.data.record_type,
    preferred_locale: distribution.data.preferred_locale,
    messageCount: distribution.data.messages?.length ?? 0,
  });

  const existing = await getProcessedMessage(config.messagesTableName, distribution.id);
  if (existing?.responseBody) {
    return {
      statusCode: existing.status === EventTypes.DELIVERY_QUEUED ? 202 : 200,
      headers: {
        "Content-Type": "application/cloudevents+json",
        "X-RateLimit-Limit": "10, 10;w=1, 100;w=86400",
        "X-RateLimit-Remaining": "9",
        "X-RateLimit-Reset": "60",
      },
      body: existing.responseBody,
    };
  }

  if (isInvitationExpired(distribution.data.expiration_timestamp)) {
    const failedUpdate = buildDistributionUpdate({
      messageId: distribution.id,
      traceparent: distribution.traceparent,
      type: EventTypes.DELIVERY_FAILED,
      error: {
        code: "INVITATION_EXPIRED",
        message: "Survey invitation has expired",
        retryable: false,
      },
    });

    return jsonResponse(200, failedUpdate);
  }

  const queuedUpdate = buildDistributionUpdate({
    messageId: distribution.id,
    traceparent: distribution.traceparent,
    type: EventTypes.DELIVERY_QUEUED,
  });

  const responseBody = JSON.stringify(queuedUpdate);
  const created = await createQueuedMessage({
    tableName: config.messagesTableName,
    messageId: distribution.id,
    traceparent: distribution.traceparent,
    callbackUrl: distribution.data.callback,
    contactId: distribution.data.contact_id,
    surveyId: distribution.data.survey_id,
    recordType: distribution.data.record_type,
    responseBody,
  });

  if (!created) {
    const replay = await getProcessedMessage(config.messagesTableName, distribution.id);
    if (replay?.responseBody) {
      return {
        statusCode: 202,
        headers: {
          "Content-Type": "application/cloudevents+json",
          "X-RateLimit-Limit": "10, 10;w=1, 100;w=86400",
          "X-RateLimit-Remaining": "9",
          "X-RateLimit-Reset": "60",
        },
        body: replay.responseBody,
      };
    }
  }

  const queueMessage: QueueMessage = {
    messageId: distribution.id,
    traceparent: distribution.traceparent,
    distribution,
  };

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: config.pushQueueUrl,
      MessageBody: JSON.stringify(queueMessage),
    }),
  );

  logger.info("Enqueued distribution for async processing", {
    messageId: distribution.id,
    traceparent: distribution.traceparent,
  });

  return jsonResponse(202, queuedUpdate);
};

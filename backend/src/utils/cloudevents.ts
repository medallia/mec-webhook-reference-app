import { v4 as uuidv4 } from "uuid";
import {
  CLIENT_SOURCE,
  EventTypes,
  type AuthCheckResponse,
  type CloudEventBase,
  type DeliveryStatusType,
  type DistributionUpdate,
} from "../models/cloudevents.js";

export function buildDistributionUpdate(params: {
  messageId: string;
  traceparent?: string;
  type: DeliveryStatusType;
  error?: DistributionUpdate["data"]["error"];
  debugInfo?: DistributionUpdate["data"]["debug_info"];
}): DistributionUpdate {
  return {
    specversion: "1.0",
    id: uuidv4(),
    source: CLIENT_SOURCE,
    type: params.type,
    traceparent: params.traceparent,
    time: new Date().toISOString(),
    datacontenttype: "application/json",
    dataschema:
      "https://cdn.medallia.com/cloudevents-schemas/broadcaster-webhook-invitation-update/v1.json",
    data: {
      message_id: params.messageId,
      ...(params.debugInfo ? { debug_info: params.debugInfo } : {}),
      ...(params.error ? { error: params.error } : {}),
    },
  };
}

export function buildAuthCheckResponse(params: {
  messageId: string;
  traceparent?: string;
  success: boolean;
  debugInfo?: AuthCheckResponse["data"]["debug_info"];
}): AuthCheckResponse {
  return {
    specversion: "1.0",
    id: uuidv4(),
    source: CLIENT_SOURCE,
    type: params.success ? EventTypes.AUTH_CHECK_SUCCESS : EventTypes.AUTH_CHECK_ERROR,
    traceparent: params.traceparent,
    time: new Date().toISOString(),
    datacontenttype: "application/json",
    dataschema:
      "https://cdn.medallia.com/cloudevents-schemas/broadcaster-webhook-invitation-update/v1.json",
    data: {
      message_id: params.messageId,
      ...(params.debugInfo ? { debug_info: params.debugInfo } : {}),
    },
  };
}

export function validateCloudEventEnvelope(event: CloudEventBase): void {
  if (event.specversion !== "1.0") {
    throw new Error("Unsupported CloudEvents specversion");
  }

  if (!event.id || !event.source || !event.type) {
    throw new Error("Missing required CloudEvents fields");
  }
}

/**
 * CloudEvents and Distribution Webhook types.
 * Derived from docs/api/distribute-v1_0_0.yaml and docs/api/status-v1_0_0.yaml.
 */

export const CLOUDEVENTS_CONTENT_TYPE = "application/cloudevents+json";

export const MEDALLIA_SOURCE = "urn:medallia:services:broadcaster" as const;
export const CLIENT_SOURCE = "urn:client:webhook" as const;

export const EventTypes = {
  AUTH_CHECK: "com.medallia.survey.invitation.authcheck",
  AUTH_CHECK_SUCCESS: "com.medallia.survey.invitation.authcheck.success",
  AUTH_CHECK_ERROR: "com.medallia.survey.invitation.authcheck.error",
  INVITATION: "com.medallia.survey.invitation",
  DELIVERY_QUEUED: "com.medallia.survey.invitation.delivery.queued",
  DELIVERY_SENT: "com.medallia.survey.invitation.delivery.sent",
  DELIVERY_FAILED: "com.medallia.survey.invitation.delivery.failed",
  DELIVERY_DELIVERED: "com.medallia.survey.invitation.delivery.delivered",
  DELIVERY_OPTOUT: "com.medallia.survey.invitation.delivery.optout",
  UPDATE_SUCCESS: "com.medallia.survey.invitation.delivery.updatesuccess",
  UPDATE_ERROR: "com.medallia.survey.invitation.delivery.updateerror",
} as const;

export type DeliveryStatusType =
  | typeof EventTypes.DELIVERY_QUEUED
  | typeof EventTypes.DELIVERY_SENT
  | typeof EventTypes.DELIVERY_FAILED
  | typeof EventTypes.DELIVERY_DELIVERED
  | typeof EventTypes.DELIVERY_OPTOUT;

export interface CloudEventBase {
  specversion: "1.0";
  id: string;
  source: string;
  type: string;
  traceparent?: string;
  time?: string;
  datacontenttype?: "application/json";
  dataschema?: string;
  subject?: string;
}

export interface InvitationMessage {
  locale: string;
  summary?: string;
  details?: string;
  /** Medallia broadcaster may send long-form copy as `content` instead of `details`. */
  content?: string;
}

export interface InvitationData {
  record_type: "live" | "preview";
  survey_id: string;
  survey_url: string;
  contact_id: string;
  preferred_locale?: string;
  messages?: InvitationMessage[];
  expiration_timestamp: string;
  additional_data?: Record<string, unknown>;
  callback: string;
}

export interface AuthCheckRequest extends CloudEventBase {
  source: typeof MEDALLIA_SOURCE;
  type: typeof EventTypes.AUTH_CHECK;
  data?: Record<string, never>;
}

export interface DistributionRequest extends CloudEventBase {
  source: typeof MEDALLIA_SOURCE;
  type: typeof EventTypes.INVITATION;
  dataschema?: "https://cdn.medallia.com/cloudevents-schemas/broadcaster-webhook-invitation/v1.json";
  data: InvitationData;
}

export interface DeliveryError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface DistributionUpdateData {
  message_id: string;
  debug_info?: Record<string, unknown> | Record<string, unknown>[];
  error?: DeliveryError;
}

export interface DistributionUpdate extends CloudEventBase {
  source: typeof CLIENT_SOURCE;
  type: DeliveryStatusType;
  dataschema?: "https://cdn.medallia.com/cloudevents-schemas/broadcaster-webhook-invitation-update/v1.json";
  data: DistributionUpdateData;
}

export interface AuthCheckResponse extends CloudEventBase {
  source: typeof CLIENT_SOURCE;
  type: typeof EventTypes.AUTH_CHECK_SUCCESS | typeof EventTypes.AUTH_CHECK_ERROR;
  dataschema?: "https://cdn.medallia.com/cloudevents-schemas/broadcaster-webhook-invitation-update/v1.json";
  data: {
    message_id?: string;
    debug_info?: Record<string, unknown> | Record<string, unknown>[];
  };
}

export interface DistributionUpdateResponse extends CloudEventBase {
  source: typeof MEDALLIA_SOURCE;
  type: typeof EventTypes.UPDATE_SUCCESS | typeof EventTypes.UPDATE_ERROR;
  data: {
    status?: string;
    error?: {
      status?: "other" | "invitation_not_found";
    };
    debug_info?: Record<string, unknown> | Record<string, unknown>[];
  };
}

export interface QueueMessage {
  messageId: string;
  traceparent?: string;
  distribution: DistributionRequest;
}

export function isAuthCheckRequest(event: CloudEventBase): event is AuthCheckRequest {
  return event.type === EventTypes.AUTH_CHECK;
}

export function isDistributionRequest(event: CloudEventBase): event is DistributionRequest {
  return event.type === EventTypes.INVITATION;
}

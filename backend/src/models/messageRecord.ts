/**
 * Idempotency and audit record for processed distribution messages.
 */

import type { DeliveryStatusType } from "./cloudevents.js";

export interface ProcessedMessage {
  messageId: string;
  status: DeliveryStatusType;
  traceparent?: string;
  callbackUrl: string;
  contactId: string;
  surveyId: string;
  recordType: "live" | "preview";
  processedAt: string;
  responseBody?: string;
  ttl: number;
}

export const MESSAGE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

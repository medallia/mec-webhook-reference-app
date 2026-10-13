import { hashContactId } from "./hash.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  messageId?: string;
  traceparent?: string;
  contactId?: string;
  [key: string]: unknown;
}

const REDACT_KEYS = new Set([
  "contact_id",
  "contactId",
  "survey_url",
  "surveyUrl",
  "password",
  "fcmToken",
  "fcm_token",
  "token",
  "apiKey",
  "api_key",
  "authorization",
  "callback",
  "callbackUrl",
  "callback_url",
  "client_secret",
  "clientSecret",
  "summary",
  "details",
  "requestBody",
]);

function redactValue(key: string, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "object" && item !== null
        ? sanitizeContext(item as LogContext)
        : item,
    );
  }

  if (typeof value === "object" && value !== null) {
    return sanitizeContext(value as LogContext);
  }

  if (!REDACT_KEYS.has(key) || typeof value !== "string" || value.length === 0) {
    return value;
  }
  if (key === "contact_id" || key === "contactId") {
    return hashContactId(value).slice(0, 12);
  }
  if (value.length > 4) {
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
  }
  return "***";
}

function sanitizeContext(context: LogContext = {}): LogContext {
  const sanitized: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    sanitized[key] = redactValue(key, value);
  }
  return sanitized;
}

export function log(level: LogLevel, message: string, context: LogContext = {}): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...sanitizeContext(context),
  };

  console.log(JSON.stringify(entry));
}

export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
};

export const RATE_LIMIT_HEADERS = {
  "X-RateLimit-Limit": "10, 10;w=1, 100;w=86400",
  "X-RateLimit-Remaining": "9",
  "X-RateLimit-Reset": "60",
};

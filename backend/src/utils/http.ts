import type { APIGatewayProxyResultV2 } from "aws-lambda";
import { CLOUDEVENTS_CONTENT_TYPE } from "../models/cloudevents.js";
import { RATE_LIMIT_HEADERS } from "./logger.js";

export function jsonResponse(
  statusCode: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      "Content-Type": CLOUDEVENTS_CONTENT_TYPE,
      ...RATE_LIMIT_HEADERS,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

export function emptyResponse(
  statusCode: number,
  extraHeaders: Record<string, string> = {},
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      ...RATE_LIMIT_HEADERS,
      ...extraHeaders,
    },
  };
}

export function parseJsonBody<T>(body: string | undefined): T {
  if (!body) {
    throw new Error("Request body is required");
  }

  return JSON.parse(body) as T;
}

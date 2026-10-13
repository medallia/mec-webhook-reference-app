import { timingSafeEqual } from "node:crypto";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

export interface BasicAuthCredentials {
  username: string;
  password: string;
}

export function parseBasicAuthHeader(headerValue?: string): BasicAuthCredentials | null {
  if (!headerValue?.startsWith("Basic ")) {
    return null;
  }

  try {
    const encoded = headerValue.slice("Basic ".length).trim();
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

export function validateBasicAuth(
  event: APIGatewayProxyEventV2,
  expected: BasicAuthCredentials,
): boolean {
  const authHeader =
    event.headers.authorization ??
    event.headers.Authorization ??
    event.headers["authorization"];

  const credentials = parseBasicAuthHeader(authHeader);
  if (!credentials) {
    return false;
  }

  return (
    safeEqual(credentials.username, expected.username) &&
    safeEqual(credentials.password, expected.password)
  );
}

export function validateApiKey(event: APIGatewayProxyEventV2, expectedApiKey: string): boolean {
  const apiKey =
    event.headers["x-api-key"] ??
    event.headers["X-Api-Key"] ??
    event.headers["X-API-KEY"];

  if (!apiKey) {
    return false;
  }
  return safeEqual(apiKey, expectedApiKey);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Pads the shorter string so both buffers are equal length before
 * calling timingSafeEqual, then verifies original lengths match.
 */
function safeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  const bufA = Buffer.alloc(maxLen, 0);
  const bufB = Buffer.alloc(maxLen, 0);
  Buffer.from(a).copy(bufA);
  Buffer.from(b).copy(bufB);
  return timingSafeEqual(bufA, bufB) && a.length === b.length;
}

export function getHeader(event: APIGatewayProxyEventV2, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (key.toLowerCase() === lower) {
      return value;
    }
  }
  return undefined;
}

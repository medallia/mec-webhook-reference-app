import { logger } from "../utils/logger.js";
import {
  CLOUDEVENTS_CONTENT_TYPE,
  type DistributionUpdate,
  type DistributionUpdateResponse,
} from "../models/cloudevents.js";

/**
 * Validates that a callback URL uses HTTPS and matches the allowed domain
 * pattern. Defaults to *.medallia.com if CALLBACK_URL_ALLOWLIST is not set.
 *
 * WARNING: Production deployments should restrict this to the exact callback
 * domain(s) expected from Medallia (e.g., *.apis.medallia.com).
 */
const ALLOWED_HOSTNAME_PATTERN = process.env.CALLBACK_URL_ALLOWLIST
  ? new RegExp(process.env.CALLBACK_URL_ALLOWLIST)
  : /\.medallia\.com$/;

function validateCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    return ALLOWED_HOSTNAME_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
}

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

let cachedToken: { value: string; expiresAt: number } | undefined;

async function getOAuthToken(params: {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
}): Promise<string | undefined> {
  if (!params.tokenUrl || !params.clientId || !params.clientSecret) {
    return undefined;
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.value;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });

  const response = await fetch(params.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    const errorContext: Record<string, unknown> = {
      statusCode: response.status,
    };
    if (process.env.LOG_OAUTH_DEBUG === "true") {
      errorContext.responseBody = text.slice(0, 200);
    }
    logger.error("Failed to obtain OAuth token for status callback", errorContext);
    return undefined;
  }

  const tokenResponse = (await response.json()) as OAuthTokenResponse;
  cachedToken = {
    value: tokenResponse.access_token,
    expiresAt: now + tokenResponse.expires_in * 1000,
  };

  return cachedToken.value;
}

export async function postStatusCallback(params: {
  callbackUrl: string;
  update: DistributionUpdate;
  oauthTokenUrl?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
}): Promise<{ ok: boolean; statusCode: number; response?: DistributionUpdateResponse }> {
  if (!validateCallbackUrl(params.callbackUrl)) {
    logger.error("Callback URL rejected by allowlist", {
      messageId: params.update.data.message_id,
    });
    return { ok: false, statusCode: 0 };
  }

  const headers: Record<string, string> = {
    "Content-Type": CLOUDEVENTS_CONTENT_TYPE,
  };

  const token = await getOAuthToken({
    tokenUrl: params.oauthTokenUrl ?? "",
    clientId: params.oauthClientId ?? "",
    clientSecret: params.oauthClientSecret ?? "",
  });

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(params.callbackUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(params.update),
  });

  let parsed: DistributionUpdateResponse | undefined;
  const responseText = await response.text();

  if (responseText) {
    try {
      parsed = JSON.parse(responseText) as DistributionUpdateResponse;
    } catch {
      logger.warn("Status callback response was not valid JSON", {
        statusCode: response.status,
      });
    }
  }

  if (!response.ok) {
    logger.error("Status callback failed", {
      statusCode: response.status,
      messageId: params.update.data.message_id,
    });
  } else {
    logger.info("Status callback succeeded", {
      statusCode: response.status,
      messageId: params.update.data.message_id,
      updateType: params.update.type,
    });
  }

  return {
    ok: response.ok,
    statusCode: response.status,
    response: parsed,
  };
}

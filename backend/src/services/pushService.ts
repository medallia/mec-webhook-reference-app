import type { DevicePlatform } from "../models/device.js";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import admin from "firebase-admin";
import { getConfig } from "../config.js";
import { logger } from "../utils/logger.js";

const secretsClient = new SecretsManagerClient({});
let firebaseInitialized = false;

async function initializeFirebase(secretArn: string): Promise<void> {
  if (firebaseInitialized) {
    return;
  }

  const secret = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );

  if (!secret.SecretString) {
    throw new Error("FCM service account secret is empty");
  }

  const serviceAccount = JSON.parse(secret.SecretString) as admin.ServiceAccount;

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  firebaseInitialized = true;
}

export interface PushPayload {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
  platform?: DevicePlatform;
}

export interface PushResult {
  success: boolean;
  retryable: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Detect whether a token looks like a raw APNs device token (64-char hex)
 * rather than an FCM registration token.
 */
function isApnsToken(token: string): boolean {
  return /^[0-9a-f]{64}$/i.test(token) && !token.includes(":");
}

/**
 * Convert an APNs device token to an FCM registration token using
 * the Firebase Instance ID server API (batchImport).
 */
async function apnsToFcmToken(apnsToken: string, sandbox: boolean = false): Promise<string | null> {
  try {
    const credential = admin.app().options.credential;
    if (!credential) {
      logger.error("No Firebase credential available for APNs import");
      return null;
    }
    const tokenResult = await credential.getAccessToken();
    if (!tokenResult?.access_token) {
      logger.error("Failed to get Firebase access token for APNs import");
      return null;
    }

    // The batchImport API requires the iOS app bundle ID as 'application'
    const bundleId = (await getConfig()).appBundleId;

    const response = await fetch(
      `https://iid.googleapis.com/iid/v1:batchImport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenResult.access_token}`,
          "Content-Type": "application/json",
          "access_token_auth": "true",
        },
        body: JSON.stringify({
          application: bundleId,
          sandbox,
          apns_tokens: [apnsToken],
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      const errorContext: Record<string, unknown> = {
        status: response.status,
      };
      if (process.env.LOG_PUSH_DEBUG === "true") {
        errorContext.body = text.slice(0, 300);
      }
      logger.error("APNs to FCM token import failed", errorContext);
      return null;
    }

    const result = (await response.json()) as {
      results: Array<{
        registration_token?: string;
        apns_token: string;
        status: string;
      }>;
    };

    const mapped = result.results?.[0];
    if (mapped?.registration_token) {
      logger.info("APNs token converted to FCM token", {
        apnsTokenPrefix: apnsToken.slice(0, 8),
      });
      return mapped.registration_token;
    }

    logger.warn("APNs token import returned no FCM token", { status: mapped?.status });
    return null;
  } catch (error) {
    logger.error("APNs to FCM token conversion error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

const ANDROID_FCM_CHANNEL_ID = "survey-invitations";

export async function sendPushNotification(
  secretArn: string,
  payload: PushPayload,
): Promise<PushResult> {
  await initializeFirebase(secretArn);

  let tokenToUse = payload.token;

  // If the token looks like a raw APNs token, try to convert it to an FCM token
  if (isApnsToken(payload.token)) {
    logger.info("Detected APNs token, attempting server-side conversion to FCM token", {
      tokenPrefix: payload.token.slice(0, 8),
    });
    const fcmToken = await apnsToFcmToken(payload.token, false);
    if (fcmToken) {
      tokenToUse = fcmToken;
    } else {
      // Also try sandbox (development) mode
      const sandboxToken = await apnsToFcmToken(payload.token, true);
      if (sandboxToken) {
        tokenToUse = sandboxToken;
      } else {
        return {
          success: false,
          retryable: false,
          errorCode: "APNS_TOKEN_CONVERSION_FAILED",
          errorMessage: "Could not convert APNs token to FCM token",
        };
      }
    }
  }

  try {
    // Android: data-only so messaging().onMessage / background handler always receive full payload.
    // Notification+data messages often skip JS handlers while the app is in the foreground.
    if (payload.platform === "android") {
      await admin.messaging().send({
        token: tokenToUse,
        data: payload.data,
        android: {
          priority: "high",
        },
      });
    } else {
      await admin.messaging().send({
        token: tokenToUse,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
        android: {
          priority: "high",
          notification: {
            channelId: ANDROID_FCM_CHANNEL_ID,
            priority: "high" as const,
          },
        },
        apns: {
          headers: {
            "apns-priority": "10",
          },
          payload: {
            aps: {
              sound: "default",
            },
          },
        },
      });
    }

    return { success: true, retryable: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown FCM error";
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : "FCM_ERROR";

    logger.error("FCM send failed", {
      errorCode: code,
      errorMessage: message,
    });

    const retryable =
      code === "messaging/server-unavailable" ||
      code === "messaging/internal-error" ||
      code === "messaging/unknown-error";

    return {
      success: false,
      retryable,
      errorCode: code,
      errorMessage: message,
    };
  }
}

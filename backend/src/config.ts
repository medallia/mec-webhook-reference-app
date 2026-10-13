import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { initHmacKeyFromSecret } from "./utils/hash.js";

export interface AppConfig {
  devicesTableName: string;
  messagesTableName: string;
  pushQueueUrl: string;
  webhookUsername: string;
  webhookPassword: string;
  deviceApiKey: string;
  fcmSecretArn: string;
  medalliaOAuthTokenUrl: string;
  medalliaOAuthClientId: string;
  medalliaOAuthClientSecret: string;
  logRedactionEnabled: boolean;
  appBundleId: string;
}

const smClient = new SecretsManagerClient({});

async function getSecretJson(arn: string): Promise<Record<string, string>> {
  const res = await smClient.send(
    new GetSecretValueCommand({ SecretId: arn }),
  );
  return JSON.parse(res.SecretString ?? "{}") as Record<string, string>;
}

async function getSecretString(arn: string): Promise<string> {
  const res = await smClient.send(
    new GetSecretValueCommand({ SecretId: arn }),
  );
  return res.SecretString ?? "";
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Load configuration, reading secrets from Secrets Manager when ARNs
 * are provided, falling back to plain environment variables for backward
 * compatibility during migration.
 */
export async function loadConfig(): Promise<AppConfig> {
  const webhookSecretArn = process.env.WEBHOOK_AUTH_SECRET_ARN;
  const deviceKeySecretArn = process.env.DEVICE_API_KEY_SECRET_ARN;
  const oauthSecretArn = process.env.MEDALLIA_OAUTH_SECRET_ARN;

  let webhookUsername = process.env.WEBHOOK_BASIC_AUTH_USERNAME ?? "webhook-user";
  let webhookPassword = process.env.WEBHOOK_BASIC_AUTH_PASSWORD ?? "";
  let deviceApiKey = process.env.DEVICE_API_KEY ?? "";
  let oauthTokenUrl = process.env.MEDALLIA_OAUTH_TOKEN_URL ?? "";
  let oauthClientId = process.env.MEDALLIA_OAUTH_CLIENT_ID ?? "";
  let oauthClientSecret = process.env.MEDALLIA_OAUTH_CLIENT_SECRET ?? "";

  if (webhookSecretArn) {
    const secret = await getSecretJson(webhookSecretArn);
    webhookUsername = secret.username ?? webhookUsername;
    webhookPassword = secret.password ?? webhookPassword;
  }
  if (deviceKeySecretArn) {
    deviceApiKey = await getSecretString(deviceKeySecretArn);
  }
  if (oauthSecretArn) {
    const secret = await getSecretJson(oauthSecretArn);
    oauthTokenUrl = secret.token_url ?? oauthTokenUrl;
    oauthClientId = secret.client_id ?? oauthClientId;
    oauthClientSecret = secret.client_secret ?? oauthClientSecret;
  }

  const hmacSecretArn = process.env.HASH_HMAC_SECRET_ARN;
  if (hmacSecretArn) {
    const hmacKey = await getSecretString(hmacSecretArn);
    initHmacKeyFromSecret(hmacKey);
  }

  return {
    devicesTableName: required("DEVICES_TABLE_NAME"),
    messagesTableName: required("MESSAGES_TABLE_NAME"),
    pushQueueUrl: required("PUSH_QUEUE_URL"),
    webhookUsername,
    webhookPassword,
    deviceApiKey,
    fcmSecretArn: required("FCM_SECRET_ARN"),
    medalliaOAuthTokenUrl: oauthTokenUrl,
    medalliaOAuthClientId: oauthClientId,
    medalliaOAuthClientSecret: oauthClientSecret,
    logRedactionEnabled: process.env.LOG_REDACTION_ENABLED !== "false",
    appBundleId: process.env.APP_BUNDLE_ID ?? "com.medallia.demo.mecwebhook",
  };
}

let cachedConfig: AppConfig | undefined;

export async function getConfig(): Promise<AppConfig> {
  if (!cachedConfig) {
    cachedConfig = await loadConfig();
  }
  return cachedConfig;
}

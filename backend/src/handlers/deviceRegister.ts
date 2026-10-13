import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { getConfig } from "../config.js";
import type { DeviceRegisterRequest } from "../models/device.js";
import { upsertDevice } from "../services/deviceRegistry.js";
import { validateApiKey } from "../utils/auth.js";
import { logger } from "../utils/logger.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const config = await getConfig();

  if (!validateApiKey(event, config.deviceApiKey)) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  if (!event.body) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Request body is required" }),
    };
  }

  let request: DeviceRegisterRequest;
  try {
    request = JSON.parse(event.body) as DeviceRegisterRequest;
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  if (!request.contactId || !request.fcmToken || !request.platform) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "contactId, fcmToken, and platform are required",
      }),
    };
  }

  const registration = await upsertDevice(config.devicesTableName, request);

  logger.info("Device registered", {
    contactId: registration.contactId,
    platform: registration.platform,
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contactId: registration.contactId,
      platform: registration.platform,
      updatedAt: registration.updatedAt,
      status: "registered",
    }),
  };
};

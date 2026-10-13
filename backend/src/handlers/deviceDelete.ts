import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { getConfig } from "../config.js";
import { deleteDevice, getDeviceByContactId } from "../services/deviceRegistry.js";
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

  const contactId = event.pathParameters?.contactId;
  if (!contactId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "contactId path parameter is required" }),
    };
  }

  const decodedContactId = decodeURIComponent(contactId);

  const existing = await getDeviceByContactId(config.devicesTableName, decodedContactId);
  if (!existing) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Device not found", contactId: decodedContactId }),
    };
  }

  await deleteDevice(config.devicesTableName, decodedContactId);

  logger.info("Device deleted", { contactId: decodedContactId });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contactId: decodedContactId,
      status: "deleted",
    }),
  };
};

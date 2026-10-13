import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { DeviceRegistration, DeviceRegisterRequest } from "../models/device.js";
import { hashContactId } from "../utils/hash.js";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function upsertDevice(
  tableName: string,
  request: DeviceRegisterRequest,
): Promise<DeviceRegistration> {
  const hashedId = hashContactId(request.contactId);

  const registration: DeviceRegistration = {
    contactId: hashedId,
    fcmToken: request.fcmToken,
    platform: request.platform,
    locale: request.locale,
    updatedAt: new Date().toISOString(),
  };

  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: registration,
    }),
  );

  // Return with original contactId for API response display
  return { ...registration, contactId: request.contactId };
}

export async function getDeviceByContactId(
  tableName: string,
  contactId: string,
): Promise<DeviceRegistration | undefined> {
  const hashedId = hashContactId(contactId);

  const result = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: { contactId: hashedId },
    }),
  );

  return result.Item as DeviceRegistration | undefined;
}

export async function deleteDevice(
  tableName: string,
  contactId: string,
): Promise<void> {
  const hashedId = hashContactId(contactId);

  await client.send(
    new DeleteCommand({
      TableName: tableName,
      Key: { contactId: hashedId },
    }),
  );
}

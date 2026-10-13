import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DeliveryStatusType } from "../models/cloudevents.js";
import { EventTypes } from "../models/cloudevents.js";
import { MESSAGE_TTL_SECONDS, type ProcessedMessage } from "../models/messageRecord.js";
import { hashContactId } from "../utils/hash.js";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function getProcessedMessage(
  tableName: string,
  messageId: string,
): Promise<ProcessedMessage | undefined> {
  const result = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: { messageId },
    }),
  );

  return result.Item as ProcessedMessage | undefined;
}

export async function createQueuedMessage(params: {
  tableName: string;
  messageId: string;
  traceparent?: string;
  callbackUrl: string;
  contactId: string;
  surveyId: string;
  recordType: "live" | "preview";
  responseBody: string;
}): Promise<ProcessedMessage | undefined> {
  const now = new Date();
  const record: ProcessedMessage = {
    messageId: params.messageId,
    status: EventTypes.DELIVERY_QUEUED,
    traceparent: params.traceparent,
    callbackUrl: params.callbackUrl,
    contactId: hashContactId(params.contactId),
    surveyId: params.surveyId,
    recordType: params.recordType,
    processedAt: now.toISOString(),
    responseBody: params.responseBody,
    ttl: Math.floor(now.getTime() / 1000) + MESSAGE_TTL_SECONDS,
  };

  try {
    await client.send(
      new PutCommand({
        TableName: params.tableName,
        Item: record,
        ConditionExpression: "attribute_not_exists(messageId)",
      }),
    );
    return record;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return undefined;
    }
    throw error;
  }
}

export async function updateMessageStatus(
  tableName: string,
  messageId: string,
  status: DeliveryStatusType,
): Promise<void> {
  await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { messageId },
      UpdateExpression: "SET #status = :status, processedAt = :processedAt",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": status,
        ":processedAt": new Date().toISOString(),
      },
    }),
  );
}

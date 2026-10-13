import type { SQSHandler } from "aws-lambda";
import { type AppConfig, getConfig } from "../config.js";
import { EventTypes, type QueueMessage } from "../models/cloudevents.js";
import { getDeviceByContactId } from "../services/deviceRegistry.js";
import { updateMessageStatus } from "../services/idempotency.js";
import { sendPushNotification } from "../services/pushService.js";
import { postStatusCallback } from "../services/statusCallback.js";
import { buildDistributionUpdate } from "../utils/cloudevents.js";
import { resolveInvitationMessage } from "../utils/locale.js";
import { logger } from "../utils/logger.js";

async function reportStatus(params: {
  callbackUrl: string;
  update: ReturnType<typeof buildDistributionUpdate>;
  config: AppConfig;
}): Promise<void> {
  await postStatusCallback({
    callbackUrl: params.callbackUrl,
    update: params.update,
    oauthTokenUrl: params.config.medalliaOAuthTokenUrl,
    oauthClientId: params.config.medalliaOAuthClientId,
    oauthClientSecret: params.config.medalliaOAuthClientSecret,
  });
}

export const handler: SQSHandler = async (event) => {
  const config = await getConfig();

  for (const record of event.Records) {
    const queueMessage = JSON.parse(record.body) as QueueMessage;
    const { distribution, messageId, traceparent } = queueMessage;
    const invitation = distribution.data;

    logger.info("Processing queued invitation", {
      messageId,
      traceparent,
      contactId: invitation.contact_id,
    });

    const device = await getDeviceByContactId(
      config.devicesTableName,
      invitation.contact_id,
    );

    if (!device) {
      const failedUpdate = buildDistributionUpdate({
        messageId,
        traceparent,
        type: EventTypes.DELIVERY_FAILED,
        error: {
          code: "DEVICE_NOT_REGISTERED",
          message: "No registered device found for contact_id",
          retryable: true,
        },
      });

      await updateMessageStatus(
        config.messagesTableName,
        messageId,
        EventTypes.DELIVERY_FAILED,
      );

      await reportStatus({
        callbackUrl: invitation.callback,
        update: failedUpdate,
        config,
      });

      throw new Error("DEVICE_NOT_REGISTERED");
    }

    logger.info("Invitation payload metadata", {
      messageId,
      traceparent,
      preferred_locale: invitation.preferred_locale,
      messageCount: invitation.messages?.length ?? 0,
    });

    const localized = resolveInvitationMessage(invitation);

    logger.info("Resolved invitation locale", {
      messageId,
      traceparent,
      locale: localized.locale,
    });
    const pushResult = await sendPushNotification(config.fcmSecretArn, {
      token: device.fcmToken,
      platform: device.platform,
      title: localized.summary,
      body: localized.details,
      data: {
        messageId,
        surveyUrl: invitation.survey_url,
        surveyId: invitation.survey_id,
        expirationTimestamp: invitation.expiration_timestamp,
        locale: localized.locale,
        recordType: invitation.record_type,
        title: localized.summary,
        body: localized.details,
      },
    });

    if (!pushResult.success) {
      const failedUpdate = buildDistributionUpdate({
        messageId,
        traceparent,
        type: EventTypes.DELIVERY_FAILED,
        error: {
          code: pushResult.errorCode ?? "PUSH_FAILED",
          message: pushResult.errorMessage ?? "Failed to send push notification",
          retryable: pushResult.retryable,
        },
      });

      await updateMessageStatus(
        config.messagesTableName,
        messageId,
        EventTypes.DELIVERY_FAILED,
      );

      await reportStatus({
        callbackUrl: invitation.callback,
        update: failedUpdate,
        config,
      });

      if (pushResult.retryable) {
        throw new Error(pushResult.errorCode ?? "PUSH_FAILED");
      }

      continue;
    }

    const sentUpdate = buildDistributionUpdate({
      messageId,
      traceparent,
      type: EventTypes.DELIVERY_SENT,
    });

    await updateMessageStatus(
      config.messagesTableName,
      messageId,
      EventTypes.DELIVERY_SENT,
    );

    await reportStatus({
      callbackUrl: invitation.callback,
      update: sentUpdate,
      config,
    });

    logger.info("Push notification sent", {
      messageId,
      contactId: invitation.contact_id,
    });
  }
};

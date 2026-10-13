import type * as Notifications from "expo-notifications";
import type { RemoteMessage } from "./firebaseMessaging";

export interface PushInvitation {
  messageId?: string;
  surveyUrl?: string;
  title: string;
  body: string;
}

function stringDataField(
  data: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = data?.[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  const normalized = typeof value === "string" ? value : String(value);
  return normalized.length > 0 ? normalized : undefined;
}

export function extractInvitationFromRemoteMessage(
  remoteMessage: RemoteMessage,
): PushInvitation {
  const data = remoteMessage.data;
  return {
    messageId: stringDataField(data, "messageId"),
    surveyUrl: stringDataField(data, "surveyUrl"),
    title:
      remoteMessage.notification?.title ??
      stringDataField(data, "title") ??
      "Survey invitation",
    body:
      remoteMessage.notification?.body ??
      stringDataField(data, "body") ??
      stringDataField(data, "content") ??
      "Tap to share your feedback.",
  };
}

export function extractInvitationFromNotification(
  notification: Notifications.Notification,
): PushInvitation {
  const content = notification.request.content;
  const data = (content.data ?? {}) as Record<string, unknown>;

  return {
    messageId: stringDataField(data, "messageId"),
    surveyUrl: stringDataField(data, "surveyUrl"),
    title: content.title ?? "Survey invitation",
    body: content.body ?? "Tap to share your feedback.",
  };
}

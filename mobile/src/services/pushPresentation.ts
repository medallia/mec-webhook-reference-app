import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { RemoteMessage } from "./firebaseMessaging";
import { recordPushDiagnostic } from "./pushDiagnostics";
import { extractInvitationFromRemoteMessage, type PushInvitation } from "./pushPayload";

export const ANDROID_NOTIFICATION_CHANNEL_ID = "survey-invitations";

let channelReady = false;

export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android" || channelReady) {
    return;
  }

  await Notifications.setNotificationChannelAsync(ANDROID_NOTIFICATION_CHANNEL_ID, {
    name: "Survey invitations",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#1F4FD8",
    sound: "default",
  });
  channelReady = true;
}

export async function presentInvitationFromPushInvitation(
  invitation: PushInvitation,
): Promise<void> {
  if (!invitation.surveyUrl) {
    return;
  }

  if (Platform.OS === "android") {
    await ensureAndroidNotificationChannel();
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: invitation.title,
        body: invitation.body,
        sound: "default",
        data: {
          messageId: invitation.messageId ?? "",
          surveyUrl: invitation.surveyUrl,
        },
        ...(Platform.OS === "android"
          ? {
              android: {
                channelId: ANDROID_NOTIFICATION_CHANNEL_ID,
                priority: Notifications.AndroidNotificationPriority.MAX,
              },
            }
          : {}),
      },
      trigger: null,
    });
  } catch (error) {
    recordPushDiagnostic("present_failed", {
      messageId: invitation.messageId ?? null,
      message: error instanceof Error ? error.message : String(error),
    });
    console.warn("Failed to schedule invitation notification", {
      messageId: invitation.messageId,
      error,
    });
  }
}

export async function presentInvitationFromRemoteMessage(
  remoteMessage: RemoteMessage,
): Promise<void> {
  await presentInvitationFromPushInvitation(extractInvitationFromRemoteMessage(remoteMessage));
}

/** Data-only FCM messages in background invoke this headless handler. */
export async function handleAndroidBackgroundRemoteMessage(
  remoteMessage: RemoteMessage,
): Promise<void> {
  await presentInvitationFromRemoteMessage(remoteMessage);
}

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { RemoteMessage } from "./firebaseMessaging";
import { emitAndroidForegroundPush } from "./pushEvents";
import type { PushInvitation } from "./pushPayload";
import {
  extractInvitationFromNotification,
  extractInvitationFromRemoteMessage,
} from "./pushPayload";
import { recordPushDiagnostic } from "./pushDiagnostics";
import { presentInvitationFromPushInvitation } from "./pushPresentation";

const DEDUPE_MAX = 64;
const recentInvitationKeys: string[] = [];

type InvitationReceivedListener = (invitation: PushInvitation) => void;

let invitationReceivedListener: InvitationReceivedListener | null = null;
let expoForegroundListenerRegistered = false;

export function setAndroidForegroundInvitationReceivedListener(
  listener: InvitationReceivedListener | null,
): void {
  invitationReceivedListener = listener;
}

function invitationDedupeKey(invitation: PushInvitation): string | null {
  if (invitation.messageId) {
    return `id:${invitation.messageId}`;
  }
  if (invitation.surveyUrl) {
    return `url:${invitation.surveyUrl}`;
  }
  return null;
}

function markInvitationHandled(key: string): boolean {
  if (recentInvitationKeys.includes(key)) {
    return false;
  }
  recentInvitationKeys.push(key);
  while (recentInvitationKeys.length > DEDUPE_MAX) {
    recentInvitationKeys.shift();
  }
  return true;
}

/**
 * Shared Android foreground delivery for RN Firebase onMessage and Expo received events.
 */
export async function deliverAndroidForegroundInvitation(
  invitation: PushInvitation,
  options: { scheduleLocalNotification: boolean },
): Promise<void> {
  if (!invitation.surveyUrl) {
    return;
  }

  const dedupeKey = invitationDedupeKey(invitation);
  if (!dedupeKey || !markInvitationHandled(dedupeKey)) {
    recordPushDiagnostic("deliver_skipped_dedupe", {
      messageId: invitation.messageId ?? null,
    });
    return;
  }

  invitationReceivedListener?.(invitation);
  emitAndroidForegroundPush(invitation);

  if (options.scheduleLocalNotification) {
    await presentInvitationFromPushInvitation(invitation);
  }

  recordPushDiagnostic("delivered", {
    messageId: invitation.messageId ?? null,
    scheduledLocal: options.scheduleLocalNotification,
  });
}

export async function deliverAndroidForegroundRemoteMessage(
  remoteMessage: RemoteMessage,
  options: { scheduleLocalNotification: boolean },
): Promise<void> {
  const invitation = extractInvitationFromRemoteMessage(remoteMessage);
  if (!invitation.surveyUrl) {
    recordPushDiagnostic("missing_survey_url", {
      dataKeys: remoteMessage.data ? Object.keys(remoteMessage.data) : [],
      hasNotification: Boolean(remoteMessage.notification),
    });
    console.warn("Android foreground push missing surveyUrl in data payload", {
      dataKeys: remoteMessage.data ? Object.keys(remoteMessage.data) : [],
      hasNotification: Boolean(remoteMessage.notification),
    });
    return;
  }

  await deliverAndroidForegroundInvitation(invitation, options);
}

/**
 * Fallback when notification+data FCM does not reach messaging().onMessage in the foreground.
 */
export function registerAndroidExpoForegroundNotificationListener(): void {
  if (Platform.OS !== "android" || expoForegroundListenerRegistered) {
    return;
  }

  Notifications.addNotificationReceivedListener((notification) => {
    try {
      const invitation = extractInvitationFromNotification(notification);
      recordPushDiagnostic("expo_received", {
        messageId: invitation.messageId ?? null,
        hasSurveyUrl: Boolean(invitation.surveyUrl),
      });
      // Release builds often do not show remote FCM via setNotificationHandler alone.
      void deliverAndroidForegroundInvitation(invitation, {
        scheduleLocalNotification: true,
      });
    } catch (error) {
      console.warn("Android Expo foreground notification handling failed:", error);
    }
  });

  expoForegroundListenerRegistered = true;
}

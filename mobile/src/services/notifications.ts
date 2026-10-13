import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { DevicePlatform } from "./api";
import { tryGetAppMessaging } from "./firebaseMessaging";
import { extractInvitationFromRemoteMessage, type PushInvitation } from "./pushPayload";
import { ensureAndroidForegroundPushHandlers } from "./pushMessagingBootstrap";
import { ensureAndroidNotificationChannel } from "./pushPresentation";
import { setAndroidForegroundInvitationReceivedListener } from "./pushForegroundAndroid";

export { ANDROID_NOTIFICATION_CHANNEL_ID } from "./pushPresentation";
export type { PushInvitation } from "./pushPayload";

type PushInvitationHandlers = {
  onReceived?: (invitation: PushInvitation) => void;
  onOpen?: (invitation: PushInvitation) => void;
  onTokenRefresh?: (token: string) => void;
};

let pushHandlers: PushInvitationHandlers | null = null;
let firebaseMessagingInitialized = false;
let pendingOpenInvitation: PushInvitation | null = null;
let initialNotificationChecked = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function getPlatform(): DevicePlatform {
  if (Platform.OS === "ios") {
    return "ios";
  }
  if (Platform.OS === "android") {
    return "android";
  }
  return "unknown";
}

export function isSimulatorPushBypassActive(): boolean {
  return __DEV__ && !Device.isDevice;
}

function getSimulatorFcmToken(contactId?: string): string {
  const platform = getPlatform();
  const suffix = contactId?.trim() ? `-${contactId.trim()}` : "";
  return `simulator-${platform}-dev${suffix}`;
}

function flushPendingOpenInvitation(): void {
  if (!pendingOpenInvitation?.surveyUrl || !pushHandlers?.onOpen) {
    return;
  }
  const invitation = pendingOpenInvitation;
  pendingOpenInvitation = null;
  pushHandlers.onOpen(invitation);
}

async function checkInitialNotificationOpen(): Promise<void> {
  if (initialNotificationChecked) {
    return;
  }
  initialNotificationChecked = true;

  const messaging = tryGetAppMessaging();
  if (!messaging) {
    return;
  }

  try {
    const remoteMessage = await messaging.getInitialNotification();
    if (remoteMessage) {
      notifyOpen(extractInvitationFromRemoteMessage(remoteMessage));
    }
  } catch (error) {
    console.warn("getInitialNotification failed:", error);
  }
}

export function setPushInvitationHandlers(
  handlers: PushInvitationHandlers | null,
  options?: { replace?: boolean },
): void {
  if (handlers === null) {
    pushHandlers = null;
    return;
  }

  pushHandlers = options?.replace ? handlers : { ...(pushHandlers ?? {}), ...handlers };

  if (pushHandlers.onOpen) {
    flushPendingOpenInvitation();
    void checkInitialNotificationOpen();
  }
}

export function clearPushInvitationHandlers(
  keys: Array<"onReceived" | "onOpen" | "onTokenRefresh">,
): void {
  if (!pushHandlers) {
    return;
  }

  const next = { ...pushHandlers };
  for (const key of keys) {
    delete next[key];
  }
  pushHandlers = Object.keys(next).length > 0 ? next : null;
}

function notifyReceived(invitation: PushInvitation): void {
  if (!invitation.surveyUrl) {
    return;
  }
  pushHandlers?.onReceived?.(invitation);
}

function notifyOpen(invitation: PushInvitation): void {
  if (!invitation.surveyUrl) {
    return;
  }
  if (pushHandlers?.onOpen) {
    pushHandlers.onOpen(invitation);
    return;
  }
  pendingOpenInvitation = invitation;
}

export async function configurePushNotifications(): Promise<void> {
  await ensureAndroidNotificationChannel();
  await ensureAndroidForegroundPushHandlers();
}

export function initializeFirebaseMessaging(): void {
  if (firebaseMessagingInitialized) {
    return;
  }

  const messaging = tryGetAppMessaging();
  if (!messaging) {
    firebaseMessagingInitialized = true;
    return;
  }

  try {
    messaging.onNotificationOpenedApp((remoteMessage) => {
      notifyOpen(extractInvitationFromRemoteMessage(remoteMessage));
    });

    messaging.onTokenRefresh((token) => {
      pushHandlers?.onTokenRefresh?.(token);
    });

    firebaseMessagingInitialized = true;
  } catch (error) {
    console.warn("Firebase messaging setup failed:", error);
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (isSimulatorPushBypassActive()) {
    return true;
  }

  if (!Device.isDevice) {
    return false;
  }

  const settings = await Notifications.getPermissionsAsync();
  if (notificationPermissionsGranted(settings)) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  const granted = notificationPermissionsGranted(requested);
  if (!granted && __DEV__) {
    console.warn("Notification permissions denied", {
      status: requested.status,
      android: requested.android,
      ios: requested.ios,
    });
  }
  return granted;
}

export async function hasNotificationPermission(): Promise<boolean> {
  if (isSimulatorPushBypassActive()) {
    return true;
  }

  if (!Device.isDevice) {
    return false;
  }

  const settings = await Notifications.getPermissionsAsync();
  return notificationPermissionsGranted(settings);
}

function notificationPermissionsGranted(
  settings: Notifications.NotificationPermissionsStatus,
): boolean {
  if (settings.granted) {
    return true;
  }
  const iosStatus = settings.ios?.status;
  if (iosStatus !== undefined) {
    if (
      iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
    ) {
      return true;
    }
  }
  if (
    Platform.OS === "android" &&
    settings.android?.importance !== undefined &&
    settings.android.importance > Notifications.AndroidImportance.NONE
  ) {
    return true;
  }
  return false;
}

async function getFirebaseFcmToken(): Promise<string | null> {
  const messaging = tryGetAppMessaging();
  if (!messaging) {
    return null;
  }

  try {
    if (Platform.OS === "ios" && !messaging.isDeviceRegisteredForRemoteMessages) {
      await messaging.registerDeviceForRemoteMessages();
    }

    const fcmToken = await messaging.getToken();
    return fcmToken || null;
  } catch (e) {
    console.warn("Firebase messaging getToken failed:", e);
    return null;
  }
}

export async function getFcmTokenIfPermitted(contactId?: string): Promise<string | null> {
  if (isSimulatorPushBypassActive()) {
    return getSimulatorFcmToken(contactId);
  }

  if (!(await hasNotificationPermission())) {
    return null;
  }

  await configurePushNotifications();

  const firebaseToken = await getFirebaseFcmToken();
  if (firebaseToken) {
    return firebaseToken;
  }

  try {
    const token = await Notifications.getDevicePushTokenAsync();
    return token.data || null;
  } catch (error) {
    console.warn("getDevicePushTokenAsync failed:", error);
    return null;
  }
}

export async function getFcmToken(contactId?: string): Promise<string> {
  if (isSimulatorPushBypassActive()) {
    return getSimulatorFcmToken(contactId);
  }

  const granted = await requestNotificationPermissions();
  if (!granted) {
    throw new Error("Notification permissions were not granted");
  }

  const token = await getFcmTokenIfPermitted(contactId);
  if (!token) {
    throw new Error("Unable to obtain a push notification token");
  }

  return token;
}

export function addNotificationReceivedListener(
  listener: (notification: Notifications.Notification) => void,
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(listener);
}

export function addNotificationResponseListener(
  listener: (response: Notifications.NotificationResponse) => void,
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

export async function getLastNotificationInvitation(): Promise<PushInvitation | null> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) {
    return null;
  }
  return extractInvitationFromNotification(response.notification);
}

export { extractInvitationFromNotification, extractInvitationFromRemoteMessage } from "./pushPayload";

if (Platform.OS === "android") {
  setAndroidForegroundInvitationReceivedListener((invitation) => {
    notifyReceived(invitation);
  });
}

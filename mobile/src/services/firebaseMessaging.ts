import { getMessaging, type Messaging, type RemoteMessage } from "@react-native-firebase/messaging";

export type { Messaging, RemoteMessage };

/**
 * RN Firebase v26+ uses modular `getMessaging()` instead of the legacy default export.
 * Calling this once also registers the Android headless task with AppRegistry.
 */
export function getAppMessaging(): Messaging {
  return getMessaging();
}

export function tryGetAppMessaging(): Messaging | null {
  try {
    return getAppMessaging();
  } catch (error) {
    console.warn("Firebase messaging native module unavailable:", error);
    return null;
  }
}

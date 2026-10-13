import { InteractionManager, Platform } from "react-native";
import { getAppMessaging } from "./firebaseMessaging";
import {
  deliverAndroidForegroundRemoteMessage,
  registerAndroidExpoForegroundNotificationListener,
} from "./pushForegroundAndroid";
import { recordPushDiagnostic } from "./pushDiagnostics";
import { ensureAndroidNotificationChannel } from "./pushPresentation";

let foregroundHandlersRegistered = false;
let registerInFlight: Promise<void> | null = null;

function registerAndroidOnMessageHandler(): void {
  const messaging = getAppMessaging();

  messaging.onMessage(async (remoteMessage) => {
    try {
      if (__DEV__) {
        console.log(
          "MEC_PUSH onMessage",
          JSON.stringify({
            data: remoteMessage.data ?? {},
            notification: remoteMessage.notification ?? null,
          }),
        );
      }

      recordPushDiagnostic("on_message", {
        dataKeys: remoteMessage.data ? Object.keys(remoteMessage.data) : [],
        hasNotification: Boolean(remoteMessage.notification),
      });

      await deliverAndroidForegroundRemoteMessage(remoteMessage, {
        scheduleLocalNotification: true,
      });
    } catch (error) {
      console.warn("Android foreground push handling failed:", error);
    }
  });
}

/**
 * Background FCM uses the system notification tray (no JS). Foreground requires
 * messaging().onMessage() plus a local notification — register after the channel
 * exists and the RN bridge has finished its first interactions (release-safe).
 */
export function ensureAndroidForegroundPushHandlers(): Promise<void> {
  if (Platform.OS !== "android") {
    return Promise.resolve();
  }

  if (foregroundHandlersRegistered) {
    return Promise.resolve();
  }

  if (registerInFlight) {
    return registerInFlight;
  }

  registerInFlight = new Promise<void>((resolve) => {
    void (async () => {
      try {
        await ensureAndroidNotificationChannel();

        await new Promise<void>((done) => {
          InteractionManager.runAfterInteractions(() => done());
        });

        registerAndroidExpoForegroundNotificationListener();
        registerAndroidOnMessageHandler();
        foregroundHandlersRegistered = true;
        recordPushDiagnostic("handlers_registered");
      } catch (error) {
        recordPushDiagnostic("handlers_register_failed", {
          message: error instanceof Error ? error.message : String(error),
        });
        console.warn("Android foreground push handler registration failed:", error);
      } finally {
        registerInFlight = null;
        resolve();
      }
    })();
  });

  return registerInFlight;
}

export function isAndroidForegroundHandlersRegistered(): boolean {
  return foregroundHandlersRegistered;
}

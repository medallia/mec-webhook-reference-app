import { DeviceEventEmitter } from "react-native";
import type { PushInvitation } from "./pushPayload";

export const ANDROID_FOREGROUND_PUSH_EVENT = "mec:android:foreground-push";

export function emitAndroidForegroundPush(invitation: PushInvitation): void {
  DeviceEventEmitter.emit(ANDROID_FOREGROUND_PUSH_EVENT, invitation);
}

export function subscribeAndroidForegroundPush(
  listener: (invitation: PushInvitation) => void,
): { remove: () => void } {
  const subscription = DeviceEventEmitter.addListener(ANDROID_FOREGROUND_PUSH_EVENT, listener);
  return { remove: () => subscription.remove() };
}

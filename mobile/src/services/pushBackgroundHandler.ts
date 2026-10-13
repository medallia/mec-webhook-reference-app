import { Platform } from "react-native";
import { getAppMessaging } from "./firebaseMessaging";
import { handleAndroidBackgroundRemoteMessage } from "./pushPresentation";

if (Platform.OS === "android") {
  try {
    getAppMessaging().setBackgroundMessageHandler(handleAndroidBackgroundRemoteMessage);
  } catch (error) {
    console.warn("Android background push handler registration failed:", error);
  }
}

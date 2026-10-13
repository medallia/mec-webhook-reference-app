const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const apiKey = process.env.EXPO_PUBLIC_API_KEY ?? "replace-me";
const privacyPolicyUrl = "https://www.medallia.com/legal/privacy-policy/";

export default {
  expo: {
    name: "Webhook Invites",
    slug: "distribution-webhook-demo",
    icon: "./assets/icon.png",
    version: "1.0.1",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    scheme: "distributionwebhook",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.medallia.demo.mecwebhook",
      googleServicesFile: "./GoogleService-Info.plist",
      infoPlist: {
        CFBundleDisplayName: "Webhook Invites",
        UIBackgroundModes: ["remote-notification"],
        ITSAppUsesNonExemptEncryption: false,
        NSUserNotificationsUsageDescription:
          "Turn on notifications to receive Medallia survey invitations on this device. You can use the app without notifications.",
      },
    },
    android: {
      package: "com.medallia.demo.mecwebhook",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
      softwareKeyboardLayoutMode: "resize",
      permissions: ["POST_NOTIFICATIONS"],
      adaptiveIcon: {
        // Regenerate: python3 scripts/generate-android-adaptive-foreground.py
        foregroundImage: "./assets/icon-android-foreground.png",
        backgroundColor: "#ffffff",
      },
    },
    plugins: [
      "expo-asset",
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            buildToolsVersion: "36.0.0",
            ndkVersion: "27.1.12297006",
          },
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#1F4FD8",
          defaultChannel: "survey-invitations",
          enableBackgroundRemoteNotifications: true,
        },
      ],
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
      "./plugins/withAndroidFcmDefaultChannel.js",
      "./plugins/withAndroidFcmProguard.js",
      "./plugins/withAndroidKeyboardResize.js",
    ],
    extra: {
      apiBaseUrl,
      apiKey,
      privacyPolicyUrl,
      eas: {
        projectId: process.env.EAS_PROJECT_ID ?? "replace-with-eas-project-id",
      },
    },
  },
};

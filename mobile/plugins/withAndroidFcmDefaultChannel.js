const { AndroidConfig, withAndroidManifest } = require("@expo/config-plugins");

const CHANNEL_ID = "survey-invitations";

const META = [
  {
    name: "com.google.firebase.messaging.default_notification_channel_id",
    attr: "android:value",
    value: CHANNEL_ID,
    replace: "android:value",
  },
  {
    name: "com.google.firebase.messaging.default_notification_color",
    attr: "android:resource",
    value: "@color/notification_icon_color",
    replace: "android:resource",
  },
  {
    name: "com.google.firebase.messaging.default_notification_icon",
    attr: "android:resource",
    value: "@drawable/notification_icon",
    replace: "android:resource",
  },
];

const MESSAGING_EVENT = "com.google.firebase.MESSAGING_EVENT";

function asArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Keep both FCM services. RN Firebase must win so messaging().onMessage() runs in
 * release builds; Expo remains registered as a fallback for expo-notifications.
 */
function applyMessagingServicePriorities(mainApplication) {
  const priorityByServiceSuffix = [
    { suffix: "ReactNativeFirebaseMessagingService", priority: "3" },
    { suffix: "ExpoFirebaseMessagingService", priority: "2" },
  ];

  for (const service of asArray(mainApplication.service)) {
    const serviceName = service.$?.["android:name"] ?? "";
    const target = priorityByServiceSuffix.find(
      (entry) => serviceName === entry.suffix || serviceName.endsWith(`.${entry.suffix}`),
    );
    if (!target) {
      continue;
    }

    for (const filter of asArray(service["intent-filter"])) {
      const handlesMessaging = asArray(filter.action).some(
        (action) => action.$?.["android:name"] === MESSAGING_EVENT,
      );
      if (!handlesMessaging) {
        continue;
      }

      filter.$ = {
        ...(filter.$ ?? {}),
        "android:priority": target.priority,
      };
    }
  }
}

/**
 * Resolves manifest merge conflicts between expo-notifications and
 * @react-native-firebase/messaging so FCM can display notifications on Android.
 */
function withAndroidFcmManifestMerge(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$ = {
      ...(manifest.$ ?? {}),
      "xmlns:tools": "http://schemas.android.com/tools",
    };

    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    mainApplication["meta-data"] ??= [];

    for (const entry of META) {
      const existing = mainApplication["meta-data"].find(
        (item) => item.$?.["android:name"] === entry.name,
      );

      if (existing) {
        existing.$[entry.attr] = entry.value;
        existing.$["tools:replace"] = entry.replace;
      } else {
        mainApplication["meta-data"].push({
          $: {
            "android:name": entry.name,
            [entry.attr]: entry.value,
            "tools:replace": entry.replace,
          },
        });
      }
    }

    applyMessagingServicePriorities(mainApplication);

    return config;
  });
}

module.exports = withAndroidFcmManifestMerge;

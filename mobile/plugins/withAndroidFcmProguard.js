const { withDangerousMod, createRunOncePlugin } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARKER = "# withAndroidFcmProguard";

const RULES = `${MARKER}
-keep class io.invertase.firebase.** { *; }
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class expo.modules.notifications.** { *; }
`;

/**
 * Release builds enable R8; keep FCM and notification modules from being stripped.
 */
function withAndroidFcmProguard(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const proguardPath = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "proguard-rules.pro",
      );

      if (!fs.existsSync(proguardPath)) {
        return config;
      }

      const contents = fs.readFileSync(proguardPath, "utf8");
      if (!contents.includes(MARKER)) {
        fs.writeFileSync(proguardPath, `${contents.trimEnd()}\n\n${RULES}`);
      }

      return config;
    },
  ]);
}

module.exports = createRunOncePlugin(withAndroidFcmProguard, "withAndroidFcmProguard");

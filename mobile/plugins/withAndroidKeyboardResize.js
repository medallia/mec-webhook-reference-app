const { withAndroidManifest } = require("@expo/config-plugins");

/** Ensures MainActivity uses adjustResize so ScrollView can scroll above the keyboard. */
function withAndroidKeyboardResize(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application?.activity) {
      return config;
    }

    for (const activity of application.activity) {
      const name = activity.$?.["android:name"] ?? "";
      if (name.endsWith("MainActivity")) {
        activity.$["android:windowSoftInputMode"] = "adjustResize";
      }
    }

    return config;
  });
}

module.exports = withAndroidKeyboardResize;

import Expo
import React
import ReactAppDependencyProvider
import UserNotifications

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate, UNUserNotificationCenterDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    FirebaseApp.configure()
    UNUserNotificationCenter.current().delegate = self

    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions
    )

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let userInfo = response.notification.request.content.userInfo
    let surveyUrl = userInfo["surveyUrl"] as? String
    let messageId = userInfo["messageId"] as? String

    if let surveyUrl, !surveyUrl.isEmpty {
      let appState = UIApplication.shared.applicationState

      if appState == .active {
        let encodedUrl = surveyUrl.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? surveyUrl
        var deepLink = "distributionwebhook://survey?url=\(encodedUrl)"
        if let messageId {
          deepLink += "&messageId=\(messageId)"
        }
        if let deepLinkUrl = URL(string: deepLink) {
          DispatchQueue.main.async {
            RCTLinkingManager.application(UIApplication.shared, open: deepLinkUrl, options: [:])
          }
        }
      } else {
        let defaults = UserDefaults.standard
        defaults.set(surveyUrl, forKey: "pendingSurveyUrl")
        if let messageId {
          defaults.set(messageId, forKey: "pendingMessageId")
        } else {
          defaults.removeObject(forKey: "pendingMessageId")
        }
        defaults.set(Date().timeIntervalSince1970, forKey: "pendingSurveyTimestamp")
        defaults.synchronize()
      }
    }

    completionHandler()
  }

  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .sound, .badge])
  }

  public override func application(
    _ application: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(application, open: url, options: options)
      || RCTLinkingManager.application(application, open: url, options: options)
  }

  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }

  public override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    Messaging.messaging().apnsToken = deviceToken
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  public override func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }

  public override func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    Messaging.messaging().appDidReceiveMessage(userInfo)
    super.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler)
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

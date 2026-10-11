import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import Firebase
import GoogleMaps   // 👈 Add this line

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    
    // Configure Firebase first
    FirebaseApp.configure()
    
    // Google Maps SDK key: GMSApiKey in Info.plist, filled from MAPS_KEY in the env file
    // at build time (Info.plist preprocessing with react-native-config's GeneratedInfoPlistDotEnv.h).
    if let mapsKey = Bundle.main.object(forInfoDictionaryKey: "GMSApiKey") as? String,
       !mapsKey.isEmpty, mapsKey != "MAPS_KEY" {
      GMSServices.provideAPIKey(mapsKey)
    } else {
      NSLog("[RaaHeHaq] GMSApiKey is not set; add MAPS_KEY to the env file and rebuild")
    }

    // Push permission is asked in context from JS (ride requested, driver online, the
    // notifications screen), never at launch (T-502, INF-14). Registering for remote
    // notifications shows no prompt; React Native Firebase owns the notification-center
    // delegate, so a foreground push reaches JS (in-app toast) without a system banner.
    application.registerForRemoteNotifications()
    
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    self.launchOptions = launchOptions

    // The window and React root are created in SceneDelegate: iOS 27 terminates apps
    // that have not adopted the UIScene lifecycle (T-115).
    return true
  }

  // Kept for SceneDelegate, which starts React Native once the window scene connects.
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  
  // Handle Firebase messaging
  func application(_ application: UIApplication,
                   didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    // Firebase messaging will be handled by React Native
  }
}


// MARK: - UIScene lifecycle (required on iOS 27, T-115)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else {
      NSLog("[SceneDelegate] React Native factory missing; cannot start the app")
      return
    }

    // If iOS reconnects a scene (it can drop one in the background), move the existing
    // React window onto it instead of starting a second React root.
    if let existing = appDelegate.window, existing.rootViewController != nil {
      existing.windowScene = windowScene
      self.window = existing
      existing.makeKeyAndVisible()
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    // Native modules (Reanimated keyboard observer, RNFirebase messaging) still read
    // UIApplication.shared.delegate.window, so keep the AppDelegate pointing at it.
    appDelegate.window = window

    factory.startReactNative(
      withModuleName: "RaaHeHaq",
      in: window,
      launchOptions: appDelegate.launchOptions
    )
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

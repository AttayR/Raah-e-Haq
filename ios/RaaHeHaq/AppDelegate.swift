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
      // React is already running: a link that reconnected the scene goes straight to Linking.
      if let url = connectionOptions.urlContexts.first?.url {
        RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
      }
      return
    }

    // A cold start from a raahehaq:// link (T-515): with scenes the URL arrives here, not in
    // launchOptions, so hand it to React Native's Linking.getInitialURL the classic way.
    if let url = connectionOptions.urlContexts.first?.url {
      var options = appDelegate.launchOptions ?? [:]
      options[.url] = url
      appDelegate.launchOptions = options
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

  // raahehaq:// links while the app runs (T-515: the top-up checkout's return link). With the
  // UIScene lifecycle iOS calls this instead of application(_:open:options:).
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  // T-531: until the JS splash mounts, the React root shows the launch screen (brand colour and
  // logo) instead of the default white system background, so there is no flash in between.
  override func customize(_ rootView: RCTRootView) {
    super.customize(rootView)
    rootView.backgroundColor = UIColor(named: "SplashBackground") ?? .systemBackground
    if let launch = UIStoryboard(name: "LaunchScreen", bundle: nil).instantiateInitialViewController()?.view {
      launch.frame = rootView.bounds
      launch.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      rootView.loadingView = launch
    }
  }

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

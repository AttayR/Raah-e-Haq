/**
 * T-115: the Debug app exited at launch on the iOS 27 simulator. UIKit on iOS 27 traps
 * (EXC_BREAKPOINT in _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption) when an
 * app has not adopted the UIScene lifecycle. The app must declare a scene manifest and create
 * its window and React root from a UIWindowSceneDelegate, not in didFinishLaunching.
 */

// Jest runs from the repository root; paths are relative to it.
const { readFileSync } = jest.requireActual<{
  readFileSync: (file: string, encoding: 'utf8') => string;
}>('fs');

const infoPlist = readFileSync('ios/RaaHeHaq/Info.plist', 'utf8');
const appDelegate = readFileSync('ios/RaaHeHaq/AppDelegate.swift', 'utf8');

describe('iOS UIScene lifecycle (T-115)', () => {
  it('declares a single-window scene manifest pointing at SceneDelegate', () => {
    expect(infoPlist).toContain('<key>UIApplicationSceneManifest</key>');
    expect(infoPlist).toMatch(
      /<key>UIApplicationSupportsMultipleScenes<\/key>\s*<false\/>/,
    );
    expect(infoPlist).toContain(
      '<key>UIWindowSceneSessionRoleApplication</key>',
    );
    expect(infoPlist).toMatch(
      /<key>UISceneDelegateClassName<\/key>\s*<string>\$\(PRODUCT_MODULE_NAME\)\.SceneDelegate<\/string>/,
    );
  });

  it('defines SceneDelegate as a UIWindowSceneDelegate that starts React Native in a scene window', () => {
    expect(appDelegate).toMatch(
      /class SceneDelegate: UIResponder, UIWindowSceneDelegate/,
    );
    expect(appDelegate).toContain('UIWindow(windowScene: windowScene)');
    expect(appDelegate).toMatch(
      /startReactNative\(\s*withModuleName: "RaaHeHaq"/,
    );
    // Native modules still read UIApplication.shared.delegate.window.
    expect(appDelegate).toContain('appDelegate.window = window');
  });

  it('no longer creates a screen-bound window in the app delegate', () => {
    expect(appDelegate).not.toContain('UIWindow(frame: UIScreen.main.bounds)');
  });
});

// Module scope, so the helpers above do not clash with other script-style test files.
export {};

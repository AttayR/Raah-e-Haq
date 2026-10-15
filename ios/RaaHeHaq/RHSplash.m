#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

/**
 * T-539: the native splash stays up until JS has drawn its own splash. SceneDelegate
 * (AppDelegate.swift) puts the LaunchScreen view over the React root with this accessibility
 * identifier; the JS SplashScreen calls `RHSplash.hide()` once it is on screen, so the launch
 * screen hands over to an identical JS frame instead of an empty background (the logo blink).
 * Keep the identifier in step with `NativeSplash.identifier` in AppDelegate.swift.
 */
static NSString *const RHNativeSplashIdentifier = @"RHNativeSplash";

@interface RHSplash : NSObject <RCTBridgeModule>
@end

@implementation RHSplash

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

RCT_EXPORT_METHOD(hide)
{
  for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
    if (![scene isKindOfClass:UIWindowScene.class]) {
      continue;
    }
    for (UIWindow *window in ((UIWindowScene *)scene).windows) {
      for (UIView *view in [window.subviews copy]) {
        if (![view.accessibilityIdentifier isEqualToString:RHNativeSplashIdentifier]) {
          continue;
        }
        view.accessibilityIdentifier = nil;
        // The JS splash under it is identical, so a short fade only softens a mismatch.
        [UIView animateWithDuration:0.15
            animations:^{
              view.alpha = 0;
            }
            completion:^(__unused BOOL finished) {
              [view removeFromSuperview];
            }];
      }
    }
  }
}

@end

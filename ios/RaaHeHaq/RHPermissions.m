#import <CoreLocation/CoreLocation.h>
#import <React/RCTBridgeModule.h>

/**
 * UI-R8: reads the location authorization without asking for it, so the app can show its own
 * pre-prompt (src/features/permissions/primer.ts) only while iOS has not asked yet. The community
 * geolocation module has no read-only check: its first lookup or watch shows the OS prompt.
 * Resolves "notDetermined", "denied", "restricted" or "granted". Android uses PermissionsAndroid.
 */
@interface RHPermissions : NSObject <RCTBridgeModule>
@end

@implementation RHPermissions

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

RCT_EXPORT_METHOD(locationStatus : (RCTPromiseResolveBlock)resolve reject : (__unused RCTPromiseRejectBlock)reject)
{
  CLAuthorizationStatus status;
  if (@available(iOS 14.0, *)) {
    status = [CLLocationManager new].authorizationStatus;
  } else {
    status = [CLLocationManager authorizationStatus];
  }
  switch (status) {
    case kCLAuthorizationStatusNotDetermined:
      resolve(@"notDetermined");
      break;
    case kCLAuthorizationStatusDenied:
      resolve(@"denied");
      break;
    case kCLAuthorizationStatusRestricted:
      resolve(@"restricted");
      break;
    default:
      resolve(@"granted");
      break;
  }
}

@end

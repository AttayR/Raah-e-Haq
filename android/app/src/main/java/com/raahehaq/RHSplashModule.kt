package com.raahehaq

import android.app.UiModeManager
import android.content.Context
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * T-539: the native splash hand-over, called from the JS SplashScreen (src/core/nativeSplash.ts).
 *
 * - `hide()`: AppTheme's windowBackground is the splash (brand colour + logo, T-531). It stays
 *   until JS has drawn its own identical splash, then becomes the plain brand colour so the logo
 *   never shows behind the keyboard or a transition later. Swapping earlier (when React mounted
 *   its first, still empty view) showed the bare background: the logo blink.
 * - `setAppearance(preference)`: Settings → Appearance ("system" | "light" | "dark"). On Android 12+
 *   it is stored as the app's night mode, which the system also uses for the launch splash, so the
 *   next cold start opens in the user's appearance instead of the phone's.
 */
class RHSplashModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun hide() {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread { activity.window.setBackgroundDrawableResource(R.color.splash_background) }
  }

  @ReactMethod
  fun setAppearance(preference: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      // Before Android 12 the launch window always follows the system setting.
      return
    }
    val mode =
        when (preference) {
          "light" -> UiModeManager.MODE_NIGHT_NO
          "dark" -> UiModeManager.MODE_NIGHT_YES
          else -> UiModeManager.MODE_NIGHT_AUTO
        }
    val uiModeManager =
        reactApplicationContext.getSystemService(Context.UI_MODE_SERVICE) as? UiModeManager ?: return
    try {
      uiModeManager.setApplicationNightMode(mode)
    } catch (_: RuntimeException) {
      // Not supported on this device: the splash keeps following the system setting.
    }
  }

  companion object {
    const val NAME = "RHSplash"
  }
}

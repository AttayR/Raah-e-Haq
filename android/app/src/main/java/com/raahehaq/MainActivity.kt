package com.raahehaq

import android.os.Build
import android.os.Bundle
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * T-531 / T-539: AppTheme's windowBackground is the splash (brand colour + logo), so nothing white
 * shows between launch and the JS SplashScreen, which draws the same logo in the same place. The
 * JS splash calls RHSplashModule.hide() once it is on screen, which turns the window background
 * into the plain brand colour (never earlier, so the logo does not blink in between).
 */
class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "RaaHeHaq"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /**
   * Android 15+ draws a targetSdk 35+ app edge to edge whatever `edgeToEdgeEnabled` says, and an
   * edge-to-edge window is no longer shrunk by `adjustResize` when the keyboard opens. The JS side
   * relies on that resize on Android (KeyboardAvoidingView is iOS only, src/components/ui/keyboard.ts),
   * so without it the keyboard covers bottom buttons and the booking sheet. Padding the content
   * view by the keyboard's height gives the same result. Older versions still resize the window
   * themselves and are left alone, so the two never add up (T-592).
   *
   * Only the bottom is padded: the map still draws under the status bar, and the insets go on to
   * the children unchanged, so safe-area insets are the same as before. JS lifts nothing more in
   * this window on Android (`keyboardLift` in keyboard.ts). A native Modal is a window of its own
   * that this does not reach; the kit sheet measures its own keyboard overlap there
   * (`modalKeyboardLift`).
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
      val content = findViewById<View>(android.R.id.content)
      ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
        val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
        if (view.paddingBottom != keyboard) view.setPadding(0, 0, 0, keyboard)
        insets
      }
    }
  }
}

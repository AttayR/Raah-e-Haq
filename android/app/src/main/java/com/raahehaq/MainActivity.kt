package com.raahehaq

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
}

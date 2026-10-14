package com.raahehaq

import android.os.Bundle
import android.view.ViewGroup
import android.view.ViewTreeObserver
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

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

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    replaceSplashOnceReactDraws()
  }

  /**
   * T-531: AppTheme's windowBackground is the splash (brand colour + logo), so nothing white
   * shows between launch and the JS SplashScreen, which draws the same logo in the same place.
   * Once React has mounted its first view (the opaque JS splash) the window background becomes
   * the plain brand colour, so the logo never shows behind the keyboard or a transition later.
   */
  private fun replaceSplashOnceReactDraws() {
    val content = findViewById<ViewGroup>(android.R.id.content) ?: return
    val observer = content.viewTreeObserver
    observer.addOnGlobalLayoutListener(
        object : ViewTreeObserver.OnGlobalLayoutListener {
          override fun onGlobalLayout() {
            val reactRoot = content.getChildAt(0) as? ViewGroup ?: return
            if (reactRoot.childCount == 0) {
              return
            }
            if (content.viewTreeObserver.isAlive) {
              content.viewTreeObserver.removeOnGlobalLayoutListener(this)
            }
            // After this frame: the JS splash already covers the window, so the swap is invisible.
            content.post { window.setBackgroundDrawableResource(R.color.splash_background) }
          }
        })
  }
}

# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# T-532 (PERF-09): R8 is on for release. React Native, Hermes, React Native Firebase,
# react-native-maps, keychain, screens, reanimated and the other native modules ship their own
# consumer rules. react-native-config reads the generated BuildConfig fields by reflection
# (MAPS_KEY, API_URL, ...), so R8 must keep them.
-keep class com.raahehaq.BuildConfig { *; }

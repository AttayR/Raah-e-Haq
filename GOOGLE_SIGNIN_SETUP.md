# Google Sign-In Setup Guide

## Overview

This guide explains how to complete the Google Sign-In setup for your React Native app.

## What's Already Implemented

✅ Google Sign-In service configuration  
✅ Redux thunk for Google Sign-In  
✅ UI components with Google Sign-In button  
✅ Android permissions and basic configuration  
✅ Firebase integration

## Required Setup Steps

### 1. Firebase Console Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `raah-e-haq`
3. Go to **Authentication** > **Sign-in method**
4. Enable **Google** as a sign-in provider
5. Add your app's package name: `com.raahehaq`
6. Download the SHA-1 fingerprint:
   ```bash
   cd android
   ./gradlew signingReport
   ```
7. Add the SHA-1 fingerprint to Firebase Console
8. Get the **Web Client ID** from Firebase Console

### 2. Update Google Sign-In Configuration

Update the `webClientId` in `src/services/googleSignIn.ts`:

```typescript
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: 'YOUR_ACTUAL_WEB_CLIENT_ID.apps.googleusercontent.com', // Replace with actual ID
    offlineAccess: true,
    hostedDomain: '',
    forceCodeForRefreshToken: true,
  });
};
```

### 3. Android Configuration

The following files are already configured:

- ✅ `android/app/build.gradle` - Google Services plugin
- ✅ `android/build.gradle` - Google Services classpath
- ✅ `android/app/google-services.json` - Firebase configuration
- ✅ `android/app/src/main/AndroidManifest.xml` - Permissions

### 4. Testing

1. Build and run the app:

   ```bash
   npm run android
   ```

2. On the login screen, tap "Continue with Google"
3. Complete the Google Sign-In flow
4. User should be authenticated and redirected to the main app

## Troubleshooting

### Common Issues

1. **"Google Sign-In failed"**

   - Check if webClientId is correct
   - Verify SHA-1 fingerprint is added to Firebase
   - Ensure Google Sign-In is enabled in Firebase Console

2. **"Play services not available"**

   - Make sure Google Play Services is installed on the device
   - Test on a real device, not emulator

3. **"Invalid client"**
   - Verify package name matches Firebase configuration
   - Check if google-services.json is up to date

### Debug Steps

1. Check console logs for detailed error messages
2. Verify Firebase project settings
3. Test with different Google accounts
4. Ensure all dependencies are properly installed

## Files Modified

- `src/services/googleSignIn.ts` - Google Sign-In service
- `src/services/auth.ts` - Auth service integration
- `src/store/thunks/authThunks.ts` - Redux thunk
- `src/screens/Auth/LoginScreen.tsx` - UI with Google button
- `App.tsx` - Google Sign-In initialization
- `android/app/src/main/AndroidManifest.xml` - Permissions

## Next Steps

1. Get the Web Client ID from Firebase Console
2. Update the configuration in `googleSignIn.ts`
3. Test the implementation
4. Deploy to production

## Support

If you encounter issues:

1. Check the Firebase Console logs
2. Review the React Native Google Sign-In documentation
3. Verify all configuration steps are completed

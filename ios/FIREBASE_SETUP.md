# Firebase iOS Setup Guide

## Overview
This guide covers the complete Firebase setup for iOS in your RaaHeHaq project.

## What's Already Configured ✅

### 1. AppDelegate.swift
- Firebase initialization with environment-based configuration
- Push notification setup
- Background modes configuration
- Firebase Messaging integration

### 2. Podfile
- Firebase Core, Auth, Firestore, Storage, Messaging, and Analytics pods
- Modular headers configuration for Swift pods
- Proper dependency management

### 3. Info.plist
- Location permissions (when in use and always)
- Camera and photo library permissions
- Microphone permissions
- Background modes (remote notifications, location, background processing)
- App Transport Security settings

### 4. Firebase Configuration
- Environment-based configuration system
- Support for Dev, Staging, and Production environments
- Fallback to default configuration

## Next Steps Required 🔧

### 1. Download Environment-Specific GoogleService-Info.plist Files

#### For Development Environment:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project "raah-e-haq"
3. Go to Project Settings (gear icon) > General
4. In the "Your apps" section, add a new iOS app:
   - iOS bundle ID: `com.raahehaq.dev` (or similar)
   - App nickname: "RaaHeHaq Dev"
   - App Store ID: (leave blank for development)
5. Download the `GoogleService-Info.plist` file
6. Rename it to `GoogleService-Info-Dev.plist`
7. Place it in: `ios/Firebase/Dev/GoogleService-Info-Dev.plist`

#### For Staging Environment:
1. Follow the same steps but use bundle ID: `com.raahehaq.staging`
2. Rename to `GoogleService-Info-Staging.plist`
3. Place in: `ios/Firebase/Staging/GoogleService-Info-Staging.plist`

#### For Production Environment:
1. Use bundle ID: `com.raahehaq` (your current one)
2. Keep as `GoogleService-Info.plist`
3. Place in: `ios/GoogleService-Info.plist` (already done)

### 2. Update Bundle Identifiers in Xcode

1. Open `ios/RaaHeHaq.xcworkspace` in Xcode
2. Select your project in the navigator
3. Select the "RaaHeHaq" target
4. Go to "Build Settings" tab
5. Search for "Product Bundle Identifier"
6. Create different configurations:
   - Debug: `com.raahehaq.dev`
   - Release: `com.raahehaq`

### 3. Configure Build Schemes

1. In Xcode, go to Product > Scheme > Manage Schemes
2. Create new schemes for each environment:
   - RaaHeHaq-Dev
   - RaaHeHaq-Staging
   - RaaHeHaq-Prod

### 4. Test the Setup

1. Clean build folder: Product > Clean Build Folder
2. Build and run the project
3. Check console for Firebase initialization messages

## Current File Structure

```
ios/
├── RaaHeHaq/
│   ├── AppDelegate.swift          # Firebase initialization
│   ├── FirebaseConfig.swift       # Environment configuration
│   ├── Info.plist                 # Permissions and settings
│   └── GoogleService-Info.plist   # Production config
├── Firebase/
│   ├── Dev/                       # Development configs
│   ├── Staging/                   # Staging configs
│   └── Prod/                      # Production configs
├── Podfile                        # Firebase pods
└── FIREBASE_SETUP.md             # This file
```

## Troubleshooting

### Common Issues:

1. **"Firebase is already configured" error**
   - This is normal and expected
   - Firebase only initializes once per app session

2. **Build errors with Firebase pods**
   - Run `cd ios && pod install` again
   - Clean build folder in Xcode

3. **Permission denied errors**
   - Check Info.plist has proper usage descriptions
   - Ensure permissions are requested at runtime

4. **Firebase not connecting**
   - Verify GoogleService-Info.plist is in the correct location
   - Check bundle ID matches between Xcode and Firebase Console
   - Ensure internet connectivity

## Testing Firebase Features

### Authentication:
- Test sign-in/sign-up flows
- Verify user creation in Firebase Console

### Firestore:
- Test database read/write operations
- Check data appears in Firebase Console

### Storage:
- Test file upload/download
- Verify files appear in Firebase Storage

### Messaging:
- Test push notification delivery
- Check device token registration

## Support

If you encounter issues:
1. Check Firebase Console for error logs
2. Verify all configuration files are in place
3. Ensure bundle IDs match across all configurations
4. Check Xcode build logs for specific error messages

## Next Steps After Setup

1. Implement Firebase Authentication in your React Native code
2. Set up Firestore database rules
3. Configure Firebase Storage security rules
4. Set up Firebase Analytics events
5. Test push notifications
6. Configure environment-specific settings in Firebase Console

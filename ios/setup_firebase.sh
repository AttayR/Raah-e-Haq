#!/bin/bash

echo "Setting up Firebase for iOS..."

# Create Firebase directory structure if it doesn't exist
mkdir -p Firebase/Dev
mkdir -p Firebase/Staging
mkdir -p Firebase/Prod

echo "Firebase directory structure created:"
echo "  - Firebase/Dev/"
echo "  - Firebase/Staging/"
echo "  - Firebase/Prod/"

echo ""
echo "Next steps:"
echo "1. Download GoogleService-Info.plist files for each environment from Firebase Console:"
echo "   - Go to Firebase Console > Project Settings > General"
echo "   - Add iOS app for each environment (Dev, Staging, Prod)"
echo "   - Download the GoogleService-Info.plist for each"
echo ""
echo "2. Place the files in the following locations:"
echo "   - Development: Firebase/Dev/GoogleService-Info-Dev.plist"
echo "   - Staging: Firebase/Staging/GoogleService-Info-Staging.plist"
echo "   - Production: Firebase/Prod/GoogleService-Info-Prod.plist"
echo ""
echo "3. Run 'cd ios && pod install' to install Firebase pods"
echo ""
echo "4. Build and run your project"

echo ""
echo "Current GoogleService-Info.plist location: ios/GoogleService-Info.plist"
echo "This will be used as the default/fallback configuration"

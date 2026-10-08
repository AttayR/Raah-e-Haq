# Release notes for the owner (B-05: signing)

These steps need the owner: they involve signing keys and store accounts, which agents never create or handle. The code is ready (T-108). It only needs the values below on the machine (or CI) that builds a release.

## Android: upload keystore and Play App Signing

The release build reads four values from Gradle properties or environment variables:

| Name | What it is |
|---|---|
| `RH_UPLOAD_STORE_FILE` | Absolute path to the upload keystore (`.jks`) |
| `RH_UPLOAD_STORE_PASSWORD` | Keystore password |
| `RH_UPLOAD_KEY_ALIAS` | Key alias inside the keystore |
| `RH_UPLOAD_KEY_PASSWORD` | Key password |

If any is missing, or the file doesn't exist, `assembleRelease`, `bundleRelease` and `installRelease` stop with a message that names what's missing. Release is never signed with the debug key. Debug builds don't need these values.

### One-time setup

1. **Create the upload keystore** on your own machine, outside the repo:
   ```sh
   keytool -genkeypair -v -storetype JKS -keystore ~/keys/raahehaq-upload.jks \
     -alias raahehaq-upload -keyalg RSA -keysize 2048 -validity 10000
   ```
   Use strong passwords and keep them in a password manager.
2. **Back up the keystore and passwords** in two safe places (for example a password manager plus an encrypted offline copy). With Play App Signing a lost upload key can be reset through Play Console support, but that takes time.
3. **Give the build the values.** Add them to `~/.gradle/gradle.properties` (your user Gradle file, not `android/gradle.properties` in the repo):
   ```properties
   RH_UPLOAD_STORE_FILE=/Users/<you>/keys/raahehaq-upload.jks
   RH_UPLOAD_STORE_PASSWORD=...
   RH_UPLOAD_KEY_ALIAS=raahehaq-upload
   RH_UPLOAD_KEY_PASSWORD=...
   ```
   On CI, store them as secrets and export them as environment variables (decode the keystore from a base64 secret to a temp file and point `RH_UPLOAD_STORE_FILE` at it). The template is `android/release-signing.example.properties`.
4. **Enable Play App Signing** in Play Console (app → *Test and release* → *App integrity*). Google holds the app signing key; you upload bundles signed with the upload key.
5. **Build the bundle:** `cd android && ./gradlew bundleRelease`. The file is `android/app/build/outputs/bundle/release/app-release.aab`.
6. **Maps and Firebase:** after Play App Signing is on, add the **app signing key** SHA-1/SHA-256 from Play Console (and the upload key's) to the Android restriction of the Google Maps key (B-02) and to the Firebase Android app.

Never commit a keystore, `.jks`, passwords or a filled-in properties file. `.gitignore` already ignores `*.keystore` (except the debug one), `*.jks` and `release-signing.properties`.

## iOS: certificates

- Apple Developer account: create the App ID (`com.raahehaq`), a distribution certificate and an App Store provisioning profile, or let Xcode manage signing with the team selected.
- Push notifications (FCM): enable the Push Notifications capability and upload an APNs key to Firebase (Project settings → Cloud Messaging).
- The app declares only the `remote-notification` background mode, asks for location *when in use* only (B-08: foreground only), and is portrait only.

## Later (T-705)

Versioning (`versionCode`/`versionName`), R8 minification and the final iOS config are done in T-705.

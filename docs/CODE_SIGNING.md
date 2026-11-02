# Code signing (macOS)

An unsigned Mac app shows a scary "can't be opened because Apple cannot check it" warning. Signing proves the app comes from you; **notarizing** has Apple scan it and approve it. After both, Luna MD opens normally on any Mac.

The project is already set up for both. Nothing happens until you add your Apple credentials. Without them the build still works, it just isn't signed.

## What you need (one time)

1. **Join the Apple Developer Program** at https://developer.apple.com/programs/ ($99 a year). It's required for signing apps outside the App Store.
2. **Create a "Developer ID Application" certificate:**
   - Open **Xcode → Settings → Accounts**, select your Apple ID, click **Manage Certificates…**, then **+ → Developer ID Application**.
   - Or create it at https://developer.apple.com/account/resources/certificates.
   - It's now in your **Keychain Access** under *My Certificates*.
3. **Find your Team ID:** the 10-character code at https://developer.apple.com/account (Membership details).
4. **Make an app-specific password** at https://account.apple.com → *Sign-In and Security* → *App-Specific Passwords*. This is what notarization uses instead of your real password.

## Build a signed app on your Mac

With the certificate in your keychain, electron-builder finds it automatically. Add the notarization details and build:

```bash
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
export APPLE_TEAM_ID="ABCDE12345"

npm run release:mac
```

Signed, notarized `.dmg` and `.zip` files (Apple Silicon and Intel) land in `dist/`. Notarization usually takes a few minutes.

> Tip: put the three `export` lines in a file that's **not** committed (for example `~/.luna-signing`) and run `source ~/.luna-signing` before building.

## Build signed releases on GitHub (optional)

`.github/workflows/release.yml` builds the app for every platform whenever you push a version tag and publishes a GitHub release. Once these secrets are added, the Mac build in that workflow is also signed and notarized.

1. **Export your certificate** from Keychain Access: right-click *Developer ID Application: Your Name* → **Export…** → save as `certificate.p12` with a password.
2. **Turn it into text:**
   ```bash
   base64 -i certificate.p12 | pbcopy
   ```
3. In your repo on GitHub, open **Settings → Secrets and variables → Actions** and add:

   | Secret | Value |
   |---|---|
   | `MAC_CERTIFICATE_P12_BASE64` | the text you just copied |
   | `MAC_CERTIFICATE_PASSWORD` | the password you exported it with |
   | `APPLE_ID` | your Apple ID email |
   | `APPLE_APP_SPECIFIC_PASSWORD` | the app-specific password |
   | `APPLE_TEAM_ID` | your Team ID |

4. **Release:**
   ```bash
   npm version patch        # bumps the version, e.g. 0.0.1 → 0.0.2, and makes a tag
   git push --follow-tags
   ```

Delete `certificate.p12` from your disk afterwards, and never commit it.

## Check that it worked

```bash
codesign --verify --deep --strict --verbose=2 "dist/mac-arm64/Luna MD.app"
spctl --assess --type execute --verbose "dist/mac-arm64/Luna MD.app"   # should say: accepted, source=Notarized Developer ID
```

## How it's configured

- `electron-builder.yml` → `mac`: hardened runtime on, entitlements from `build/entitlements.mac.plist`, and DMG + ZIP builds for both chip types.
- `build/entitlements.mac.plist`: only what Electron needs to run (`allow-jit`, `allow-unsigned-executable-memory`).
- Signing uses the keychain certificate, or `CSC_LINK` / `CSC_KEY_PASSWORD` in CI.
- Notarization runs automatically when `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` are set. If they're missing, the build logs "skipped macOS notarization" and carries on.

## Windows and Linux

Linux apps don't need signing. Windows builds are unsigned for now, so Windows shows a SmartScreen warning the first time. Signing them needs a code-signing certificate (or Azure Trusted Signing) and is a possible future step.

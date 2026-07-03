# Yamio — Native iOS App (Capacitor)

The iPhone build is the same Capacitor setup as Android (see `ANDROID.md`):
the whole game ships **inside the app binary**, loads from local files, works
offline, and gets native splash / haptics / back-gesture behavior from
`js/native-app.js`. Only Firebase (multiplayer, auth, credits) touches the
network.

> iPhones install from **Apple's App Store**, not Google Play — this is a
> separate submission with its own requirements.

## No Mac? Build from your phone (GitHub Actions)

The repo ships a cloud build pipeline — `.github/workflows/ios-appstore.yml` —
that builds, signs and uploads the app to App Store Connect on a rented cloud
Mac. Everything is triggered and monitored from a phone browser.

**One-time setup:**

1. In [App Store Connect](https://appstoreconnect.apple.com) → *Users and
   Access* → *Integrations* → *App Store Connect API* → **Team Keys** →
   **Generate API Key**. Name it anything, role **App Manager**. Download the
   `.p8` file (only offered ONCE — keep it) and note the **Key ID** and the
   page's **Issuer ID**.
2. In the GitHub repo → *Settings* → *Secrets and variables* → *Actions* →
   add three secrets:
   - `ASC_KEY_ID` — the Key ID
   - `ASC_ISSUER_ID` — the Issuer ID
   - `ASC_KEY_P8` — the full text contents of the `.p8` file
     (open it in a text viewer and copy everything, including the
     BEGIN/END PRIVATE KEY lines)

**Every release:**

1. GitHub → *Actions* → **iOS — Build & Upload to App Store** →
   **Run workflow**. (~20–30 min; the build number increments automatically.)
2. When it finishes, the build appears in App Store Connect under
   **TestFlight** after Apple processes it (~15–30 min more). Install it via
   TestFlight to play-test on your iPhone.
3. On the app's version page, select the build and **Submit for Review**.

Signing is fully automatic: the workflow uses the API key for "cloud signing",
which creates the distribution certificate and provisioning profile on
Apple's side. The Sign in with Apple capability is already wired into the
project (`App/App.entitlements`), and the app icon + splash are committed, so
there is nothing left that needs Xcode.

> If the repo is private, note that GitHub bills macOS runner minutes at 10×
> — the free tier covers roughly 8–12 builds per month.

## Building locally instead (Mac route)

- A **Mac** with [Xcode](https://apps.apple.com/app/xcode/id497799835) installed
- [CocoaPods](https://cocoapods.org): `sudo gem install cocoapods`
- An [Apple Developer Program](https://developer.apple.com/programs/) account
  (US$99/year) to submit to the App Store

## Build & run (on the Mac)

```bash
npm install
npm run sync          # builds www/ and syncs android/ + ios/
cd ios/App && pod install && cd ../..
npm run open:ios      # opens the project in Xcode
```

In Xcode:

1. Select the **App** target → *Signing & Capabilities* → pick your Apple
   Developer team (Xcode manages certificates automatically).
2. Run on a simulator or a plugged-in iPhone to test.
3. For the App Store: **Product → Archive**, then *Distribute App → App Store
   Connect*.

The bundle id is `io.yamio.app` and the marketing version is `2.0.0` (build
number `1`) — bump the build number in Xcode for each upload.

## Sign in with Apple (required — one-time setup)

Apple requires Sign in with Apple when an app offers Google login
(guideline 4.8). The app implements it natively (`js/native-auth.js` +
`@capacitor-community/apple-sign-in`): inside the iOS app the login bar
shows a black "Sign in with Apple" button (the Google popup flow cannot run
inside a WebView, so the Google button is hidden there — Google login remains
on the web/PWA). Two console steps to activate it:

1. **Xcode**: App target → *Signing & Capabilities* → **+ Capability** →
   **Sign in with Apple**. (Requires your Apple Developer team selected.)
2. **Firebase console**: *Authentication → Sign-in method → Add provider →
   Apple* → Enable. No Service ID needed for the native iOS flow.

Accounts land in the same Firebase project; the in-app account-deletion flow
re-authenticates through the native Apple sheet when needed.

## App Store submission notes

- Create the app record in [App Store Connect](https://appstoreconnect.apple.com)
  with bundle id `io.yamio.app`, screenshots, description, and the privacy
  policy URL (`https://yamio.io/privacy.html`).
- **Account deletion**: Apple requires in-app account deletion for apps with
  sign-in — Yamio's delete-account flow already satisfies this.
- **iPhone-only** (`TARGETED_DEVICE_FAMILY = 1`) and **portrait-locked**, so
  only iPhone screenshots are needed and there's no iPad layout to review.
- **Export compliance** is pre-answered (`ITSAppUsesNonExemptEncryption = NO`
  — the app only uses standard HTTPS).
- **Guideline 4.2 (minimum functionality)**: Apple is stricter than Google
  about web-wrapper apps. Yamio's case: content is bundled (not a loaded
  website), works fully offline, has native haptics and splash. If a reviewer
  pushes back, emphasize offline play and the native integrations in the
  review notes.
- App icons: replace the placeholder set the same way as Android —
  `npx capacitor-assets generate --ios`.

## Every future update

```bash
npm run sync                       # after any web-file change
cd ios/App && pod install          # only when plugins changed
```

Then bump the build number, Archive, and upload. (The web/PWA at yamio.io
keeps updating instantly via Firebase — nothing changes there.)

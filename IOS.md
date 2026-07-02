# Yamio — Native iOS App (Capacitor)

The iPhone build is the same Capacitor setup as Android (see `ANDROID.md`):
the whole game ships **inside the app binary**, loads from local files, works
offline, and gets native splash / haptics / back-gesture behavior from
`js/native-app.js`. Only Firebase (multiplayer, auth, credits) touches the
network.

> iPhones install from **Apple's App Store**, not Google Play — this is a
> separate submission with its own requirements.

## Requirements (Apple's rules, no way around them)

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

## App Store submission notes

- Create the app record in [App Store Connect](https://appstoreconnect.apple.com)
  with bundle id `io.yamio.app`, screenshots, description, and the privacy
  policy URL (`https://yamio.io/privacy.html`).
- **Account deletion**: Apple requires in-app account deletion for apps with
  sign-in — Yamio's delete-account flow already satisfies this.
- **Sign in with Apple**: Apple requires it when an app offers third-party
  login (Google). Expect a review flag for this — adding Apple sign-in via
  Firebase Auth is the fix if they enforce it.
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

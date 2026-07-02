# Yamio — Native Android App (Capacitor)

> For the iPhone / App Store build, see [`IOS.md`](IOS.md).

The Play Store build is a **Capacitor** app: the whole game (HTML/JS/CSS/icons)
ships **inside the AAB** and loads instantly from local files — no website
loading, no browser UI, works offline. Only live data (Firebase multiplayer,
auth, credit wallet) touches the network, like any native game.

The web/PWA deployment on Firebase Hosting is unchanged; both builds share the
same source files.

## One-time setup

1. Install [Android Studio](https://developer.android.com/studio) and Node 18+.
2. `npm install`

## Build & run

```bash
npm run sync           # copy web files into www/ and sync the native projects
npm run open:android   # open in Android Studio
```

Then in Android Studio: run on a device/emulator, or **Build → Generate Signed
App Bundle** for a Play upload. CLI alternative:

```bash
cd android && ./gradlew bundleRelease
```

After ANY change to the web files (js/, css/, index.html), re-run `npm run sync`
before building.

## Publishing to the existing Play listing

The app id is `io.yamio.app` — the same as the current TWA listing, so uploads
update the existing app (players get it as a normal update):

- **Sign with the same upload key** you used for the TWA (the certificates in
  `.well-known/assetlinks.json`). A different key will be rejected by Play.
- **versionCode** lives in `android/app/build.gradle` (currently `100`). It
  must be **higher than the last version uploaded to Play** — bump it for every
  release.
- `targetSdkVersion` is set in `android/variables.gradle` (currently 35, which
  meets Play's 2025 target-API requirement). Bump it when Play raises the bar.

## App icons & splash

The generated project ships Capacitor's default icons. Replace them with the
Yamio ones in one step:

```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --android \
  --iconBackgroundColor '#1a1a2e' --splashBackgroundColor '#1a1a2e'
```

(It picks up `icons/icon-512.png` / a 1024px source if you add one under
`assets/`.)

## What's different inside the native app (vs the web/PWA)

`js/native-app.js` activates only under Capacitor and provides:

- **Native splash screen** — hidden by JS once the UI is ready.
- **Android back button** — closes the top-most overlay first, shows the
  in-game quit confirm during a match, and minimizes the app from the lobby
  (never a cold exit, never a browser back).
- **Haptics** — real vibration on dice rolls.
- **No PWA leftovers** — the service worker registration and the "Install app"
  banner are skipped (`js/dice-size-fix.js` bails out when native); assets are
  already local so there is nothing to cache.

On the web build, `js/asset-preloader.js` shows a one-time
"Downloading game data…" progress screen that precaches every asset through
the service worker, so the PWA also works fully offline after first launch.
The preloader is skipped inside the native app.

// Builds the Capacitor webDir (www/) from the repo's web app.
// The repo root IS the web app (it deploys to Firebase Hosting as-is), so the
// native build just copies the runtime files into www/ — no bundler involved.
// Run via: npm run build:www  (or npm run sync to also cap sync)
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');

// Everything index.html references at runtime. sw.js is intentionally NOT
// copied: inside the native app assets are local, so the service worker is
// pointless and js/native-app.js skips registering it anyway.
const COPY = [
  'index.html',
  'manifest.json',
  'icon.svg',
  'privacy.html',
  'deleteaccount.html',
  'css',
  'js',
  'icons',
  'vendor',
];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const entry of COPY) {
  const src = join(root, entry);
  if (!existsSync(src)) {
    console.warn(`build-www: skipping missing ${entry}`);
    continue;
  }
  cpSync(src, join(out, entry), { recursive: true });
}

// Stamp the real app version into the native bundle. On web the deploy
// workflow replaces __BUILD_VERSION__; the native build never runs that, so
// without this the footer falls back to "dev". Take the version straight from
// the iOS project's MARKETING_VERSION so it always matches the App Store build.
try {
  const pbxPath = join(root, 'ios/App/App.xcodeproj/project.pbxproj');
  const versionFile = join(out, 'js', 'version.js');
  if (existsSync(pbxPath) && existsSync(versionFile)) {
    const pbx = readFileSync(pbxPath, 'utf8');
    const m = pbx.match(/MARKETING_VERSION\s*=\s*([0-9][0-9.]*)/);
    const ver = m ? m[1] : null;
    if (ver) {
      let vjs = readFileSync(versionFile, 'utf8');
      vjs = vjs.replace('__BUILD_VERSION__', ver)
               .replace('__BUILD_TIME__', new Date().toISOString());
      writeFileSync(versionFile, vjs);
      console.log(`build-www: stamped version ${ver}`);
    }
  }
} catch (e) {
  console.warn('build-www: version stamp skipped —', e.message);
}

console.log('build-www: www/ ready');

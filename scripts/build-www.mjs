// Builds the Capacitor webDir (www/) from the repo's web app.
// The repo root IS the web app (it deploys to Firebase Hosting as-is), so the
// native build just copies the runtime files into www/ — no bundler involved.
// Run via: npm run build:www  (or npm run sync to also cap sync)
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
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

console.log('build-www: www/ ready');

import {defineConfig} from 'tsup';

// Bundles the CLI + server + shared lib to dist/. Runtime deps (better-sqlite3,
// express, musicbrainz-api, node-notifier, nodemailer, etc.) are kept external so
// they install normally on the user's machine — better-sqlite3's native binary in
// particular must not be bundled.
export default defineConfig({
  entry: {
    'cli/index': 'src/cli/index.ts',
  },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  splitting: false,
  // Don't clean: tsup shares the dist/ root with Vite's dist/web, and a full
  // clean would wipe the web build. tsup overwrites its own output each run, and
  // Vite empties dist/web itself.
  clean: false,
  dts: false,
  sourcemap: true,
  // Anything in dependencies stays external automatically; this is just explicit
  // insurance for the native module.
  external: ['better-sqlite3'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});

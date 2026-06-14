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
  target: 'node20',
  platform: 'node',
  splitting: false,
  clean: true,
  dts: false,
  sourcemap: true,
  // Anything in dependencies stays external automatically; this is just explicit
  // insurance for the native module.
  external: ['better-sqlite3'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});

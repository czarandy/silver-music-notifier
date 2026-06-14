import envPaths from 'env-paths';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';

// Resolve the per-user data directory. Defaults to the OS-appropriate config dir
// (e.g. ~/.config/silver-music-notifier on Linux), overridable via SMN_DATA_DIR.
export function dataDir(): string {
  const dir =
    process.env.SMN_DATA_DIR ??
    envPaths('silver-music-notifier', {suffix: ''}).data;
  mkdirSync(dir, {recursive: true});
  return dir;
}

export function dbPath(): string {
  return join(dataDir(), 'data.db');
}

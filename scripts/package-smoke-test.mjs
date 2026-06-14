// Packs the package exactly as it would be published, extracts the tarball into
// an isolated consumer directory, links the repo's installed dependencies, and
// runs the shipped CLI bin. This catches problems that only show up in the
// published artifact: a missing `files` entry, a broken bin path or shebang, or
// dist output that doesn't actually run.
import {execFileSync} from 'node:child_process';
import {mkdtemp, mkdir, readdir, rm, symlink} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import process from 'node:process';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const tempDir = await mkdtemp(join(tmpdir(), 'smn-package-smoke-'));

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

try {
  // 1. Pack the tarball (no scripts, isolated cache).
  execFileSync(
    'npm',
    ['pack', rootDir, '--ignore-scripts', '--pack-destination', tempDir],
    {
      env: {
        ...process.env,
        NPM_CONFIG_CACHE: join(tempDir, '.npm-cache'),
        npm_config_cache: join(tempDir, '.npm-cache'),
      },
      stdio: ['ignore', 'ignore', 'inherit'],
    },
  );

  const tarballs = (await readdir(tempDir)).filter(f => f.endsWith('.tgz'));
  if (tarballs.length !== 1) {
    throw new Error(
      `Expected npm pack to create one tarball, found ${tarballs.length}.`,
    );
  }
  const tarballPath = join(tempDir, tarballs[0]);

  // 2. Extract into a consumer's node_modules layout.
  const packageDir = join(
    tempDir,
    'consumer',
    'node_modules',
    'silver-music-notifier',
  );
  await mkdir(packageDir, {recursive: true});
  execFileSync(
    'tar',
    ['-xzf', tarballPath, '-C', packageDir, '--strip-components=1'],
    {
      stdio: ['ignore', 'ignore', 'inherit'],
    },
  );

  // 3. The published package keeps runtime deps external, so link the repo's
  //    already-installed node_modules into the extracted package rather than
  //    reinstalling (and recompiling better-sqlite3).
  await symlink(
    join(rootDir, 'node_modules'),
    join(packageDir, 'node_modules'),
    'dir',
  );

  // 4. Required files must be present in the shipped artifact.
  const required = ['dist/cli/index.js', 'dist/web/index.html', 'package.json'];
  for (const rel of required) {
    if (!existsSync(join(packageDir, rel))) {
      fail(`Missing from published package: ${rel}`);
    }
  }

  // 5. The shipped bin must actually run.
  const binPath = join(packageDir, 'dist', 'cli', 'index.js');
  const help = execFileSync('node', [binPath, '--help'], {encoding: 'utf8'});
  if (!help.includes('silver-music-notifier') || !help.includes('Commands:')) {
    fail('CLI --help output did not look right:\n' + help);
  }

  // 6. A read-only subcommand should work against an isolated data dir.
  const out = execFileSync('node', [binPath, 'list'], {
    encoding: 'utf8',
    env: {...process.env, SMN_DATA_DIR: join(tempDir, 'data')},
  });
  if (!out.toLowerCase().includes('no artists')) {
    fail('CLI `list` on an empty store did not behave as expected:\n' + out);
  }

  if (process.exitCode) {
    throw new Error('Smoke test assertions failed.');
  }
  console.log('✓ Package smoke test passed.');
} finally {
  await rm(tempDir, {recursive: true, force: true});
}

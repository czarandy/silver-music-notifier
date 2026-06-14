import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Command} from 'commander';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

// Mock the external boundaries the commands reach for: the MusicBrainz client,
// the web server, and the browser launcher. Everything else (SQLite via AppDb,
// Settings, Artist, Release) runs for real against a temp database.
const mocks = vi.hoisted(() => ({
  searchArtist: vi.fn(),
  fetchReleaseGroups: vi.fn(),
  startServer: vi.fn(),
  open: vi.fn(),
}));

vi.mock('../src/lib/musicbrainz.js', () => ({
  searchArtist: mocks.searchArtist,
  fetchReleaseGroups: mocks.fetchReleaseGroups,
}));
vi.mock('../src/server/index.js', () => ({
  startServer: mocks.startServer,
}));
vi.mock('open', () => ({default: mocks.open}));

import {AppDb} from '../src/lib/AppDb.js';
import {Artist} from '../src/lib/Artist.js';
import {Release} from '../src/lib/Release.js';
import {Settings} from '../src/lib/Settings.js';
import {registerList} from '../src/cli/commands/list.js';
import {registerAdd} from '../src/cli/commands/add.js';
import {registerRemove} from '../src/cli/commands/remove.js';
import {registerReleases} from '../src/cli/commands/releases.js';
import {registerDismiss} from '../src/cli/commands/dismiss.js';
import {registerRefresh} from '../src/cli/commands/refresh.js';
import {registerConfig} from '../src/cli/commands/config.js';
import {registerClearData} from '../src/cli/commands/clearData.js';
import {registerWeb} from '../src/cli/commands/web.js';
import {ensureMbContact} from '../src/cli/ensureContact.js';

const originalDataDir = process.env.SILVER_MUSIC_NOTIFIER_DATA_DIR;
let tempDir: string;
let logs: string[];
let errors: string[];

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'smn-cli-test-'));
  process.env.SILVER_MUSIC_NOTIFIER_DATA_DIR = tempDir;
  AppDb.closeDefault();
  process.exitCode = 0;

  logs = [];
  errors = [];
  vi.spyOn(console, 'log').mockImplementation((...a) => {
    logs.push(a.map(String).join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation((...a) => {
    errors.push(a.map(String).join(' '));
  });
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

  mocks.startServer.mockResolvedValue(undefined);
  mocks.open.mockResolvedValue(undefined);
});

afterEach(() => {
  AppDb.closeDefault();
  vi.restoreAllMocks();
  mocks.searchArtist.mockReset();
  mocks.fetchReleaseGroups.mockReset();
  mocks.startServer.mockReset();
  mocks.open.mockReset();
  if (originalDataDir == null) {
    delete process.env.SILVER_MUSIC_NOTIFIER_DATA_DIR;
  } else {
    process.env.SILVER_MUSIC_NOTIFIER_DATA_DIR = originalDataDir;
  }
  rmSync(tempDir, {force: true, recursive: true});
  process.exitCode = 0;
});

// Build a fresh program with just the command under test and run it. `from:
// 'user'` means argv is the user-facing args (no node/script prefix).
function run(
  register: (program: Command) => void,
  argv: string[],
): Promise<unknown> {
  const program = new Command();
  program.exitOverride();
  register(program);
  return program.parseAsync(argv, {from: 'user'});
}

const out = () => logs.join('\n');
const err = () => errors.join('\n');

function seedRelease(mbid: string, title: string, firstSeenAt: string): void {
  AppDb.getDefault()
    .prepare(
      `INSERT INTO release_groups
        (mbid, artist_mbid, title, primary_type, secondary_types,
         first_release_date, first_seen_at, last_seen_at)
       VALUES (?, 'artist-1', ?, 'Album', NULL, '2026-01-01', ?, ?)`,
    )
    .run(mbid, title, firstSeenAt, firstSeenAt);
}

describe('list', () => {
  it('reports when no artists are tracked', async () => {
    await run(registerList, ['list']);
    expect(out()).toContain('No artists tracked yet');
  });

  it('lists tracked artists with a count', async () => {
    Artist.add({mbid: 'a1', name: 'Alpha', disambiguation: 'band'});
    Artist.add({mbid: 'a2', name: 'Beta'});
    await run(registerList, ['list']);
    expect(out()).toContain('Alpha (band)  —  a1');
    expect(out()).toContain('Beta  —  a2');
    expect(out()).toContain('2 artists tracked.');
  });
});

describe('add', () => {
  it('adds an exact MBID without searching', async () => {
    await run(registerAdd, ['add', 'Radiohead', '--mbid', 'mbid-rh']);
    expect(mocks.searchArtist).not.toHaveBeenCalled();
    expect(Artist.get('mbid-rh')?.name).toBe('Radiohead');
    expect(out()).toContain('Added Radiohead.');
  });

  it('adds the single search match without prompting', async () => {
    mocks.searchArtist.mockResolvedValue([
      {
        mbid: 'mbid-1',
        name: 'Silver Artist',
        sortName: 'Artist, Silver',
        disambiguation: 'band',
      },
    ]);
    await run(registerAdd, ['add', 'silver']);
    expect(mocks.searchArtist).toHaveBeenCalledWith('silver');
    expect(Artist.get('mbid-1')?.name).toBe('Silver Artist');
    expect(out()).toContain('Added Silver Artist (mbid-1).');
  });

  it('picks the top result with --yes when several match', async () => {
    mocks.searchArtist.mockResolvedValue([
      {mbid: 'mbid-1', name: 'First', sortName: 'First', disambiguation: ''},
      {mbid: 'mbid-2', name: 'Second', sortName: 'Second', disambiguation: ''},
    ]);
    await run(registerAdd, ['add', 'query', '--yes']);
    expect(Artist.get('mbid-1')).toBeDefined();
    expect(Artist.get('mbid-2')).toBeUndefined();
  });

  it('reports when nothing matches', async () => {
    mocks.searchArtist.mockResolvedValue([]);
    await run(registerAdd, ['add', 'nobody']);
    expect(out()).toContain('No MusicBrainz artists found for "nobody".');
  });
});

describe('remove', () => {
  it('removes a tracked artist by name', async () => {
    Artist.add({mbid: 'a1', name: 'Alpha'});
    await run(registerRemove, ['remove', 'Alpha']);
    expect(Artist.get('a1')).toBeUndefined();
    expect(out()).toContain('Removed Alpha (a1).');
  });

  it('exits non-zero when no artist matches', async () => {
    await run(registerRemove, ['remove', 'ghost']);
    expect(out()).toContain('No tracked artist matched "ghost".');
    expect(process.exitCode).toBe(1);
  });
});

describe('releases', () => {
  it('reports when there are no releases', async () => {
    await run(registerReleases, ['releases']);
    expect(out()).toContain('No releases yet');
  });

  it('lists releases newest-first and supports --new and --limit', async () => {
    Artist.add({mbid: 'artist-1', name: 'Silver Artist'});
    seedRelease('r-old', 'Old', '2026-01-02T00:00:00.000Z');
    seedRelease('r-new', 'New', '2026-01-04T00:00:00.000Z');
    Settings.setLastRefreshAt('2026-01-03T00:00:00.000Z');

    await run(registerReleases, ['releases']);
    expect(out()).toContain('Silver Artist — New');
    expect(out()).toContain('Silver Artist — Old');

    logs = [];
    await run(registerReleases, ['releases', '--new']);
    expect(out()).toContain('NEW');
    expect(out()).toContain('New');
    expect(out()).not.toContain('Old');

    logs = [];
    await run(registerReleases, ['releases', '--limit', '1']);
    expect(out().split('\n').filter(Boolean)).toHaveLength(1);
  });
});

describe('dismiss', () => {
  it('dismisses the New badge for a release', async () => {
    Artist.add({mbid: 'artist-1', name: 'Silver Artist'});
    seedRelease('r-new', 'New', '2026-01-04T00:00:00.000Z');
    Settings.setLastRefreshAt('2026-01-03T00:00:00.000Z');

    await run(registerDismiss, ['dismiss', 'r-new']);
    expect(out()).toContain('Dismissed r-new.');
    expect(Release.list({onlyNew: true})).toEqual([]);
  });

  it('exits non-zero for an unknown release', async () => {
    await run(registerDismiss, ['dismiss', 'missing']);
    expect(out()).toContain('No release matched "missing".');
    expect(process.exitCode).toBe(1);
  });
});

describe('config', () => {
  it('prints all settings and a single key', async () => {
    await run(registerConfig, ['config', 'get']);
    expect(out()).toContain('notify.inPage = true');
    expect(out()).toContain('releaseFilter.primaryTypes = Album');

    logs = [];
    await run(registerConfig, ['config', 'get', 'smtp.port']);
    expect(out()).toBe('587');
  });

  it('rejects an unknown key on get', async () => {
    await run(registerConfig, ['config', 'get', 'nope.nope']);
    expect(err()).toContain('Unknown key: nope.nope');
    expect(process.exitCode).toBe(1);
  });

  it('sets scalar, boolean, and list values', async () => {
    await run(registerConfig, ['config', 'set', 'smtp.host', 'smtp.x.com']);
    expect(Settings.load().smtp.host).toBe('smtp.x.com');
    expect(out()).toContain('Set smtp.host.');

    await run(registerConfig, ['config', 'set', 'notify.desktop', 'false']);
    expect(Settings.load().notify.desktop).toBe(false);

    await run(registerConfig, [
      'config',
      'set',
      'releaseFilter.primaryTypes',
      'Album,EP',
    ]);
    expect(Settings.load().releaseFilter.primaryTypes).toEqual(['Album', 'EP']);
  });

  it('rejects an unknown key on set', async () => {
    await run(registerConfig, ['config', 'set', 'bogus.key', 'x']);
    expect(err()).toContain('Unknown key: bogus.key');
    expect(process.exitCode).toBe(1);
  });

  it('rejects an invalid primary type', async () => {
    await expect(
      run(registerConfig, [
        'config',
        'set',
        'releaseFilter.primaryTypes',
        'Album,Bogus',
      ]),
    ).rejects.toThrow(/Invalid primary type/);
  });
});

describe('clear-data', () => {
  it('refuses without confirmation in a non-interactive context', async () => {
    Artist.add({mbid: 'a1', name: 'Alpha'});
    await run(registerClearData, ['clear-data']);
    expect(err()).toContain('Refusing to clear data without confirmation');
    expect(process.exitCode).toBe(1);
    expect(Artist.list()).toHaveLength(1);
  });

  it('clears artists and releases with --yes but keeps settings', async () => {
    Settings.save({musicbrainz: {contact: 'keep@example.com'}});
    Artist.add({mbid: 'artist-1', name: 'Silver Artist'});
    seedRelease('r-1', 'Release', '2026-01-04T00:00:00.000Z');

    await run(registerClearData, ['clear-data', '--yes']);
    expect(out()).toContain(
      'Cleared 1 artist and 1 release. Settings were kept.',
    );
    expect(Artist.list()).toEqual([]);
    expect(Release.list()).toEqual([]);
    expect(Settings.load().musicbrainz.contact).toBe('keep@example.com');
  });
});

describe('refresh', () => {
  beforeEach(() => {
    Settings.save({musicbrainz: {contact: 'tests@example.com'}});
  });

  it('fetches, stores, and summarizes new releases', async () => {
    Artist.add({mbid: 'artist-1', name: 'Silver Artist'});
    mocks.fetchReleaseGroups.mockResolvedValue([
      {
        mbid: 'rg-1',
        title: 'Album One',
        primaryType: 'Album',
        secondaryTypes: [],
        firstReleaseDate: '2026-01-01',
      },
    ]);

    await run(registerRefresh, ['refresh', '--no-notify']);

    expect(mocks.fetchReleaseGroups).toHaveBeenCalledWith('artist-1');
    expect(out()).toContain('Scanned 1 artist; 1 new release.');
    expect(out()).toContain('Silver Artist — Album One [Album] (2026-01-01)');
    expect(Release.list().map(r => r.mbid)).toContain('rg-1');
  });

  it('filters out release types excluded by settings', async () => {
    Artist.add({mbid: 'artist-1', name: 'Silver Artist'});
    mocks.fetchReleaseGroups.mockResolvedValue([
      {
        mbid: 'rg-live',
        title: 'Live Album',
        primaryType: 'Album',
        secondaryTypes: ['Live'], // excluded by default
        firstReleaseDate: '2026-01-01',
      },
    ]);

    await run(registerRefresh, ['refresh', '--no-notify']);

    expect(out()).toContain('0 new releases.');
    expect(Release.list()).toEqual([]);
  });
});

describe('web', () => {
  it('starts the server and logs the URL without opening a browser', async () => {
    await run(registerWeb, ['web', '--port', '3999', '--no-open']);
    expect(mocks.startServer).toHaveBeenCalledWith(3999);
    expect(out()).toContain('http://localhost:3999');
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it('opens the browser by default', async () => {
    await run(registerWeb, ['web', '--port', '4000']);
    expect(mocks.startServer).toHaveBeenCalledWith(4000);
    expect(mocks.open).toHaveBeenCalledWith('http://localhost:4000');
  });
});

describe('ensureMbContact', () => {
  it('resolves when a contact is already configured', async () => {
    Settings.save({musicbrainz: {contact: 'set@example.com'}});
    await expect(ensureMbContact()).resolves.toBeUndefined();
  });

  it('throws setup guidance when missing in a non-interactive context', async () => {
    await expect(ensureMbContact()).rejects.toThrow(
      /MusicBrainz contact is not set/,
    );
  });
});

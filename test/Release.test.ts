import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {AppDb} from '../src/lib/AppDb.js';
import {Release} from '../src/lib/Release.js';
import {Settings} from '../src/lib/Settings.js';

const originalDataDir = process.env.SILVER_MUSIC_NOTIFIER_DATA_DIR;
let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'smn-release-test-'));
  process.env.SILVER_MUSIC_NOTIFIER_DATA_DIR = tempDir;
  AppDb.closeDefault();
});

afterEach(() => {
  AppDb.closeDefault();
  if (originalDataDir == null) {
    delete process.env.SILVER_MUSIC_NOTIFIER_DATA_DIR;
  } else {
    process.env.SILVER_MUSIC_NOTIFIER_DATA_DIR = originalDataDir;
  }
  rmSync(tempDir, {force: true, recursive: true});
});

function seedRelease(input: {
  mbid: string;
  title: string;
  firstReleaseDate: string | null;
  firstSeenAt: string;
}): void {
  AppDb.getDefault()
    .prepare(
      `INSERT INTO release_groups
        (mbid, artist_mbid, title, primary_type, secondary_types,
         first_release_date, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.mbid,
      'artist-1',
      input.title,
      'Album',
      'Live',
      input.firstReleaseDate,
      input.firstSeenAt,
      input.firstSeenAt,
    );
}

describe('Release', () => {
  it('lists releases as objects with new filtering and limits', () => {
    AppDb.getDefault()
      .prepare(
        `INSERT INTO artists (mbid, name, sort_name, disambiguation, added_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run('artist-1', 'Silver Artist', null, null, '2026-01-01T00:00:00.000Z');
    seedRelease({
      mbid: 'release-old',
      title: 'Old Release',
      firstReleaseDate: '2025-01-01',
      firstSeenAt: '2026-01-02T00:00:00.000Z',
    });
    seedRelease({
      mbid: 'release-new',
      title: 'New Release',
      firstReleaseDate: '2026-01-01',
      firstSeenAt: '2026-01-04T00:00:00.000Z',
    });
    Settings.setLastRefreshAt('2026-01-03T00:00:00.000Z');

    expect(Release.list().map(r => r.title)).toEqual([
      'New Release',
      'Old Release',
    ]);
    expect(Release.list({onlyNew: true})).toMatchObject([
      {
        mbid: 'release-new',
        artistMbid: 'artist-1',
        artistName: 'Silver Artist',
        title: 'New Release',
        primaryType: 'Album',
        secondaryTypes: 'Live',
        firstReleaseDate: '2026-01-01',
        firstSeenAt: '2026-01-04T00:00:00.000Z',
        isNew: true,
      },
    ]);
    expect(Release.list({limit: 1}).map(r => r.mbid)).toEqual(['release-new']);
  });
});

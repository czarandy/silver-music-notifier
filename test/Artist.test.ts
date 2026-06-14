import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {AppDb} from '../src/lib/AppDb.js';
import {Artist} from '../src/lib/Artist.js';

const originalDataDir = process.env.SILVER_MUSIC_NOTIFIER_DATA_DIR;
let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'smn-artist-test-'));
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

describe('Artist', () => {
  it('adds, lists, gets, and removes tracked artists', () => {
    expect(
      Artist.add({
        mbid: 'artist-2',
        name: 'beta Artist',
        sortName: 'Artist, Beta',
        disambiguation: 'second',
      }),
    ).toBe(true);
    expect(Artist.add({mbid: 'artist-1', name: 'Alpha Artist'})).toBe(true);
    expect(Artist.add({mbid: 'artist-1', name: 'Alpha Artist'})).toBe(false);

    expect(Artist.list().map(a => a.name)).toEqual([
      'Alpha Artist',
      'beta Artist',
    ]);
    expect(Artist.get('artist-2')).toMatchObject({
      mbid: 'artist-2',
      name: 'beta Artist',
      sortName: 'Artist, Beta',
      disambiguation: 'second',
    });

    const artist = Artist.getByMbidOrName('BETA ARTIST');
    expect(artist).toMatchObject({
      mbid: 'artist-2',
      name: 'beta Artist',
    });
    artist?.remove();
    expect(Artist.get('artist-2')).toBeUndefined();
    expect(Artist.getByMbidOrName('missing')).toBeUndefined();
  });
});

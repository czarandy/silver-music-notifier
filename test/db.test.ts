import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {openDb} from '../src/lib/db.js';

const tempDirs: string[] = [];

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'smn-db-test-'));
  tempDirs.push(dir);
  return join(dir, 'data.db');
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, {force: true, recursive: true});
  }
});

describe('AppDb', () => {
  it('initializes the schema and enables artist release cascade deletes', () => {
    const appDb = openDb(tempDbPath());
    const db = appDb.connection;

    db.prepare(
      `INSERT INTO artists (mbid, name, sort_name, disambiguation, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('artist-1', 'Silver Artist', null, null, '2026-01-01T00:00:00.000Z');
    db.prepare(
      `INSERT INTO release_groups
        (mbid, artist_mbid, title, primary_type, secondary_types,
         first_release_date, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'release-1',
      'artist-1',
      'First Release',
      'Album',
      null,
      '2026-01-02',
      '2026-01-03T00:00:00.000Z',
      '2026-01-03T00:00:00.000Z',
    );

    db.prepare('DELETE FROM artists WHERE mbid = ?').run('artist-1');

    const releaseCount = db
      .prepare('SELECT COUNT(*) AS count FROM release_groups')
      .get() as {count: number};
    expect(releaseCount.count).toBe(0);

    appDb.close();
  });
});

import {getDb, type ArtistRow} from './db.js';
import {getLastRefreshAt} from './settings.js';

export interface ReleaseListItem {
  mbid: string;
  artistMbid: string;
  artistName: string;
  title: string;
  primaryType: string | null;
  secondaryTypes: string | null;
  firstReleaseDate: string | null;
  firstSeenAt: string;
  isNew: boolean;
}

export interface NewArtistInput {
  mbid: string;
  name: string;
  sortName?: string | null;
  disambiguation?: string | null;
}

export function listArtists(): ArtistRow[] {
  return getDb()
    .prepare('SELECT * FROM artists ORDER BY name COLLATE NOCASE')
    .all() as ArtistRow[];
}

export function getArtist(mbid: string): ArtistRow | undefined {
  return getDb().prepare('SELECT * FROM artists WHERE mbid = ?').get(mbid) as
    | ArtistRow
    | undefined;
}

// Insert (or no-op if already tracked). Returns true if newly added.
export function addArtist(input: NewArtistInput): boolean {
  const res = getDb()
    .prepare(
      `INSERT INTO artists (mbid, name, sort_name, disambiguation, added_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(mbid) DO NOTHING`,
    )
    .run(
      input.mbid,
      input.name,
      input.sortName ?? null,
      input.disambiguation ?? null,
      new Date().toISOString(),
    );
  return res.changes > 0;
}

// Remove an artist by MBID, or by exact/case-insensitive name. Cascades to
// release_groups. Returns the removed artist, or undefined if nothing matched.
export function removeArtist(idOrName: string): ArtistRow | undefined {
  const db = getDb();
  const found =
    (db.prepare('SELECT * FROM artists WHERE mbid = ?').get(idOrName) as
      | ArtistRow
      | undefined) ??
    (db
      .prepare('SELECT * FROM artists WHERE name = ? COLLATE NOCASE')
      .get(idOrName) as ArtistRow | undefined);
  if (!found) {
    return undefined;
  }
  db.prepare('DELETE FROM artists WHERE mbid = ?').run(found.mbid);
  return found;
}

export function listReleases(
  opts: {onlyNew?: boolean; limit?: number} = {},
): ReleaseListItem[] {
  const lastRefresh = getLastRefreshAt();
  const rows = getDb()
    .prepare(
      `SELECT rg.mbid, rg.artist_mbid, a.name AS artist_name, rg.title,
              rg.primary_type, rg.secondary_types, rg.first_release_date,
              rg.first_seen_at
       FROM release_groups rg
       JOIN artists a ON a.mbid = rg.artist_mbid
       ORDER BY (rg.first_release_date IS NULL), rg.first_release_date DESC, rg.title`,
    )
    .all() as Array<{
    mbid: string;
    artist_mbid: string;
    artist_name: string;
    title: string;
    primary_type: string | null;
    secondary_types: string | null;
    first_release_date: string | null;
    first_seen_at: string;
  }>;

  // A release is "new" if it was first seen at or after the previous refresh
  // started — i.e. it showed up in the most recent refresh.
  const items: ReleaseListItem[] = rows.map(r => ({
    mbid: r.mbid,
    artistMbid: r.artist_mbid,
    artistName: r.artist_name,
    title: r.title,
    primaryType: r.primary_type,
    secondaryTypes: r.secondary_types,
    firstReleaseDate: r.first_release_date,
    firstSeenAt: r.first_seen_at,
    isNew: lastRefresh != null && r.first_seen_at >= lastRefresh,
  }));

  const filtered = opts.onlyNew ? items.filter(i => i.isNew) : items;
  return opts.limit ? filtered.slice(0, opts.limit) : filtered;
}

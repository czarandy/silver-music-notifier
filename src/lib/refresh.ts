import {getDb, type ArtistRow} from './db.js';
import {fetchReleaseGroups} from './musicbrainz.js';
import {setLastRefreshAt} from './settings.js';
import {notifyNewReleases} from './notify.js';

export interface NewRelease {
  mbid: string;
  artistMbid: string;
  artistName: string;
  title: string;
  primaryType: string | null;
  secondaryTypes: string[];
  firstReleaseDate: string | null;
}

export interface RefreshSummary {
  scannedArtists: number;
  newCount: number;
  newReleases: NewRelease[];
  errors: {artist: string; message: string}[];
  startedAt: string;
}

export interface RefreshOptions {
  notify?: boolean;
  onProgress?: (artist: ArtistRow, index: number, total: number) => void;
}

// Fetch release-groups for every tracked artist, upsert them, and collect the
// ones we'd never seen before. Shared by the CLI `refresh` command and the
// server's POST /api/refresh route.
export async function refresh(
  opts: RefreshOptions = {},
): Promise<RefreshSummary> {
  const db = getDb();
  const startedAt = new Date().toISOString();
  const artists = db
    .prepare('SELECT * FROM artists ORDER BY name COLLATE NOCASE')
    .all() as ArtistRow[];

  const existing = db.prepare('SELECT 1 FROM release_groups WHERE mbid = ?');
  const insert = db.prepare(`
    INSERT INTO release_groups
      (mbid, artist_mbid, title, primary_type, secondary_types,
       first_release_date, first_seen_at, last_seen_at)
    VALUES (@mbid, @artist_mbid, @title, @primary_type, @secondary_types,
            @first_release_date, @now, @now)
    ON CONFLICT(mbid) DO UPDATE SET
      title = excluded.title,
      primary_type = excluded.primary_type,
      secondary_types = excluded.secondary_types,
      first_release_date = excluded.first_release_date,
      last_seen_at = excluded.last_seen_at
  `);

  const newReleases: NewRelease[] = [];
  const errors: RefreshSummary['errors'] = [];

  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i];
    opts.onProgress?.(artist, i, artists.length);
    try {
      const groups = await fetchReleaseGroups(artist.mbid);
      const now = new Date().toISOString();
      const apply = db.transaction(() => {
        for (const g of groups) {
          const seen = existing.get(g.mbid);
          insert.run({
            mbid: g.mbid,
            artist_mbid: artist.mbid,
            title: g.title,
            primary_type: g.primaryType,
            secondary_types: g.secondaryTypes.join(', ') || null,
            first_release_date: g.firstReleaseDate,
            now,
          });
          if (!seen) {
            newReleases.push({
              mbid: g.mbid,
              artistMbid: artist.mbid,
              artistName: artist.name,
              title: g.title,
              primaryType: g.primaryType,
              secondaryTypes: g.secondaryTypes,
              firstReleaseDate: g.firstReleaseDate,
            });
          }
        }
      });
      apply();
    } catch (err) {
      errors.push({
        artist: artist.name,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  setLastRefreshAt(startedAt);

  const summary: RefreshSummary = {
    scannedArtists: artists.length,
    newCount: newReleases.length,
    newReleases,
    errors,
    startedAt,
  };

  if (opts.notify !== false && newReleases.length > 0) {
    await notifyNewReleases(newReleases);
  }

  return summary;
}

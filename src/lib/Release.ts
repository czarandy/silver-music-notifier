import {AppDb} from './AppDb.js';
import {getLastRefreshAt} from './settings.js';

export interface ReleaseListOptions {
  onlyNew?: boolean;
  limit?: number;
}

export class Release {
  readonly mbid: string;
  readonly artistMbid: string;
  readonly artistName: string;
  readonly title: string;
  readonly primaryType: string | null;
  readonly secondaryTypes: string | null;
  readonly firstReleaseDate: string | null;
  readonly firstSeenAt: string;
  readonly isNew: boolean;

  private constructor(input: {
    mbid: string;
    artistMbid: string;
    artistName: string;
    title: string;
    primaryType: string | null;
    secondaryTypes: string | null;
    firstReleaseDate: string | null;
    firstSeenAt: string;
    lastRefresh: string | null;
  }) {
    this.mbid = input.mbid;
    this.artistMbid = input.artistMbid;
    this.artistName = input.artistName;
    this.title = input.title;
    this.primaryType = input.primaryType;
    this.secondaryTypes = input.secondaryTypes;
    this.firstReleaseDate = input.firstReleaseDate;
    this.firstSeenAt = input.firstSeenAt;
    this.isNew =
      input.lastRefresh != null && input.firstSeenAt >= input.lastRefresh;
  }

  static list(opts: ReleaseListOptions = {}): Release[] {
    const lastRefresh = getLastRefreshAt();
    const rows = AppDb.getDefault()
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
    // started, meaning it showed up in the most recent refresh.
    const items = rows.map(
      row =>
        new Release({
          mbid: row.mbid,
          artistMbid: row.artist_mbid,
          artistName: row.artist_name,
          title: row.title,
          primaryType: row.primary_type,
          secondaryTypes: row.secondary_types,
          firstReleaseDate: row.first_release_date,
          firstSeenAt: row.first_seen_at,
          lastRefresh,
        }),
    );
    const filtered = opts.onlyNew ? items.filter(i => i.isNew) : items;
    return opts.limit ? filtered.slice(0, opts.limit) : filtered;
  }
}

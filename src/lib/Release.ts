import {AppDb} from './AppDb.js';
import {Settings} from './Settings.js';
import type {
  ReleaseGroupPrimaryType,
  ReleaseGroupSecondaryType,
} from './releaseTypes.js';

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
    dismissedAt: string | null;
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
      input.dismissedAt == null &&
      input.lastRefresh != null &&
      input.firstSeenAt >= input.lastRefresh;
  }

  static list(opts: ReleaseListOptions = {}): Release[] {
    const lastRefresh = Settings.getLastRefreshAt();
    const settings = Settings.load();
    const rows = AppDb.getDefault()
      .prepare(
        `SELECT rg.mbid, rg.artist_mbid, a.name AS artist_name, rg.title,
                rg.primary_type, rg.secondary_types, rg.first_release_date,
                rg.first_seen_at, rg.dismissed_at
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
      dismissed_at: string | null;
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
          dismissedAt: row.dismissed_at,
          lastRefresh,
        }),
    );
    // Re-apply the current release-type filters so releases that no longer
    // match the user's settings (e.g. a secondary type they just chose to
    // exclude) drop out of the list without requiring a refresh.
    const matching = items.filter(item =>
      settings.includeRelease({
        primaryType: item.primaryType as ReleaseGroupPrimaryType | null,
        secondaryTypes: item.secondaryTypes
          ? (item.secondaryTypes.split(', ') as ReleaseGroupSecondaryType[])
          : [],
      }),
    );
    const filtered = opts.onlyNew ? matching.filter(i => i.isNew) : matching;
    return opts.limit ? filtered.slice(0, opts.limit) : filtered;
  }

  static dismiss(mbid: string): boolean {
    const res = AppDb.getDefault()
      .prepare('UPDATE release_groups SET dismissed_at = ? WHERE mbid = ?')
      .run(new Date().toISOString(), mbid);
    return res.changes > 0;
  }
}

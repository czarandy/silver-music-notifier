import {AppDb} from './AppDb.js';

interface ArtistRow {
  mbid: string;
  name: string;
  sort_name: string | null;
  disambiguation: string | null;
  type: string | null;
  country: string | null;
  added_at: string;
}

export interface ArtistAddInput {
  mbid: string;
  name: string;
  sortName?: string | null;
  disambiguation?: string | null;
  type?: string | null;
  country?: string | null;
}

export class Artist {
  readonly mbid: string;
  readonly name: string;
  readonly sortName: string | null;
  readonly disambiguation: string | null;
  readonly type: string | null;
  readonly country: string | null;
  readonly addedAt: string;

  private constructor(row: ArtistRow) {
    this.mbid = row.mbid;
    this.name = row.name;
    this.sortName = row.sort_name;
    this.disambiguation = row.disambiguation;
    this.type = row.type;
    this.country = row.country;
    this.addedAt = row.added_at;
  }

  static list(): Artist[] {
    const rows = AppDb.getDefault()
      .prepare('SELECT * FROM artists ORDER BY name COLLATE NOCASE')
      .all() as ArtistRow[];
    return rows.map(row => new Artist(row));
  }

  static get(mbid: string): Artist | undefined {
    const row = AppDb.getDefault()
      .prepare('SELECT * FROM artists WHERE mbid = ?')
      .get(mbid) as ArtistRow | undefined;
    return row ? new Artist(row) : undefined;
  }

  static getByMbidOrName(idOrName: string): Artist | undefined {
    const db = AppDb.getDefault();
    const row =
      (db.prepare('SELECT * FROM artists WHERE mbid = ?').get(idOrName) as
        | ArtistRow
        | undefined) ??
      (db
        .prepare('SELECT * FROM artists WHERE name = ? COLLATE NOCASE')
        .get(idOrName) as ArtistRow | undefined);
    return row ? new Artist(row) : undefined;
  }

  // Insert (or no-op if already tracked). Returns true if newly added.
  static add(input: ArtistAddInput): boolean {
    const res = AppDb.getDefault()
      .prepare(
        `INSERT INTO artists
           (mbid, name, sort_name, disambiguation, type, country, added_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(mbid) DO NOTHING`,
      )
      .run(
        input.mbid,
        input.name,
        input.sortName ?? null,
        input.disambiguation ?? null,
        input.type ?? null,
        input.country ?? null,
        new Date().toISOString(),
      );
    return res.changes > 0;
  }

  // Cascades to release_groups through the database foreign key.
  remove(): void {
    AppDb.getDefault()
      .prepare('DELETE FROM artists WHERE mbid = ?')
      .run(this.mbid);
  }

  // Delete every tracked artist (cascading to release_groups). Returns the
  // number of artists and releases removed.
  static clearAll(): {artists: number; releases: number} {
    const db = AppDb.getDefault();
    const {n: releases} = db
      .prepare('SELECT COUNT(*) AS n FROM release_groups')
      .get() as {n: number};
    const result = db.prepare('DELETE FROM artists').run();
    return {artists: result.changes, releases};
  }
}

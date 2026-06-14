import Database from 'better-sqlite3';
import {dbPath} from './paths.js';

export interface ArtistRow {
  mbid: string;
  name: string;
  sort_name: string | null;
  disambiguation: string | null;
  added_at: string;
}

export interface ReleaseGroupRow {
  mbid: string;
  artist_mbid: string;
  title: string;
  primary_type: string | null;
  secondary_types: string | null;
  first_release_date: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

let db: Database.Database | null = null;

// Open (and lazily initialize) the SQLite database. Schema creation is idempotent
// so this is safe to call from every CLI invocation and from the server.
export function getDb(): Database.Database {
  if (db) {
    return db;
  }
  db = new Database(dbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS artists (
      mbid           TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      sort_name      TEXT,
      disambiguation TEXT,
      added_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS release_groups (
      mbid               TEXT PRIMARY KEY,
      artist_mbid        TEXT NOT NULL REFERENCES artists(mbid) ON DELETE CASCADE,
      title              TEXT NOT NULL,
      primary_type       TEXT,
      secondary_types    TEXT,
      first_release_date TEXT,
      first_seen_at      TEXT NOT NULL,
      last_seen_at       TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rg_artist ON release_groups(artist_mbid);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

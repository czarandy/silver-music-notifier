import Database from 'better-sqlite3';
import {dbPath} from './paths.js';

export class AppDb {
  private static defaultDb: AppDb | null = null;

  readonly connection: Database.Database;

  constructor(path = dbPath()) {
    this.connection = new Database(path);
    this.initialize();
  }

  static getDefault(): Database.Database {
    this.defaultDb ??= new AppDb();
    return this.defaultDb.connection;
  }

  static closeDefault(): void {
    this.defaultDb?.close();
    this.defaultDb = null;
  }

  close(): void {
    this.connection.close();
  }

  private initialize(): void {
    this.connection.pragma('journal_mode = WAL');
    this.connection.pragma('foreign_keys = ON');
    this.connection.exec(`
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
    this.ensureColumn('release_groups', 'dismissed_at', 'TEXT');
  }

  private ensureColumn(
    table: string,
    column: string,
    definition: string,
  ): void {
    const columns = this.connection
      .prepare(`PRAGMA table_info(${table})`)
      .all() as Array<{name: string}>;
    if (!columns.some(c => c.name === column)) {
      this.connection.exec(
        `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
      );
    }
  }
}

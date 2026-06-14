import {getDb} from './db.js';

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
}

export interface Settings {
  notify: {
    inPage: boolean;
    desktop: boolean;
    email: boolean;
  };
  smtp: SmtpSettings;
  musicbrainz: {
    contact: string;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  notify: {
    inPage: true,
    desktop: true,
    email: false,
  },
  smtp: {
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from: '',
    to: '',
  },
  musicbrainz: {
    contact: '',
  },
};

const CONFIG_KEY = 'config';
const LAST_REFRESH_KEY = 'last_refresh_at';

function readRaw(key: string): string | undefined {
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key) as {value: string} | undefined;
  return row?.value;
}

function writeRaw(key: string, value: string): void {
  getDb()
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .run(key, value);
}

// Deep-merge stored config over defaults so newly-added settings keys always
// have a value even for databases created by an older version.
export function getSettings(): Settings {
  const raw = readRaw(CONFIG_KEY);
  if (!raw) return structuredClone(DEFAULT_SETTINGS);
  let parsed: Partial<Settings>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
  return {
    notify: {...DEFAULT_SETTINGS.notify, ...parsed.notify},
    smtp: {...DEFAULT_SETTINGS.smtp, ...parsed.smtp},
    musicbrainz: {...DEFAULT_SETTINGS.musicbrainz, ...parsed.musicbrainz},
  };
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const current = getSettings();
  const next: Settings = {
    notify: {...current.notify, ...patch.notify},
    smtp: {...current.smtp, ...patch.smtp},
    musicbrainz: {...current.musicbrainz, ...patch.musicbrainz},
  };
  writeRaw(CONFIG_KEY, JSON.stringify(next));
  return next;
}

export function smtpIsConfigured(s: Settings): boolean {
  return Boolean(s.smtp.host && s.smtp.user && s.smtp.to);
}

export function getLastRefreshAt(): string | null {
  return readRaw(LAST_REFRESH_KEY) ?? null;
}

export function setLastRefreshAt(iso: string): void {
  writeRaw(LAST_REFRESH_KEY, iso);
}

// The MusicBrainz contact string, falling back to a placeholder so the API is
// always usable (MusicBrainz only requires *some* contact for its User-Agent).
export function mbContact(): string {
  const s = getSettings();
  return (
    s.musicbrainz.contact ||
    process.env.SMN_MB_CONTACT ||
    'silver-music-notifier (no contact configured)'
  );
}

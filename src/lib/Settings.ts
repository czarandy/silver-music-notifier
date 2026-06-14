import {AppDb} from './AppDb.js';

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
}

export interface NotifySettings {
  inPage: boolean;
  desktop: boolean;
  email: boolean;
}

export interface MusicBrainzSettings {
  contact: string;
}

export interface SettingsInput {
  notify: NotifySettings;
  smtp: SmtpSettings;
  musicbrainz: MusicBrainzSettings;
}

export type SettingsPatch = Partial<{
  notify: Partial<NotifySettings>;
  smtp: Partial<SmtpSettings>;
  musicbrainz: Partial<MusicBrainzSettings>;
}>;

const DEFAULT_SETTINGS: SettingsInput = {
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

export class Settings {
  readonly notify: NotifySettings;
  readonly smtp: SmtpSettings;
  readonly musicbrainz: MusicBrainzSettings;

  constructor(input: SettingsInput = DEFAULT_SETTINGS) {
    this.notify = {...input.notify};
    this.smtp = {...input.smtp};
    this.musicbrainz = {...input.musicbrainz};
  }

  static defaults(): Settings {
    return new Settings(DEFAULT_SETTINGS);
  }

  static load(): Settings {
    const raw = Settings.readRaw(CONFIG_KEY);
    if (!raw) {
      return Settings.defaults();
    }

    let parsed: SettingsPatch;
    try {
      parsed = JSON.parse(raw) as SettingsPatch;
    } catch {
      return Settings.defaults();
    }

    return Settings.defaults().merge(parsed);
  }

  static save(patch: SettingsPatch): Settings {
    const next = Settings.load().merge(patch);
    Settings.writeRaw(CONFIG_KEY, JSON.stringify(next));
    return next;
  }

  static getLastRefreshAt(): string | null {
    return Settings.readRaw(LAST_REFRESH_KEY) ?? null;
  }

  static setLastRefreshAt(iso: string): void {
    Settings.writeRaw(LAST_REFRESH_KEY, iso);
  }

  static musicBrainzContact(): string {
    return Settings.load().musicBrainzContact();
  }

  merge(patch: SettingsPatch): Settings {
    return new Settings({
      notify: {...this.notify, ...patch.notify},
      smtp: {...this.smtp, ...patch.smtp},
      musicbrainz: {...this.musicbrainz, ...patch.musicbrainz},
    });
  }

  smtpIsConfigured(): boolean {
    return Boolean(this.smtp.host && this.smtp.user && this.smtp.to);
  }

  // The MusicBrainz contact string used in the API User-Agent. MusicBrainz
  // requires a meaningful contact (an email or URL) and throttles/blocks
  // requests without one, so this is mandatory.
  musicBrainzContact(): string {
    const contact = this.musicbrainz.contact.trim();
    if (!contact) {
      throw new Error(
        'MusicBrainz contact is not set. MusicBrainz requires a contact (email or ' +
          'URL) to query its API. Set it in the web UI Settings, or run:\n' +
          '  silver-music-notifier config set musicbrainz.contact you@example.com',
      );
    }
    return contact;
  }

  private static readRaw(key: string): string | undefined {
    const row = AppDb.getDefault()
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(key) as {value: string} | undefined;
    return row?.value;
  }

  private static writeRaw(key: string, value: string): void {
    AppDb.getDefault()
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ' +
          'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(key, value);
  }
}

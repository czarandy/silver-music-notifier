import {AppDb} from './AppDb.js';
import {isPrimaryType, type ReleaseGroupPrimaryType} from './releaseTypes.js';

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

export interface ReleaseFilterSettings {
  // Release-group primary types to keep when refreshing. Types not listed are
  // filtered out (not stored).
  primaryTypes: ReleaseGroupPrimaryType[];
}

export interface SettingsInput {
  notify: NotifySettings;
  smtp: SmtpSettings;
  musicbrainz: MusicBrainzSettings;
  releaseFilter: ReleaseFilterSettings;
}

export type SettingsPatch = Partial<{
  notify: Partial<NotifySettings>;
  smtp: Partial<SmtpSettings>;
  musicbrainz: Partial<MusicBrainzSettings>;
  releaseFilter: Partial<ReleaseFilterSettings>;
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
  releaseFilter: {
    // Keep proper releases by default; Broadcast and Other are excluded.
    primaryTypes: ['Album', 'Single', 'EP'],
  },
};

const CONFIG_KEY = 'config';
const LAST_REFRESH_KEY = 'last_refresh_at';

export class Settings {
  readonly notify: NotifySettings;
  readonly smtp: SmtpSettings;
  readonly musicbrainz: MusicBrainzSettings;
  readonly releaseFilter: ReleaseFilterSettings;

  constructor(input: SettingsInput = DEFAULT_SETTINGS) {
    this.notify = {...input.notify};
    this.smtp = {...input.smtp};
    this.musicbrainz = {...input.musicbrainz};
    this.releaseFilter = {
      // Drop any unknown values that may have been persisted by an older or
      // hand-edited config.
      primaryTypes: input.releaseFilter.primaryTypes.filter(isPrimaryType),
    };
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
      releaseFilter: {...this.releaseFilter, ...patch.releaseFilter},
    });
  }

  // Whether a release-group with this primary type should be kept on refresh.
  // Untyped release-groups (null) are always kept.
  supportPrimaryType(type: ReleaseGroupPrimaryType | null): boolean {
    return type === null || this.releaseFilter.primaryTypes.includes(type);
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

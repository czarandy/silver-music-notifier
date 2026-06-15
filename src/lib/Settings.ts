import {AppDb} from './AppDb.js';
import {
  isPrimaryType,
  isSecondaryType,
  type ReleaseGroupPrimaryType,
  type ReleaseGroupSecondaryType,
} from './releaseTypes.js';

export type SmtpProvider = 'gmail' | 'custom';

export interface SmtpSettings {
  // Provider preset. 'gmail' fixes host/port/secure so the user only supplies
  // their address and an app password; 'custom' exposes the raw SMTP fields.
  provider: SmtpProvider;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
}

// Fixed SMTP connection settings for Gmail. When the Gmail provider is
// selected these override whatever host/port/secure are stored.
const GMAIL_SMTP = {host: 'smtp.gmail.com', port: 465, secure: true} as const;

export interface NotifySettings {
  inPage: boolean;
  email: boolean;
}

export interface MusicBrainzSettings {
  contact: string;
}

export interface ReleaseFilterSettings {
  // Release-group primary types to keep when refreshing. Types not listed are
  // filtered out (not stored).
  primaryTypes: ReleaseGroupPrimaryType[];
  // Release-group secondary types to exclude when refreshing. A release-group
  // carrying any of these secondary types is filtered out. Empty by default.
  excludeSecondaryTypes: ReleaseGroupSecondaryType[];
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
    email: false,
  },
  smtp: {
    provider: 'gmail',
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
    // Default to full studio albums only.
    primaryTypes: ['Album'],
    // Drop the common "album" variants that aren't new studio releases.
    excludeSecondaryTypes: ['Remix', 'Live', 'Compilation', 'Mixtape/Street'],
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
      excludeSecondaryTypes:
        input.releaseFilter.excludeSecondaryTypes.filter(isSecondaryType),
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

  static clearLastRefreshAt(): void {
    AppDb.getDefault()
      .prepare('DELETE FROM settings WHERE key = ?')
      .run(LAST_REFRESH_KEY);
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
  supportPrimaryType(type: ReleaseGroupPrimaryType | null): boolean {
    return type !== null && this.releaseFilter.primaryTypes.includes(type);
  }

  // Whether a release-group with these secondary types should be kept on
  // refresh. It is filtered out if it carries any excluded secondary type.
  supportSecondaryTypes(types: ReleaseGroupSecondaryType[]): boolean {
    return !types.some(t =>
      this.releaseFilter.excludeSecondaryTypes.includes(t),
    );
  }

  // Whether a release-group should be kept on refresh, applying both the
  // primary-type and secondary-type filters.
  includeRelease(group: {
    primaryType: ReleaseGroupPrimaryType | null;
    secondaryTypes: ReleaseGroupSecondaryType[];
  }): boolean {
    return (
      this.supportPrimaryType(group.primaryType) &&
      this.supportSecondaryTypes(group.secondaryTypes)
    );
  }

  // SMTP settings with the provider preset applied. For Gmail the host, port,
  // and secure flag are fixed, so connection code should use this rather than
  // reading this.smtp directly.
  resolvedSmtp(): SmtpSettings {
    if (this.smtp.provider === 'gmail') {
      return {...this.smtp, ...GMAIL_SMTP};
    }
    return this.smtp;
  }

  smtpIsConfigured(): boolean {
    const smtp = this.resolvedSmtp();
    return Boolean(smtp.host && smtp.user && smtp.to);
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

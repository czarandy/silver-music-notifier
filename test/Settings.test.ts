import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {AppDb} from '../src/lib/AppDb.js';
import {Settings} from '../src/lib/Settings.js';

const originalDataDir = process.env.SILVER_MUSIC_NOTIFIER_DATA_DIR;
let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'smn-settings-test-'));
  process.env.SILVER_MUSIC_NOTIFIER_DATA_DIR = tempDir;
  AppDb.closeDefault();
});

afterEach(() => {
  AppDb.closeDefault();
  if (originalDataDir == null) {
    delete process.env.SILVER_MUSIC_NOTIFIER_DATA_DIR;
  } else {
    process.env.SILVER_MUSIC_NOTIFIER_DATA_DIR = originalDataDir;
  }
  rmSync(tempDir, {force: true, recursive: true});
});

describe('Settings', () => {
  it('loads defaults and deep-merges saved patches', () => {
    expect(Settings.load()).toMatchObject({
      notify: {inPage: true, desktop: true, email: false},
      smtp: {port: 587, secure: false},
      musicbrainz: {contact: ''},
    });

    const saved = Settings.save({
      notify: {email: true},
      smtp: {host: 'smtp.example.com', user: 'user', to: 'to@example.com'},
      musicbrainz: {contact: 'me@example.com'},
    });

    expect(saved.notify).toEqual({
      inPage: true,
      desktop: true,
      email: true,
    });
    expect(saved.smtp).toMatchObject({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      user: 'user',
      to: 'to@example.com',
    });
    expect(saved.smtpIsConfigured()).toBe(true);
    expect(saved.musicBrainzContact()).toBe('me@example.com');
    expect(Settings.load()).toMatchObject(saved);
  });

  it('falls back to defaults when stored config is invalid JSON', () => {
    AppDb.getDefault()
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
      .run('config', '{not json');

    expect(Settings.load()).toMatchObject({
      notify: {inPage: true, desktop: true, email: false},
      smtp: {host: '', port: 587},
      musicbrainz: {contact: ''},
    });
  });

  it('stores and loads last refresh timestamps separately from config', () => {
    Settings.setLastRefreshAt('2026-01-03T00:00:00.000Z');

    expect(Settings.getLastRefreshAt()).toBe('2026-01-03T00:00:00.000Z');
    expect(Settings.load().musicbrainz.contact).toBe('');
  });

  it('throws setup guidance when MusicBrainz contact is missing', () => {
    expect(() => Settings.musicBrainzContact()).toThrow(
      /MusicBrainz contact is not set/,
    );
  });

  describe('releaseFilter', () => {
    it('defaults to Album only, excluding Remix/Live/Compilation', () => {
      const {releaseFilter} = Settings.load();
      expect(releaseFilter.primaryTypes).toEqual(['Album']);
      expect(releaseFilter.excludeSecondaryTypes).toEqual([
        'Remix',
        'Live',
        'Compilation',
      ]);
    });

    it('replaces the type lists when saved (arrays are not merged)', () => {
      const saved = Settings.save({
        releaseFilter: {
          primaryTypes: ['Album', 'EP'],
          excludeSecondaryTypes: ['Live', 'Remix'],
        },
      });

      expect(saved.releaseFilter.primaryTypes).toEqual(['Album', 'EP']);
      expect(saved.releaseFilter.excludeSecondaryTypes).toEqual([
        'Live',
        'Remix',
      ]);
      expect(Settings.load().releaseFilter).toEqual(saved.releaseFilter);
    });

    it('drops unknown primary and secondary types persisted in the config', () => {
      AppDb.getDefault()
        .prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
        .run(
          'config',
          JSON.stringify({
            releaseFilter: {
              primaryTypes: ['Album', 'Bogus'],
              excludeSecondaryTypes: ['Live', 'Nope'],
            },
          }),
        );

      const {releaseFilter} = Settings.load();
      expect(releaseFilter.primaryTypes).toEqual(['Album']);
      expect(releaseFilter.excludeSecondaryTypes).toEqual(['Live']);
    });

    it('supportPrimaryType reflects the configured list, always keeping untyped', () => {
      const settings = Settings.save({
        releaseFilter: {primaryTypes: ['Album', 'EP']},
      });

      expect(settings.supportPrimaryType('Album')).toBe(true);
      expect(settings.supportPrimaryType('Single')).toBe(false);
      // Untyped release-groups are always kept regardless of the filter.
      expect(settings.supportPrimaryType(null)).toBe(true);
    });

    it('supportSecondaryTypes excludes groups carrying any excluded type', () => {
      const settings = Settings.save({
        releaseFilter: {excludeSecondaryTypes: ['Live', 'Remix']},
      });

      expect(settings.supportSecondaryTypes([])).toBe(true);
      expect(settings.supportSecondaryTypes(['Compilation'])).toBe(true);
      expect(settings.supportSecondaryTypes(['Live'])).toBe(false);
      expect(settings.supportSecondaryTypes(['Compilation', 'Remix'])).toBe(
        false,
      );
    });

    it('includeRelease applies both the primary and secondary filters', () => {
      const settings = Settings.save({
        releaseFilter: {
          primaryTypes: ['Album', 'EP'],
          excludeSecondaryTypes: ['Live'],
        },
      });

      expect(
        settings.includeRelease({primaryType: 'Album', secondaryTypes: []}),
      ).toBe(true);
      // Wrong primary type.
      expect(
        settings.includeRelease({primaryType: 'Single', secondaryTypes: []}),
      ).toBe(false);
      // Excluded secondary type.
      expect(
        settings.includeRelease({
          primaryType: 'Album',
          secondaryTypes: ['Live'],
        }),
      ).toBe(false);
    });
  });
});

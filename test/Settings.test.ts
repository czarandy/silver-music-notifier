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
});

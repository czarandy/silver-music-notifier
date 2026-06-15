import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mocks.sendMail,
    })),
  },
}));

import {AppDb} from '../src/lib/AppDb.js';
import {Settings} from '../src/lib/Settings.js';
import {sendTestEmail} from '../src/lib/notify.js';

const originalDataDir = process.env.SILVER_MUSIC_NOTIFIER_DATA_DIR;
let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'smn-notify-test-'));
  process.env.SILVER_MUSIC_NOTIFIER_DATA_DIR = tempDir;
  AppDb.closeDefault();
  mocks.sendMail.mockResolvedValue({});
});

afterEach(() => {
  AppDb.closeDefault();
  vi.restoreAllMocks();
  mocks.sendMail.mockReset();
  if (originalDataDir == null) {
    delete process.env.SILVER_MUSIC_NOTIFIER_DATA_DIR;
  } else {
    process.env.SILVER_MUSIC_NOTIFIER_DATA_DIR = originalDataDir;
  }
  rmSync(tempDir, {force: true, recursive: true});
});

function configureSmtp(): Settings {
  return Settings.save({
    smtp: {
      host: 'smtp.example.test',
      port: 587,
      secure: false,
      user: 'sender@example.test',
      pass: 'secret',
      from: 'from@example.test',
      to: 'recipient@example.test',
    },
  });
}

function seedRelease(input: {
  mbid: string;
  title: string;
  firstReleaseDate: string;
}): void {
  AppDb.getDefault()
    .prepare(
      `INSERT OR IGNORE INTO artists (mbid, name, sort_name, disambiguation, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run('artist-1', 'Silver Artist', null, null, '2026-01-01T00:00:00.000Z');

  AppDb.getDefault()
    .prepare(
      `INSERT INTO release_groups
        (mbid, artist_mbid, title, primary_type, secondary_types,
         first_release_date, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.mbid,
      'artist-1',
      input.title,
      'Album',
      null,
      input.firstReleaseDate,
      '2026-01-02T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
    );
}

describe('sendTestEmail', () => {
  it('sends a release-shaped test email for the newest tracked release', async () => {
    const settings = configureSmtp();
    seedRelease({
      mbid: 'old-release',
      title: 'Old Release',
      firstReleaseDate: '2025-01-01',
    });
    seedRelease({
      mbid: 'new-release',
      title: 'New Release',
      firstReleaseDate: '2026-01-01',
    });

    await sendTestEmail(settings);

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'from@example.test',
        to: 'recipient@example.test',
        subject: '[TEST] New Release: New Release by Silver Artist',
        html: expect.stringContaining(
          '<strong>New Release</strong> by Silver Artist',
        ),
      }),
    );
  });
});

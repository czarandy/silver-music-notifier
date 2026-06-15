import nodemailer from 'nodemailer';
import {Settings} from './Settings.js';
import {Release} from './Release.js';
import {formatReleaseDate} from './formatReleaseDate.js';
import type {NewRelease} from './refresh.js';
import type {
  ReleaseGroupPrimaryType,
  ReleaseGroupSecondaryType,
} from './releaseTypes.js';

function subjectLine(r: NewRelease): string {
  return `New Release: ${r.title} by ${r.artistName}`;
}

function emailHtml(r: NewRelease): string {
  const type = [r.primaryType, ...r.secondaryTypes].filter(Boolean).join(' / ');
  const title = `<strong>${escapeHtml(r.title)}</strong>`;
  const artist = escapeHtml(r.artistName);
  const typeText = type ? ` (${escapeHtml(type)})` : '';
  const dateText = r.firstReleaseDate
    ? ` was released on ${escapeHtml(formatReleaseDate(r.firstReleaseDate))}`
    : ' is out';
  return `<div style="font-family:system-ui,sans-serif">
    <p>${title} by ${artist}${typeText}${dateText}.</p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    c =>
      ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[
        c
      ]!,
  );
}

function transport(s: Settings) {
  const smtp = s.resolvedSmtp();
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? {user: smtp.user, pass: smtp.pass} : undefined,
  });
}

// Send one notification email for a single release. `subjectPrefix` lets the
// test email reuse the exact same layout while marking the subject as a test.
async function sendReleaseEmail(
  release: NewRelease,
  s: Settings,
  subjectPrefix = '',
): Promise<void> {
  await transport(s).sendMail({
    from: s.smtp.from || s.smtp.user,
    to: s.smtp.to,
    subject: subjectPrefix + subjectLine(release),
    html: emailHtml(release),
  });
}

// Dispatch notifications for newly-discovered releases according to user
// settings, sending one email per release. Email fails soft: a broken SMTP
// config (or a single failed send) must not prevent the refresh itself from
// succeeding or block the remaining emails.
export async function notifyNewReleases(
  newReleases: NewRelease[],
): Promise<void> {
  if (newReleases.length === 0) {
    return;
  }
  const s = Settings.load();

  if (s.notify.email) {
    if (!s.smtpIsConfigured()) {
      console.warn('Email enabled but SMTP not configured — skipping email.');
    } else {
      for (const release of newReleases) {
        try {
          await sendReleaseEmail(release, s);
        } catch (err) {
          console.error(
            `Email notification failed for "${release.title}":`,
            errMsg(err),
          );
        }
      }
    }
  }
}

// A representative release to preview in the test email: the newest tracked
// release, or a synthetic sample when nothing is tracked yet.
function sampleRelease(): NewRelease {
  const [latest] = Release.list({limit: 1});
  if (latest) {
    return {
      mbid: latest.mbid,
      artistMbid: latest.artistMbid,
      artistName: latest.artistName,
      title: latest.title,
      primaryType: latest.primaryType as ReleaseGroupPrimaryType | null,
      secondaryTypes: latest.secondaryTypes
        ? (latest.secondaryTypes.split(', ') as ReleaseGroupSecondaryType[])
        : [],
      firstReleaseDate: latest.firstReleaseDate,
    };
  }
  return {
    mbid: 'sample',
    artistMbid: 'sample',
    artistName: 'Example Artist',
    title: 'Example Album',
    primaryType: 'Album',
    secondaryTypes: [],
    firstReleaseDate: new Date().toISOString().slice(0, 10),
  };
}

// Send a test email using the current (or provided) SMTP settings. It mirrors a
// real release notification (using the newest tracked release) so the user can
// see exactly what they'll get, but prefixes the subject with [TEST]. Throws on
// failure so callers can surface the error to the user.
export async function sendTestEmail(override?: Settings): Promise<void> {
  const s = override ?? Settings.load();
  if (!s.smtpIsConfigured()) {
    throw new Error(
      'SMTP is not configured (host, user, and recipient required).',
    );
  }
  await sendReleaseEmail(sampleRelease(), s, '[TEST] ');
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

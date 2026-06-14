import nodemailer from 'nodemailer';
import notifier from 'node-notifier';
import {getSettings, smtpIsConfigured, type Settings} from './settings.js';
import type {NewRelease} from './refresh.js';

function summaryLine(newReleases: NewRelease[]): string {
  const n = newReleases.length;
  const artists = [...new Set(newReleases.map(r => r.artistName))];
  const who =
    artists.length <= 3
      ? artists.join(', ')
      : `${artists.slice(0, 3).join(', ')} +${artists.length - 3} more`;
  return `${n} new release${n === 1 ? '' : 's'} from ${who}`;
}

function desktopNotify(newReleases: NewRelease[]): void {
  notifier.notify({
    title: 'New music releases',
    message: summaryLine(newReleases),
  });
}

function emailHtml(newReleases: NewRelease[]): string {
  const rows = newReleases
    .map(r => {
      const type = [r.primaryType, ...r.secondaryTypes]
        .filter(Boolean)
        .join(' / ');
      const date = r.firstReleaseDate ?? '—';
      return `<tr>
        <td style="padding:4px 12px 4px 0">${escapeHtml(r.artistName)}</td>
        <td style="padding:4px 12px 4px 0"><strong>${escapeHtml(r.title)}</strong></td>
        <td style="padding:4px 12px 4px 0">${escapeHtml(type)}</td>
        <td style="padding:4px 0">${escapeHtml(date)}</td>
      </tr>`;
    })
    .join('');
  return `<div style="font-family:system-ui,sans-serif">
    <h2>${escapeHtml(summaryLine(newReleases))}</h2>
    <table style="border-collapse:collapse">
      <thead><tr>
        <th align="left" style="padding:4px 12px 4px 0">Artist</th>
        <th align="left" style="padding:4px 12px 4px 0">Title</th>
        <th align="left" style="padding:4px 12px 4px 0">Type</th>
        <th align="left" style="padding:4px 0">Released</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
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
  return nodemailer.createTransport({
    host: s.smtp.host,
    port: s.smtp.port,
    secure: s.smtp.secure,
    auth: s.smtp.user ? {user: s.smtp.user, pass: s.smtp.pass} : undefined,
  });
}

async function emailNotify(
  newReleases: NewRelease[],
  s: Settings,
): Promise<void> {
  await transport(s).sendMail({
    from: s.smtp.from || s.smtp.user,
    to: s.smtp.to,
    subject: summaryLine(newReleases),
    html: emailHtml(newReleases),
  });
}

// Dispatch notifications for newly-discovered releases according to user
// settings. Each channel fails soft: a broken SMTP config must not prevent the
// desktop notification (or the refresh itself) from succeeding.
export async function notifyNewReleases(
  newReleases: NewRelease[],
): Promise<void> {
  if (newReleases.length === 0) {
    return;
  }
  const s = getSettings();

  if (s.notify.desktop && !process.env.SMN_DISABLE_DESKTOP) {
    try {
      desktopNotify(newReleases);
    } catch (err) {
      console.error('Desktop notification failed:', errMsg(err));
    }
  }

  if (s.notify.email) {
    if (!smtpIsConfigured(s)) {
      console.warn('Email enabled but SMTP not configured — skipping email.');
    } else {
      try {
        await emailNotify(newReleases, s);
      } catch (err) {
        console.error('Email notification failed:', errMsg(err));
      }
    }
  }
}

// Send a test email using the current (or provided) SMTP settings. Throws on
// failure so callers can surface the error to the user.
export async function sendTestEmail(override?: Settings): Promise<void> {
  const s = override ?? getSettings();
  if (!smtpIsConfigured(s)) {
    throw new Error(
      'SMTP is not configured (host, user, and recipient required).',
    );
  }
  await transport(s).sendMail({
    from: s.smtp.from || s.smtp.user,
    to: s.smtp.to,
    subject: 'silver-music-notifier test email',
    text: 'This is a test email from silver-music-notifier. SMTP is working.',
  });
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

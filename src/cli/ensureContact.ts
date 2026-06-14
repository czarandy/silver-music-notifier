import {Settings} from '../lib/Settings.js';

// MusicBrainz requires a contact (email or URL) in the API User-Agent. The first
// time a command needs the API and no contact is set, prompt for one and save
// it. In a non-interactive context (no TTY, e.g. cron/CI) fall back to throwing
// the standard guidance error instead of hanging on a prompt.
export async function ensureMbContact(): Promise<void> {
  if (Settings.load().musicbrainz.contact.trim()) {
    return;
  }

  if (!process.stdin.isTTY) {
    Settings.musicBrainzContact(); // throws with setup guidance
    return;
  }

  const {input} = await import('@inquirer/prompts');
  const contact = await input({
    message:
      'MusicBrainz requires a contact (email or URL) to use its API. Enter one:',
    validate: value => {
      const v = value.trim();
      if (!v) {
        return 'A contact is required.';
      }
      if (!v.includes('@') && !v.includes('.')) {
        return 'Enter an email address or a URL.';
      }
      return true;
    },
  });

  Settings.save({musicbrainz: {contact: contact.trim()}});
  console.log(
    'Saved. Change it later with: silver-music-notifier config set musicbrainz.contact <value>\n',
  );
}

import type {Command} from 'commander';
import {Settings, type SettingsPatch} from '../../lib/Settings.js';

// Flatten the settings object into dotted keys for display/editing, masking the
// SMTP password so it is never printed.
function flatten(s: Settings): Record<string, string> {
  return {
    'notify.inPage': String(s.notify.inPage),
    'notify.desktop': String(s.notify.desktop),
    'notify.email': String(s.notify.email),
    'smtp.host': s.smtp.host,
    'smtp.port': String(s.smtp.port),
    'smtp.secure': String(s.smtp.secure),
    'smtp.user': s.smtp.user,
    'smtp.pass': s.smtp.pass ? '********' : '',
    'smtp.from': s.smtp.from,
    'smtp.to': s.smtp.to,
    'musicbrainz.contact': s.musicbrainz.contact,
  };
}

function coerce(key: string, value: string): boolean | number | string {
  if (/^(notify\.|smtp\.secure$)/.test(key)) {
    return value === 'true' || value === '1';
  }
  if (key === 'smtp.port') {
    return Number(value);
  }
  return value;
}

function patchFor(
  key: string,
  value: boolean | number | string,
): SettingsPatch {
  const [group, field] = key.split('.');
  return {[group]: {[field]: value}} as unknown as SettingsPatch;
}

export function registerConfig(program: Command): void {
  const config = program.command('config').description('View or edit settings');

  config
    .command('get', {isDefault: true})
    .description('Print settings (or a single key)')
    .argument('[key]', 'dotted key, e.g. notify.email')
    .action((key?: string) => {
      const flat = flatten(Settings.load());
      if (key) {
        if (!(key in flat)) {
          console.error(`Unknown key: ${key}`);
          process.exitCode = 1;
          return;
        }
        console.log(flat[key]);
        return;
      }
      for (const [k, v] of Object.entries(flat)) {
        console.log(`${k} = ${v}`);
      }
    });

  config
    .command('set')
    .description('Set a settings key')
    .argument('<key>', 'dotted key, e.g. smtp.host')
    .argument('<value>', 'new value')
    .action((key: string, value: string) => {
      const valid = new Set(Object.keys(flatten(Settings.load())));
      if (!valid.has(key)) {
        console.error(
          `Unknown key: ${key}\nValid keys: ${[...valid].join(', ')}`,
        );
        process.exitCode = 1;
        return;
      }
      Settings.save(patchFor(key, coerce(key, value)));
      console.log(`Set ${key}.`);
    });
}

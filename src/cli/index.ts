import {Command} from 'commander';
import {registerWeb} from './commands/web.js';
import {registerList} from './commands/list.js';
import {registerAdd} from './commands/add.js';
import {registerRemove} from './commands/remove.js';
import {registerRefresh} from './commands/refresh.js';
import {registerReleases} from './commands/releases.js';
import {registerDismiss} from './commands/dismiss.js';
import {registerConfig} from './commands/config.js';
import {registerClearData} from './commands/clearData.js';
import {ensureMbContact} from './ensureContact.js';

const program = new Command();

// Commands that don't hit the MusicBrainz API and must work before a contact is
// configured (e.g. `config` to set it, `clear-data` to wipe local state).
const CONTACT_EXEMPT_COMMANDS = new Set(['config', 'clear-data', 'dismiss']);

// A configured MusicBrainz contact is required. Ensure it once at the root
// (prompting interactively on first use) rather than in each command.
program.hook('preAction', async (_thisCommand, actionCommand) => {
  for (let cmd: Command | null = actionCommand; cmd; cmd = cmd.parent) {
    if (CONTACT_EXEMPT_COMMANDS.has(cmd.name())) {
      return;
    }
  }
  await ensureMbContact();
});

program
  .name('silver-music-notifier')
  .description(
    'Track artists and get notified of their new music releases from MusicBrainz.',
  )
  .version('0.1.0');

registerWeb(program);
registerList(program);
registerAdd(program);
registerRemove(program);
registerRefresh(program);
registerReleases(program);
registerDismiss(program);
registerConfig(program);
registerClearData(program);

program.parseAsync(process.argv).catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

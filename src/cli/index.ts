import {Command} from 'commander';
import {registerWeb} from './commands/web.js';
import {registerList} from './commands/list.js';
import {registerAdd} from './commands/add.js';
import {registerRemove} from './commands/remove.js';
import {registerRefresh} from './commands/refresh.js';
import {registerReleases} from './commands/releases.js';
import {registerConfig} from './commands/config.js';
import {ensureMbContact} from './ensureContact.js';

const program = new Command();

// A configured MusicBrainz contact is required. Ensure it once at the root
// (prompting interactively on first use) rather than in each command. `config`
// is exempt — you need it to set the contact in the first place.
program.hook('preAction', async (_thisCommand, actionCommand) => {
  for (let cmd: Command | null = actionCommand; cmd; cmd = cmd.parent) {
    if (cmd.name() === 'config') {
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
registerConfig(program);

program.parseAsync(process.argv).catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

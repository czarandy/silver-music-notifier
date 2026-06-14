import type {Command} from 'commander';
import {Artist} from '../../lib/Artist.js';
import {Settings} from '../../lib/Settings.js';

export function registerClearData(program: Command): void {
  program
    .command('clear-data')
    .description('Delete all tracked artists and stored releases')
    .option('-y, --yes', 'skip the confirmation prompt')
    .action(async (opts: {yes?: boolean}) => {
      if (!opts.yes) {
        if (!process.stdin.isTTY) {
          console.error(
            'Refusing to clear data without confirmation. Re-run with --yes.',
          );
          process.exitCode = 1;
          return;
        }
        const {confirm} = await import('@inquirer/prompts');
        const confirmed = await confirm({
          message:
            'Delete ALL tracked artists and stored releases? This cannot be undone.',
          default: false,
        });
        if (!confirmed) {
          console.log('Aborted.');
          return;
        }
      }

      const {artists, releases} = Artist.clearAll();
      Settings.clearLastRefreshAt();
      console.log(
        `Cleared ${artists} artist${artists === 1 ? '' : 's'} and ` +
          `${releases} release${releases === 1 ? '' : 's'}. Settings were kept.`,
      );
    });
}

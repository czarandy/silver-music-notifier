import type {Command} from 'commander';
import {Release} from '../../lib/Release.js';

export function registerReleases(program: Command): void {
  program
    .command('releases')
    .description('List known releases, newest first')
    .option('--new', 'only show releases discovered in the last refresh')
    .option('-n, --limit <n>', 'limit the number of rows', v => Number(v))
    .action((opts: {new?: boolean; limit?: number}) => {
      const items = Release.list({onlyNew: opts.new, limit: opts.limit});
      if (items.length === 0) {
        console.log(
          opts.new
            ? 'No new releases since the last refresh.'
            : 'No releases yet. Run: silver-music-notifier refresh',
        );
        return;
      }
      for (const r of items) {
        const date = r.firstReleaseDate ?? '—'.padEnd(10);
        const type = [r.primaryType, r.secondaryTypes]
          .filter(Boolean)
          .join(' / ');
        const flag = r.isNew ? 'NEW ' : '    ';
        console.log(
          `${flag}${date.padEnd(11)} ${r.artistName} — ${r.title}${type ? ` [${type}]` : ''}`,
        );
      }
    });
}

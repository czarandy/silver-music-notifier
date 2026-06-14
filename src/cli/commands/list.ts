import type {Command} from 'commander';
import {listArtists} from '../../lib/store.js';

export function registerList(program: Command): void {
  program
    .command('list')
    .description('List tracked artists')
    .action(() => {
      const artists = listArtists();
      if (artists.length === 0) {
        console.log(
          'No artists tracked yet. Add one with: silver-music-notifier add <name>',
        );
        return;
      }
      for (const a of artists) {
        const extra = a.disambiguation ? ` (${a.disambiguation})` : '';
        console.log(`${a.name}${extra}  —  ${a.mbid}`);
      }
      console.log(
        `\n${artists.length} artist${artists.length === 1 ? '' : 's'} tracked.`,
      );
    });
}

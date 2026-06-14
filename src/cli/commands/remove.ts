import type {Command} from 'commander';
import {removeArtist} from '../../lib/store.js';

export function registerRemove(program: Command): void {
  program
    .command('remove')
    .alias('rm')
    .description('Stop tracking an artist (by MBID or name)')
    .argument('<idOrName>', 'MusicBrainz MBID or exact artist name')
    .action((idOrName: string) => {
      const removed = removeArtist(idOrName);
      if (!removed) {
        console.log(`No tracked artist matched "${idOrName}".`);
        process.exitCode = 1;
        return;
      }
      console.log(`Removed ${removed.name} (${removed.mbid}).`);
    });
}

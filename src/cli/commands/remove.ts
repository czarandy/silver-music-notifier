import type {Command} from 'commander';
import {Artist} from '../../lib/Artist.js';

export function registerRemove(program: Command): void {
  program
    .command('remove')
    .alias('rm')
    .description('Stop tracking an artist (by MBID or name)')
    .argument('<idOrName>', 'MusicBrainz MBID or exact artist name')
    .action((idOrName: string) => {
      const artist = Artist.getByMbidOrName(idOrName);
      if (!artist) {
        console.log(`No tracked artist matched "${idOrName}".`);
        process.exitCode = 1;
        return;
      }
      artist.remove();
      console.log(`Removed ${artist.name} (${artist.mbid}).`);
    });
}

import type {Command} from 'commander';
import {Release} from '../../lib/Release.js';

export function registerDismiss(program: Command): void {
  program
    .command('dismiss')
    .description('Dismiss the New badge for a release')
    .argument('<releaseMbid>', 'MusicBrainz release-group MBID')
    .action((releaseMbid: string) => {
      const dismissed = Release.dismiss(releaseMbid);
      if (!dismissed) {
        console.log(`No release matched "${releaseMbid}".`);
        process.exitCode = 1;
        return;
      }
      console.log(`Dismissed ${releaseMbid}.`);
    });
}

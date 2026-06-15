import type {Command} from 'commander';
import {startServer} from '../../server/index.js';

// How many consecutive ports to try before giving up.
const MAX_PORT_ATTEMPTS = 10;

function isAddrInUse(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as {code?: string}).code === 'EADDRINUSE'
  );
}

export function registerWeb(program: Command): void {
  program
    .command('web')
    .description('Launch the local web UI')
    .option('-p, --port <port>', 'port to listen on', '3001')
    .option('--no-open', 'do not open a browser window')
    .action(async (opts: {port: string; open: boolean}) => {
      const requested = Number(opts.port);
      let bound: number | undefined;
      for (let port = requested; port < requested + MAX_PORT_ATTEMPTS; port++) {
        try {
          bound = await startServer(port);
          break;
        } catch (err) {
          if (!isAddrInUse(err)) {
            throw err;
          }
          console.log(`Port ${port} is in use, trying ${port + 1}…`);
        }
      }
      if (bound === undefined) {
        throw new Error(
          `Could not find a free port in range ` +
            `${requested}–${requested + MAX_PORT_ATTEMPTS - 1}.`,
        );
      }

      const url = `http://localhost:${bound}`;
      console.log(`silver-music-notifier web UI running at ${url}`);
      if (opts.open) {
        try {
          const {default: open} = await import('open');
          await open(url);
        } catch {
          console.log('(could not open browser automatically)');
        }
      }
    });
}

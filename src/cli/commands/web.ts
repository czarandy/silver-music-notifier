import type { Command } from "commander";
import { startServer } from "../../server/index.js";

export function registerWeb(program: Command): void {
  program
    .command("web")
    .description("Launch the local web UI")
    .option("-p, --port <port>", "port to listen on", "3001")
    .option("--no-open", "do not open a browser window")
    .action(async (opts: { port: string; open: boolean }) => {
      const port = Number(opts.port);
      await startServer(port);
      const url = `http://localhost:${port}`;
      console.log(`silver-music-notifier web UI running at ${url}`);
      if (opts.open) {
        try {
          const { default: open } = await import("open");
          await open(url);
        } catch {
          console.log("(could not open browser automatically)");
        }
      }
    });
}

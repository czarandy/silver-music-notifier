import type { Command } from "commander";
import { refresh } from "../../lib/refresh.js";

export function registerRefresh(program: Command): void {
  program
    .command("refresh")
    .description("Fetch releases for all tracked artists and notify on new ones")
    .option("--no-notify", "skip desktop/email notifications")
    .action(async (opts: { notify: boolean }) => {
      const summary = await refresh({
        notify: opts.notify,
        onProgress: (artist, i, total) => {
          process.stdout.write(`\r[${i + 1}/${total}] ${artist.name}`.padEnd(60));
        },
      });
      process.stdout.write("\r".padEnd(60) + "\r");

      console.log(
        `Scanned ${summary.scannedArtists} artist${summary.scannedArtists === 1 ? "" : "s"}; ` +
          `${summary.newCount} new release${summary.newCount === 1 ? "" : "s"}.`,
      );
      for (const r of summary.newReleases) {
        const type = [r.primaryType, ...r.secondaryTypes].filter(Boolean).join(" / ");
        console.log(
          `  + ${r.artistName} — ${r.title}` +
            (type ? ` [${type}]` : "") +
            (r.firstReleaseDate ? ` (${r.firstReleaseDate})` : ""),
        );
      }
      for (const e of summary.errors) {
        console.error(`  ! ${e.artist}: ${e.message}`);
      }
    });
}

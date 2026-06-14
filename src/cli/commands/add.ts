import type { Command } from "commander";
import { searchArtist } from "../../lib/musicbrainz.js";
import { addArtist } from "../../lib/store.js";

export function registerAdd(program: Command): void {
  program
    .command("add")
    .description("Search MusicBrainz and add an artist to track")
    .argument("<query>", "artist name to search for")
    .option("--mbid <mbid>", "add this exact MusicBrainz artist MBID, skipping search")
    .option("-y, --yes", "add the top search result without prompting")
    .action(
      async (query: string, opts: { mbid?: string; yes?: boolean }) => {
        if (opts.mbid) {
          const added = addArtist({ mbid: opts.mbid, name: query });
          console.log(added ? `Added ${query}.` : `${query} is already tracked.`);
          return;
        }

        const results = await searchArtist(query);
        if (results.length === 0) {
          console.log(`No MusicBrainz artists found for "${query}".`);
          return;
        }

        let chosen = results[0];
        if (!opts.yes && results.length > 1) {
          const { select } = await import("@inquirer/prompts");
          const mbid = await select({
            message: "Which artist?",
            choices: results.map((r) => ({
              name: [
                r.name,
                r.disambiguation ? `(${r.disambiguation})` : "",
                r.type ? `· ${r.type}` : "",
                r.country ? `· ${r.country}` : "",
              ]
                .filter(Boolean)
                .join(" "),
              value: r.mbid,
            })),
          });
          chosen = results.find((r) => r.mbid === mbid)!;
        }

        const added = addArtist({
          mbid: chosen.mbid,
          name: chosen.name,
          sortName: chosen.sortName,
          disambiguation: chosen.disambiguation,
        });
        console.log(
          added
            ? `Added ${chosen.name} (${chosen.mbid}).`
            : `${chosen.name} is already tracked.`,
        );
      },
    );
}

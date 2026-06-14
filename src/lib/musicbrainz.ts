import { MusicBrainzApi } from "musicbrainz-api";
import { mbContact } from "./settings.js";

// App version is informational for the MusicBrainz User-Agent.
const APP_VERSION = "0.1.0";

let client: MusicBrainzApi | null = null;

function api(): MusicBrainzApi {
  // Recreate if the contact changed; cheap enough and keeps the User-Agent honest.
  const contact = mbContact();
  if (!client || (client as unknown as { _contact?: string })._contact !== contact) {
    client = new MusicBrainzApi({
      appName: "silver-music-notifier",
      appVersion: APP_VERSION,
      appContactInfo: contact,
    });
    (client as unknown as { _contact?: string })._contact = contact;
  }
  return client;
}

export interface ArtistSearchResult {
  mbid: string;
  name: string;
  sortName: string;
  disambiguation: string;
  country?: string;
  type?: string;
}

export async function searchArtist(query: string): Promise<ArtistSearchResult[]> {
  const result = await api().search("artist", { query, limit: 10 });
  return (result.artists ?? []).map((a) => ({
    mbid: a.id,
    name: a.name,
    sortName: a["sort-name"],
    disambiguation: a.disambiguation,
    country: a.country,
    type: a.type,
  }));
}

export interface FetchedReleaseGroup {
  mbid: string;
  title: string;
  primaryType: string | null;
  secondaryTypes: string[];
  firstReleaseDate: string | null;
}

// Page through every release-group credited to an artist. The musicbrainz-api
// client handles rate limiting internally.
export async function fetchReleaseGroups(
  artistMbid: string,
): Promise<FetchedReleaseGroup[]> {
  const out: FetchedReleaseGroup[] = [];
  const limit = 100;
  let offset = 0;
  for (;;) {
    const res = await api().browse("release-group", {
      artist: artistMbid,
      limit,
      offset,
    });
    const groups = res["release-groups"] ?? [];
    for (const g of groups) {
      out.push({
        mbid: g.id,
        title: g.title,
        primaryType: g["primary-type"] ?? null,
        secondaryTypes: g["secondary-types"] ?? [],
        firstReleaseDate: g["first-release-date"] || null,
      });
    }
    const total = res["release-group-count"] ?? out.length;
    offset += groups.length;
    if (groups.length === 0 || offset >= total) break;
  }
  return out;
}

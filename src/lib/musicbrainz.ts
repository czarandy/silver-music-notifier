import {MusicBrainzApi} from 'musicbrainz-api';
import packageJson from '../../package.json' with {type: 'json'};
import {Settings} from './Settings.js';

// App version is informational for the MusicBrainz User-Agent.
const APP_VERSION = packageJson.version;

let client: MusicBrainzApi | null = null;

function api(): MusicBrainzApi {
  // Recreate if the contact changed; cheap enough and keeps the User-Agent honest.
  const contact = Settings.musicBrainzContact();
  if (
    !client ||
    (client as unknown as {_contact?: string})._contact !== contact
  ) {
    client = new MusicBrainzApi({
      appName: 'silver-music-notifier',
      appVersion: APP_VERSION,
      appContactInfo: contact,
    });
    (client as unknown as {_contact?: string})._contact = contact;
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

export async function searchArtist(
  query: string,
): Promise<ArtistSearchResult[]> {
  const result = await api().search('artist', {query, limit: 10});
  return (result.artists ?? []).map(a => ({
    mbid: a.id,
    name: a.name,
    sortName: a['sort-name'],
    disambiguation: a.disambiguation,
    country: a.country,
    type: a.type,
  }));
}

export const RELEASE_GROUP_PRIMARY_TYPES = [
  'Album',
  'Single',
  'EP',
  'Broadcast',
  'Other',
] as const;

export type ReleaseGroupPrimaryType =
  (typeof RELEASE_GROUP_PRIMARY_TYPES)[number];

export const RELEASE_GROUP_SECONDARY_TYPES = [
  'Compilation',
  'Soundtrack',
  'Spokenword',
  'Interview',
  'Audiobook',
  'Audio drama',
  'Live',
  'Remix',
  'DJ-mix',
  'Mixtape/Street',
  'Demo',
  'Field recording',
] as const;

export type ReleaseGroupSecondaryType =
  (typeof RELEASE_GROUP_SECONDARY_TYPES)[number];

export interface ReleaseGroup {
  mbid: string;
  title: string;
  primaryType: ReleaseGroupPrimaryType | null;
  secondaryTypes: ReleaseGroupSecondaryType[];
  firstReleaseDate: string | null;
}

function releaseGroupPrimaryType(
  value: unknown,
): ReleaseGroupPrimaryType | null {
  return RELEASE_GROUP_PRIMARY_TYPES.includes(value as ReleaseGroupPrimaryType)
    ? (value as ReleaseGroupPrimaryType)
    : null;
}

function releaseGroupSecondaryTypes(
  values: unknown,
): ReleaseGroupSecondaryType[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.filter((value): value is ReleaseGroupSecondaryType =>
    RELEASE_GROUP_SECONDARY_TYPES.includes(value as ReleaseGroupSecondaryType),
  );
}

// Page through every release-group credited to an artist. The musicbrainz-api
// client handles rate limiting internally.
export async function fetchReleaseGroups(
  artistMbid: string,
): Promise<ReleaseGroup[]> {
  const out: ReleaseGroup[] = [];
  const limit = 100;
  let offset = 0;
  while (true) {
    const res = await api().browse('release-group', {
      artist: artistMbid,
      limit,
      offset,
    });
    const groups = res['release-groups'] ?? [];
    for (const g of groups) {
      out.push({
        mbid: g.id,
        title: g.title,
        primaryType: releaseGroupPrimaryType(g['primary-type']),
        secondaryTypes: releaseGroupSecondaryTypes(g['secondary-types']),
        firstReleaseDate: g['first-release-date'] || null,
      });
    }
    const total = res['release-group-count'] ?? out.length;
    offset += groups.length;
    if (groups.length === 0 || offset >= total) {
      break;
    }
  }
  return out;
}

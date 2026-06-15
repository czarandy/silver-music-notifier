// Helpers for linking to MusicBrainz pages. Release MBIDs in this app are
// release-group IDs, so releases link to /release-group/<mbid>.
const BASE = 'https://musicbrainz.org';

export function artistUrl(mbid: string): string {
  return `${BASE}/artist/${mbid}`;
}

export function releaseGroupUrl(mbid: string): string {
  return `${BASE}/release-group/${mbid}`;
}

// MusicBrainz release-group type vocabularies. Kept in a dependency-free module
// so both the MusicBrainz client and Settings can use them without a circular
// import.

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

export function isPrimaryType(
  value: unknown,
): value is ReleaseGroupPrimaryType {
  return RELEASE_GROUP_PRIMARY_TYPES.includes(value as ReleaseGroupPrimaryType);
}

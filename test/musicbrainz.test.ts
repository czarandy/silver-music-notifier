import {beforeEach, describe, expect, it, vi} from 'vitest';
import packageJson from '../package.json' with {type: 'json'};

const mocks = vi.hoisted(() => {
  const search = vi.fn();
  const browse = vi.fn();
  const mbContact = vi.fn(() => 'tests@example.com');
  const MusicBrainzApi = vi.fn(function (this: {
    search: typeof search;
    browse: typeof browse;
    _contact?: string;
  }) {
    this.search = search;
    this.browse = browse;
  });

  return {browse, mbContact, MusicBrainzApi, search};
});

vi.mock('musicbrainz-api', () => ({
  MusicBrainzApi: mocks.MusicBrainzApi,
}));

vi.mock('../src/lib/Settings.js', () => ({
  Settings: {
    musicBrainzContact: mocks.mbContact,
  },
}));

describe('musicbrainz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps artist search results into app-shaped artists', async () => {
    const {searchArtist} = await import('../src/lib/musicbrainz.js');
    mocks.search.mockResolvedValueOnce({
      artists: [
        {
          id: 'artist-1',
          name: 'Silver Artist',
          'sort-name': 'Artist, Silver',
          disambiguation: 'test artist',
          country: 'US',
          type: 'Group',
        },
        {
          id: 'artist-2',
          name: 'Silver Artist Tribute',
          'sort-name': 'Silver Artist Tribute',
          disambiguation: 'tribute act',
        },
      ],
    });

    await expect(searchArtist('silver')).resolves.toEqual([
      {
        mbid: 'artist-1',
        name: 'Silver Artist',
        sortName: 'Artist, Silver',
        disambiguation: 'test artist',
        country: 'US',
        type: 'Group',
      },
      {
        mbid: 'artist-2',
        name: 'Silver Artist Tribute',
        sortName: 'Silver Artist Tribute',
        disambiguation: 'tribute act',
        country: undefined,
        type: undefined,
      },
    ]);
    expect(mocks.search).toHaveBeenCalledWith('artist', {
      query: 'silver',
      limit: 10,
    });
    expect(mocks.MusicBrainzApi).toHaveBeenCalledWith({
      appName: 'silver-music-notifier',
      appVersion: packageJson.version,
      appContactInfo: 'tests@example.com',
    });
  });

  it('fetches release groups across MusicBrainz result pages', async () => {
    const {fetchReleaseGroups} = await import('../src/lib/musicbrainz.js');
    mocks.browse
      .mockResolvedValueOnce({
        'release-group-count': 2,
        'release-groups': [
          {
            id: 'release-1',
            title: 'First Release',
            'primary-type': 'Album',
            'secondary-types': ['Compilation', 'Not a real secondary type'],
            'first-release-date': '2026-01-02',
          },
        ],
      })
      .mockResolvedValueOnce({
        'release-group-count': 2,
        'release-groups': [
          {
            id: 'release-2',
            title: 'Second Release',
            'primary-type': 'Not a real primary type',
          },
        ],
      });

    await expect(fetchReleaseGroups('artist-1')).resolves.toEqual([
      {
        mbid: 'release-1',
        title: 'First Release',
        primaryType: 'Album',
        secondaryTypes: ['Compilation'],
        firstReleaseDate: '2026-01-02',
      },
      {
        mbid: 'release-2',
        title: 'Second Release',
        primaryType: null,
        secondaryTypes: [],
        firstReleaseDate: null,
      },
    ]);
    expect(mocks.browse).toHaveBeenNthCalledWith(1, 'release-group', {
      artist: 'artist-1',
      limit: 100,
      offset: 0,
    });
    expect(mocks.browse).toHaveBeenNthCalledWith(2, 'release-group', {
      artist: 'artist-1',
      limit: 100,
      offset: 1,
    });
  });
});

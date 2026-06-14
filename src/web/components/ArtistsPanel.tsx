import {useCallback, useMemo, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {X} from 'lucide-react';
import {
  AutocompleteInput,
  Button,
  EmptyState,
  Item,
  List,
  ListItem,
  Spinner,
  Tag,
  useToast,
  type SearchSource,
  type StandardSearchableItem,
} from 'silver-ui';
import {api, type Artist, type ArtistSearchResult} from '../api.js';

type ArtistSearchItem = StandardSearchableItem<ArtistSearchResult>;

export function ArtistsPanel() {
  const showToast = useToast();
  const queryClient = useQueryClient();
  const [selectedSearchItem, setSelectedSearchItem] =
    useState<ArtistSearchItem | null>(null);
  const artistsQuery = useQuery({
    queryKey: ['artists'],
    queryFn: api.listArtists,
  });
  const addMutation = useMutation({
    mutationFn: api.addArtist,
    onSuccess: async ({added}, artist) => {
      showToast({
        type: added ? 'success' : 'info',
        body: added
          ? `Added ${artist.name}.`
          : `${artist.name} is already tracked.`,
      });
      setSelectedSearchItem(null);
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['artists']}),
        queryClient.invalidateQueries({queryKey: ['releases']}),
      ]);
    },
  });
  const removeMutation = useMutation({
    mutationFn: api.removeArtist,
    onSuccess: async (_removed, mbid) => {
      const artist = artists.find(a => a.mbid === mbid);
      showToast({
        type: 'success',
        body: artist ? `Removed ${artist.name}.` : 'Removed artist.',
      });
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['artists']}),
        queryClient.invalidateQueries({queryKey: ['releases']}),
      ]);
    },
  });
  const artists = artistsQuery.data ?? [];

  const searchSource = useMemo<SearchSource<ArtistSearchItem>>(
    () => ({
      bootstrap: () => [],
      search: async query => {
        const q = query.trim();
        if (q.length < 2) {
          return [];
        }
        const results = await queryClient.fetchQuery({
          queryKey: ['artistSearch', q],
          queryFn: () => api.searchArtists(q),
        });
        return results.map(result => ({
          id: result.mbid,
          label: result.name,
          auxiliaryData: result,
        }));
      },
    }),
    [queryClient],
  );

  function add(r: ArtistSearchResult): void {
    addMutation.mutate({
      mbid: r.mbid,
      name: r.name,
      sortName: r.sortName,
      disambiguation: r.disambiguation,
      type: r.type,
      country: r.country,
    });
  }

  const remove = useCallback(
    (a: Artist) => {
      removeMutation.mutate(a.mbid);
    },
    [removeMutation],
  );

  const artistItems = useMemo(
    () =>
      artists.map(a => (
        <ListItem
          key={a.mbid}
          label={a.name}
          description={a.disambiguation}
          endContent={
            <span
              style={{display: 'inline-flex', gap: 8, alignItems: 'center'}}>
              <span style={{display: 'inline-flex', gap: 6}}>
                {a.type ? <Tag label={a.type} color="gray" size="sm" /> : null}
                {a.country ? (
                  <Tag label={a.country} color="blue" size="sm" />
                ) : null}
              </span>
              <Button
                label="Remove"
                icon={X}
                isIconOnly
                variant="ghost"
                size="sm"
                onClick={() => remove(a)}
              />
            </span>
          }
        />
      )),
    [artists, remove],
  );

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 24}}>
      <section>
        <AutocompleteInput<ArtistSearchItem>
          label="Add an artist"
          placeholder="Search MusicBrainz by name…"
          value={selectedSearchItem}
          searchSource={searchSource}
          debounceMs={350}
          emptySearchResultsText="No MusicBrainz artists found"
          onChange={item => {
            setSelectedSearchItem(item);
            if (item?.auxiliaryData) {
              add(item.auxiliaryData);
            }
          }}
          renderItem={item => {
            const artist = item.auxiliaryData;
            return (
              <Item
                label={item.label}
                description={artist?.disambiguation}
                endContent={
                  <span style={{display: 'inline-flex', gap: 6}}>
                    {artist?.type ? (
                      <Tag label={artist.type} color="gray" size="sm" />
                    ) : null}
                    {artist?.country ? (
                      <Tag label={artist.country} color="blue" size="sm" />
                    ) : null}
                  </span>
                }
              />
            );
          }}
          hasClear
        />
      </section>

      <section>
        {artistsQuery.isLoading ? (
          <Spinner label="Loading artists…" />
        ) : artists.length === 0 ? (
          <EmptyState
            title="No artists yet"
            description="Search above to start tracking an artist."
          />
        ) : (
          <List hasDividers>{artistItems}</List>
        )}
      </section>
    </div>
  );
}

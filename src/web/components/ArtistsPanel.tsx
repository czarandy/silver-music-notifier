import {useCallback, useMemo, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {X} from 'lucide-react';
import {
  AutocompleteInput,
  Badge,
  Button,
  EmptyState,
  HStack,
  Item,
  Layout,
  LayoutContent,
  LayoutHeader,
  List,
  ListItem,
  Spinner,
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
  const releasesQuery = useQuery({
    queryKey: ['releases'],
    queryFn: api.listReleases,
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
  const releases = releasesQuery.data ?? [];

  const releaseCountsByArtist = useMemo(() => {
    const counts = new Map<string, number>();
    for (const release of releases) {
      counts.set(release.artistMbid, (counts.get(release.artistMbid) ?? 0) + 1);
    }
    return counts;
  }, [releases]);

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
      artists.map(a => {
        const releaseCount = releaseCountsByArtist.get(a.mbid) ?? 0;
        return (
          <ListItem
            key={a.mbid}
            label={a.name}
            description={a.disambiguation}
            endContent={
              <HStack align="center" gap={2}>
                <Badge
                  label={`${releaseCount} release${releaseCount === 1 ? '' : 's'}`}
                  color="neutral"
                  size="sm"
                />
                {a.type ? (
                  <Badge label={a.type} color="neutral" size="sm" />
                ) : null}
                {a.country ? (
                  <Badge label={a.country} color="teal" size="sm" />
                ) : null}
                <Button
                  label="Remove"
                  icon={X}
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(a)}
                />
              </HStack>
            }
          />
        );
      }),
    [artists, releaseCountsByArtist, remove],
  );

  return (
    <Layout
      height="auto"
      hasDividers={false}
      header={
        <LayoutHeader
          title="Artists"
          level={3}
          subtitle={`${artists.length} artist${artists.length === 1 ? '' : 's'} tracked`}
          padding={0}
        />
      }
      content={
        <LayoutContent padding={0}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginTop: 16,
            }}>
            <section>
              <AutocompleteInput<ArtistSearchItem>
                label="Add an artist"
                placeholder="Search by name…"
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
                        <HStack align="center" gap={1}>
                          {artist?.type ? (
                            <Badge
                              label={artist.type}
                              color="neutral"
                              size="sm"
                            />
                          ) : null}
                          {artist?.country ? (
                            <Badge
                              label={artist.country}
                              color="teal"
                              size="sm"
                            />
                          ) : null}
                        </HStack>
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
        </LayoutContent>
      }
    />
  );
}

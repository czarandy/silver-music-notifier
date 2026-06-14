import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {X} from 'lucide-react';
import {
  Button,
  EmptyState,
  Spinner,
  Table,
  Tag,
  Text,
  TextInput,
  useToast,
  type TableColumn,
} from 'silver-ui';
import {api, type Artist, type ArtistSearchResult} from '../api.js';

export function ArtistsPanel() {
  const showToast = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const artistsQuery = useQuery({
    queryKey: ['artists'],
    queryFn: api.listArtists,
  });
  const searchQuery = useQuery({
    queryKey: ['artistSearch', debouncedQuery],
    queryFn: () => api.searchArtists(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
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
      setQuery('');
      setDebouncedQuery('');
      await queryClient.invalidateQueries({queryKey: ['artists']});
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
  const results: ArtistSearchResult[] =
    debouncedQuery.length >= 2 ? (searchQuery.data ?? []) : [];

  useEffect(
    () => () => {
      if (debounce.current) {
        clearTimeout(debounce.current);
      }
    },
    [],
  );

  const updateQuery = (value: string) => {
    setQuery(value);
    if (debounce.current) {
      clearTimeout(debounce.current);
    }
    const q = value.trim();
    if (q.length < 2) {
      setDebouncedQuery('');
      return;
    }
    debounce.current = setTimeout(() => setDebouncedQuery(q), 350);
  };

  function add(r: ArtistSearchResult) {
    addMutation.mutate({
      mbid: r.mbid,
      name: r.name,
      sortName: r.sortName,
      disambiguation: r.disambiguation,
    });
  }

  const remove = useCallback(
    (a: Artist) => {
      removeMutation.mutate(a.mbid);
    },
    [removeMutation],
  );

  const columns = useMemo<TableColumn<Artist>[]>(
    () => [
      {
        key: 'name',
        header: 'Artist',
        renderCell: a => (
          <span>
            {a.name}
            {a.disambiguation ? (
              <Text color="secondary"> — {a.disambiguation}</Text>
            ) : null}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        align: 'end',
        renderCell: a => (
          <Button
            label="Remove"
            icon={X}
            isIconOnly
            variant="ghost"
            size="sm"
            onClick={() => remove(a)}
          />
        ),
      },
    ],
    [remove],
  );

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 24}}>
      <section>
        <TextInput
          label="Add an artist"
          placeholder="Search MusicBrainz by name…"
          value={query}
          onChange={updateQuery}
          isLoading={searchQuery.isFetching}
          hasClear
        />
        {results.length > 0 && (
          <div
            style={{
              marginTop: 8,
              border: '1px solid var(--silver-color-border, #ddd)',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
            {results.map(r => (
              <button
                key={r.mbid}
                onClick={() => add(r)}
                style={{
                  display: 'flex',
                  width: '100%',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid var(--silver-color-border, #eee)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}>
                <span>
                  <strong>{r.name}</strong>
                  {r.disambiguation ? (
                    <Text color="secondary"> — {r.disambiguation}</Text>
                  ) : null}
                </span>
                <span style={{display: 'flex', gap: 6}}>
                  {r.type ? (
                    <Tag label={r.type} color="gray" size="sm" />
                  ) : null}
                  {r.country ? (
                    <Tag label={r.country} color="blue" size="sm" />
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        )}
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
          <Table<Artist> columns={columns} data={artists} />
        )}
      </section>
    </div>
  );
}

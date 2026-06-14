import {useEffect, useRef, useState} from 'react';
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
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ArtistSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function reload() {
    setArtists(await api.listArtists());
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (debounce.current) {
      clearTimeout(debounce.current);
    }
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await api.searchArtists(q));
      } catch (err) {
        showToast({type: 'error', body: errMsg(err)});
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (debounce.current) {
        clearTimeout(debounce.current);
      }
    };
  }, [query, showToast]);

  async function add(r: ArtistSearchResult) {
    try {
      const {added} = await api.addArtist({
        mbid: r.mbid,
        name: r.name,
        sortName: r.sortName,
        disambiguation: r.disambiguation,
      });
      showToast({
        type: added ? 'success' : 'info',
        body: added ? `Added ${r.name}.` : `${r.name} is already tracked.`,
      });
      setQuery('');
      setResults([]);
      await reload();
    } catch (err) {
      showToast({type: 'error', body: errMsg(err)});
    }
  }

  async function remove(a: Artist) {
    try {
      await api.removeArtist(a.mbid);
      showToast({type: 'success', body: `Removed ${a.name}.`});
      await reload();
    } catch (err) {
      showToast({type: 'error', body: errMsg(err)});
    }
  }

  const columns: TableColumn<Artist>[] = [
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
          variant="ghost"
          size="sm"
          onClick={() => remove(a)}
        />
      ),
    },
  ];

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 24}}>
      <section>
        <TextInput
          label="Add an artist"
          placeholder="Search MusicBrainz by name…"
          value={query}
          onChange={v => setQuery(v)}
          isLoading={searching}
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
        {loading ? (
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

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

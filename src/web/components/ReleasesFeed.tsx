import {useEffect, useState} from 'react';
import {
  Badge,
  Button,
  EmptyState,
  Spinner,
  Table,
  Text,
  useToast,
  type TableColumn,
} from 'silver-ui';
import {api, type Release} from '../api.js';

export function ReleasesFeed() {
  const showToast = useToast();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function reload() {
    setReleases(await api.listReleases());
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      const summary = await api.refresh();
      await reload();
      showToast({
        type: summary.newCount > 0 ? 'success' : 'info',
        body:
          summary.newCount > 0
            ? `Found ${summary.newCount} new release${summary.newCount === 1 ? '' : 's'}.`
            : `No new releases (scanned ${summary.scannedArtists}).`,
      });
      if (summary.errors.length > 0) {
        showToast({
          type: 'warning',
          body: `${summary.errors.length} artist(s) failed to refresh.`,
        });
      }
    } catch (err) {
      showToast({
        type: 'error',
        body: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRefreshing(false);
    }
  }

  const columns: TableColumn<Release>[] = [
    {
      key: 'title',
      header: 'Release',
      renderCell: r => (
        <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
          <strong>{r.title}</strong>
          {r.isNew ? <Badge label="New" color="success" /> : null}
        </span>
      ),
    },
    {key: 'artistName', header: 'Artist', renderCell: r => r.artistName},
    {
      key: 'type',
      header: 'Type',
      renderCell: r =>
        [r.primaryType, r.secondaryTypes].filter(Boolean).join(' / ') || '—',
    },
    {
      key: 'date',
      header: 'Released',
      align: 'end',
      renderCell: r => r.firstReleaseDate ?? '—',
    },
  ];

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
        <Text color="secondary">
          {releases.length} release{releases.length === 1 ? '' : 's'} tracked
        </Text>
        <Button
          label="Refresh"
          variant="primary"
          isLoading={refreshing}
          onClick={refresh}
        />
      </div>

      {loading ? (
        <Spinner label="Loading releases…" />
      ) : releases.length === 0 ? (
        <EmptyState
          title="No releases yet"
          description="Add some artists, then hit Refresh to pull their releases from MusicBrainz."
        />
      ) : (
        <Table<Release> columns={columns} data={releases} />
      )}
    </div>
  );
}

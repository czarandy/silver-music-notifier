import {useCallback, useMemo} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {
  Badge,
  Button,
  EmptyState,
  Heading,
  proportional,
  Spinner,
  Table,
  Text,
  useTableSortable,
  useTableSortableState,
  useToast,
  type TableColumn,
  type TableSortComparator,
} from 'silver-ui';
import {api, type Release} from '../api.js';
import {formatReleaseDate} from '../../lib/formatReleaseDate.js';

type ReleaseSortKey = 'title' | 'artistName' | 'type' | 'date';

const stringCompare = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
}).compare;

function releaseType(r: Release): string {
  return [r.primaryType, r.secondaryTypes].filter(Boolean).join(' / ');
}

const sortComparators: Record<ReleaseSortKey, TableSortComparator<Release>> = {
  title: (a, b) => stringCompare(a.title, b.title),
  artistName: (a, b) => stringCompare(a.artistName, b.artistName),
  type: (a, b) => stringCompare(releaseType(a), releaseType(b)),
  date: (a, b) =>
    stringCompare(a.firstReleaseDate ?? '', b.firstReleaseDate ?? ''),
};

export function ReleasesFeed() {
  const showToast = useToast();
  const queryClient = useQueryClient();
  const releasesQuery = useQuery({
    queryKey: ['releases'],
    queryFn: api.listReleases,
  });
  const refreshMutation = useMutation({
    mutationFn: api.refresh,
    onSuccess: async summary => {
      await queryClient.invalidateQueries({queryKey: ['releases']});
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
    },
    onError: err => {
      showToast({
        type: 'error',
        body: err instanceof Error ? err.message : String(err),
      });
    },
  });
  const dismissMutation = useMutation({
    mutationFn: api.dismissRelease,
    onSuccess: async () => {
      await queryClient.invalidateQueries({queryKey: ['releases']});
    },
    onError: err => {
      showToast({
        type: 'error',
        body: err instanceof Error ? err.message : String(err),
      });
    },
  });
  const releases = releasesQuery.data ?? [];
  const {sortConfig, sortedData} = useTableSortableState<
    Release,
    ReleaseSortKey
  >({
    data: releases,
    defaultSort: [{sortKey: 'date', direction: 'descending'}],
    comparators: sortComparators,
  });
  const sortable = useTableSortable<Release, ReleaseSortKey>(sortConfig);

  const dismissRelease = useCallback(
    (mbid: string) => {
      dismissMutation.mutate(mbid);
    },
    [dismissMutation.mutate],
  );

  const columns = useMemo<TableColumn<Release>[]>(
    () => [
      {
        key: 'title',
        header: 'Release',
        sortable: {sortKey: 'title'},
        width: proportional(3, {minWidth: 220}),
        renderCell: r => (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              width: '100%',
            }}>
            <span>{r.title}</span>
            {r.isNew ? (
              <button
                type="button"
                aria-label={`Dismiss New badge for ${r.title}`}
                onClick={() => dismissRelease(r.mbid)}
                style={{
                  background: 'none',
                  border: 0,
                  cursor: 'pointer',
                  padding: 0,
                }}>
                <Badge label="New" color="success" />
              </button>
            ) : null}
          </span>
        ),
      },
      {
        key: 'artistName',
        header: 'Artist',
        sortable: true,
        width: proportional(2.5, {minWidth: 180}),
        renderCell: r => r.artistName,
      },
      {
        key: 'type',
        header: 'Type',
        sortable: true,
        width: proportional(1, {minWidth: 96}),
        renderCell: r =>
          [r.primaryType, r.secondaryTypes].filter(Boolean).join(' / ') || '—',
      },
      {
        key: 'date',
        header: 'Released',
        align: 'end',
        sortable: true,
        width: proportional(1, {minWidth: 96}),
        renderCell: r => formatReleaseDate(r.firstReleaseDate),
      },
    ],
    [dismissRelease],
  );

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
        }}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
          <Heading level={2}>Releases</Heading>
          <Text color="secondary">
            {releases.length} release{releases.length === 1 ? '' : 's'} tracked
          </Text>
        </div>
        <Button
          label="Refresh"
          variant="primary"
          isLoading={refreshMutation.isPending}
          onClick={() => refreshMutation.mutate()}
        />
      </div>

      {releasesQuery.isLoading ? (
        <Spinner label="Loading releases…" />
      ) : releases.length === 0 ? (
        <EmptyState
          title="No releases yet"
          description="Add some artists, then hit Refresh to pull their releases from MusicBrainz."
        />
      ) : (
        <Table<Release>
          columns={columns}
          data={sortedData}
          plugins={[sortable]}
        />
      )}
    </div>
  );
}

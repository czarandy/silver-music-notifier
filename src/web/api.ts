export interface Artist {
  mbid: string;
  name: string;
  sort_name: string | null;
  disambiguation: string | null;
  added_at: string;
  // Index signature so the type satisfies silver-ui's Table<T> constraint.
  [key: string]: unknown;
}

export interface ArtistSearchResult {
  mbid: string;
  name: string;
  sortName: string;
  disambiguation: string;
  country?: string;
  type?: string;
}

export interface Release {
  mbid: string;
  artistMbid: string;
  artistName: string;
  title: string;
  primaryType: string | null;
  secondaryTypes: string | null;
  firstReleaseDate: string | null;
  firstSeenAt: string;
  isNew: boolean;
  [key: string]: unknown;
}

export interface RefreshSummary {
  scannedArtists: number;
  newCount: number;
  newReleases: unknown[];
  errors: { artist: string; message: string }[];
}

export interface Settings {
  notify: { inPage: boolean; desktop: boolean; email: boolean };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
    to: string;
  };
  musicbrainz: { contact: string };
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  listArtists: () => req<Artist[]>("/artists"),
  searchArtists: (q: string) =>
    req<ArtistSearchResult[]>(`/artists/search?q=${encodeURIComponent(q)}`),
  addArtist: (a: { mbid: string; name: string; sortName?: string; disambiguation?: string }) =>
    req<{ added: boolean }>("/artists", { method: "POST", body: JSON.stringify(a) }),
  removeArtist: (mbid: string) =>
    req<{ removed: Artist }>(`/artists/${encodeURIComponent(mbid)}`, { method: "DELETE" }),
  listReleases: () => req<Release[]>("/releases"),
  refresh: () => req<RefreshSummary>("/refresh", { method: "POST" }),
  getSettings: () => req<Settings>("/settings"),
  saveSettings: (s: Partial<Settings>) =>
    req<Settings>("/settings", { method: "PUT", body: JSON.stringify(s) }),
  testEmail: (s: Partial<Settings>) =>
    req<{ ok: boolean }>("/settings/test-email", {
      method: "POST",
      body: JSON.stringify(s),
    }),
};

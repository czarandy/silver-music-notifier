# silver-music-notifier

Track a list of artists and get notified of their new music releases from
[MusicBrainz](https://musicbrainz.org). Drive it from the terminal, or launch a
local web UI (built with [silver-ui](https://silver-ui.com)).

## Install

```bash
npm install -g silver-music-notifier
```

This requires a working build toolchain for `better-sqlite3` (the native SQLite
driver), which is built automatically on install.

## Usage

### Web UI

```bash
silver-music-notifier web            # starts on http://localhost:3001 and opens a browser
silver-music-notifier web --port 8080 --no-open
```

The UI has three views:

- **Releases** — a feed of every known release-group, newest first, with a
  **Refresh** button and a "New" badge on releases discovered in the last refresh.
- **Artists** — search MusicBrainz and add/remove the artists you follow.
- **Settings** — choose notification methods and configure SMTP for email.

### CLI

```bash
silver-music-notifier add "Radiohead"          # search MusicBrainz, pick a match
silver-music-notifier add "Boards of Canada" -y  # add the top match, no prompt
silver-music-notifier add "X" --mbid <mbid>    # add an exact MBID
silver-music-notifier list                     # list tracked artists
silver-music-notifier remove "Radiohead"       # stop tracking (by name or MBID)
silver-music-notifier refresh                  # fetch releases + notify on new ones
silver-music-notifier releases --new --limit 20
silver-music-notifier config get               # show settings
silver-music-notifier config set notify.desktop false
```

## Notifications

When `refresh` finds releases it has never seen before, it can notify you three ways:

- **In-page badges** — "New" badges in the web UI (always available).
- **Desktop** — a system notification (enabled by default).
- **Email** — an HTML summary, sent once SMTP is configured and the email toggle
  is on. Configure it in the **Settings** view or via `config set smtp.*`.

`refresh` is manual — run it from the CLI, the web button, or your own scheduler
(cron, systemd timer, etc.).

## Data & configuration

State lives in a single SQLite file in your per-user data directory
(e.g. `~/.config/silver-music-notifier/data.db` on Linux). Override the location
with the `SMN_DATA_DIR` environment variable.

> **Note:** SMTP credentials (including the password) are stored in plaintext in
> that local SQLite file. This is a single-user local tool; treat the data
> directory accordingly.

Other environment variables:

- `SMN_DATA_DIR` — override the data directory.
- `SMN_DISABLE_DESKTOP=1` — suppress desktop notifications.
- `SMN_MB_CONTACT` — fallback MusicBrainz contact for the API User-Agent.

## Development

```bash
npm install
npm run dev        # backend (tsx watch, :3001) + Vite dev server (:5173, proxies /api)
npm run build      # bundle CLI/server (tsup) + build web (vite) into dist/
npm run typecheck
npm run lint       # eslint
npm run lint:fix   # eslint --fix
npm run format     # prettier --write .
```

A Husky `pre-commit` hook runs `lint-staged` (eslint `--fix` then prettier on
staged files) followed by `typecheck`, so commits are auto-formatted and linted.

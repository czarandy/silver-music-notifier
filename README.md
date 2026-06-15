# silver-music-notifier

Track a list of artists and get notified of their new music releases from
[MusicBrainz](https://musicbrainz.org). Drive it from the terminal, or launch a
local web UI (built with [silver-ui](https://silver-ui.com)).

## Install

```bash
npm install -g silver-music-notifier
```

Requires Node.js 22.12.0 or newer.

This requires a working build toolchain for `better-sqlite3` (the native SQLite
driver), which is built automatically on install.

## MusicBrainz contact (required)

MusicBrainz requires every API client to identify a contact (an email or URL) in
its User-Agent, and throttles or blocks requests without one. The first time you
run a command that hits the API (`add` or `refresh`), the CLI **prompts you for a
contact** and saves it. You can also set it ahead of time:

```bash
silver-music-notifier config set musicbrainz.contact you@example.com
```

or in the web UI's **Settings** view. In a non-interactive context (no TTY), the
command errors with this guidance instead of prompting.

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
- **Settings** — set the MusicBrainz contact (required), choose notification
  methods, and configure SMTP for email.

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
silver-music-notifier config set notify.email true
```

## Notifications

When `refresh` finds releases it has never seen before, it can notify you two ways:

- **In-page badges** — "New" badges in the web UI (always available).
- **Email** — an HTML summary, sent once SMTP is configured and the email toggle
  is on. Configure it in the **Settings** view or via `config set smtp.*`.

`refresh` is manual — run it from the CLI, the web button, or your own scheduler
(cron, systemd timer, etc.).

## Data & configuration

State lives in a single SQLite file (`data.db`) in your per-user data directory:

- **Linux:** `$XDG_DATA_HOME/silver-music-notifier` (usually `~/.local/share/silver-music-notifier`)
- **macOS:** `~/Library/Application Support/silver-music-notifier`
- **Windows:** `%LOCALAPPDATA%\silver-music-notifier\Data`

Override the location with the `SILVER_MUSIC_NOTIFIER_DATA_DIR` environment
variable.

> **Note:** SMTP credentials (including the password) are stored in plaintext in
> that local SQLite file. This is a single-user local tool; treat the data
> directory accordingly.

Notification methods (in-page / email) and the MusicBrainz contact are
configured in the web UI's **Settings** view or via `silver-music-notifier
config set …` — not through environment variables.

The only environment variable is:

- `SILVER_MUSIC_NOTIFIER_DATA_DIR` — override the data directory (must be an env
  var, since all other settings are stored inside it).

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

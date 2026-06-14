# Publishing

`silver-music-notifier` is published to npm with a **two-stage release** (same
model as silver-ui):

1. **Locally**, `npm run release` runs the quality gates, builds, bumps the
   version, pushes a `vX.Y.Z` tag, and creates a GitHub Release.
2. **In CI**, [`.github/workflows/publish.yml`](.github/workflows/publish.yml)
   runs on the published release and does the actual `npm publish` from a clean
   runner, authenticating via **OIDC "trusted publishing"** — no npm token is
   stored anywhere, and an npm provenance badge is generated automatically.

The local script never publishes to npm itself; it cuts the release that CI
publishes.

## One-time setup

1. **GitHub repo + remote.** Create the repo and point `origin` at it:

   ```bash
   gh repo create czarandy/silver-music-notifier --private --source=. --remote=origin --push
   ```

   (Update the slug in `package.json` `repository`/`homepage`/`bugs` and in
   `scripts/release.sh` if you use a different name/owner.)

2. **npm trusted publisher.** On npmjs.com → the package's **Settings →
   Trusted Publishing**, add a GitHub Actions publisher:
   - Repository: `czarandy/silver-music-notifier`
   - Workflow: `publish.yml`

   The package must exist on npm first. For the **very first publish**, either
   do one manual `npm publish` locally (`npm run build && npm publish`) to create
   it, then configure trusted publishing for all later releases — or create the
   trusted publisher before the first release if npm lets you pre-register it.

3. **Local tooling.** Install the [GitHub CLI](https://cli.github.com/) and run
   `gh auth login`. (The release script needs `gh`, not npm auth.)

## Cutting a release

```bash
npm run release                 # prompts for patch / minor / major / prerelease
npm run release -- patch        # skip the type prompt
npm run release -- minor --yes  # also skip confirmation prompts
npm run release -- prerelease   # e.g. 0.1.1-beta.0 → CI publishes to the 'next' tag
npm run release -- --dry-run    # run all checks + build, but do NOT bump/tag/push
```

Release notes default to a changelog auto-generated from commit titles since the
previous tag (with an option to edit). Override with `--notes="…"`,
`--notes-file=NOTES.md`, or force the editor with `--edit`.

### Gates (run locally, then again in CI)

`typecheck` → `test` → `lint` → `build` → `publint` (`check:exports`) →
package smoke test (`scripts/package-smoke-test.mjs`, which packs the tarball and
runs the shipped `bin`).

## Installing a published release

```bash
npm install -g silver-music-notifier        # latest stable
npm install -g silver-music-notifier@next    # most recent pre-release
```

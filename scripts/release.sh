#!/usr/bin/env bash
#
# release.sh — interactive release driver for silver-music-notifier.
#
# Two-stage release (mirrors silver-ui):
#   1. (here) preflight -> checks -> build -> bump version -> tag -> push ->
#      create a GitHub Release.
#   2. (CI) .github/workflows/publish.yml runs on the published release and does
#      the actual `npm publish` from a clean runner, authenticating via OIDC
#      "trusted publishing" — no npm token anywhere. Provenance is automatic.
#
# This script never publishes to npm itself — it cuts the release that CI
# publishes. The local checks/build are a fast-fail gate; CI re-runs them.
#
# Usage:
#   npm run release                 # prompts for the release type
#   npm run release -- patch        # skip the type prompt
#   npm run release -- minor --yes  # also skip confirmation prompts
#   npm run release -- prerelease   # cuts e.g. 0.1.1-beta.0 (CI -> 'next' dist-tag)
#   npm run release -- --dry-run    # run every check + build but do NOT bump/tag/push
#   npm run release -- patch --preid=rc
#
# Release notes (default: changelog from commit titles since the previous tag):
#   npm run release -- patch --edit
#   npm run release -- patch --notes="Fixes the X bug"
#   npm run release -- patch --notes-file=NOTES.md
#
set -euo pipefail

# --- locate repo root so the script works from anywhere ---------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# --- pretty output ----------------------------------------------------------
bold() { printf '\033[1m%s\033[0m\n' "$1"; }
info() { printf '\033[36m›\033[0m %s\n' "$1"; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '\033[33m!\033[0m %s\n' "$1"; }
die()  { printf '\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

# --- parse args -------------------------------------------------------------
RELEASE_TYPE=""
ASSUME_YES=0
DRY_RUN=0
PREID="beta"
NOTES_TEXT=""
NOTES_FILE=""
EDIT_NOTES=0
NOTES_TMP=""
DEFAULT_NOTES=""
PREV_TAG=""

for arg in "$@"; do
  case "$arg" in
    patch|minor|major|prerelease|premajor|preminor|prepatch) RELEASE_TYPE="$arg" ;;
    --yes|-y)            ASSUME_YES=1 ;;
    --dry-run)           DRY_RUN=1 ;;
    --preid=*)           PREID="${arg#*=}" ;;
    --notes=*)           NOTES_TEXT="${arg#*=}" ;;
    --notes-file=*)      NOTES_FILE="${arg#*=}" ;;
    --edit|--edit-notes) EDIT_NOTES=1 ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

trap '[ -n "$NOTES_TMP" ] && rm -f "$NOTES_TMP"' EXIT

if [ -n "$NOTES_FILE" ] && [ -n "$NOTES_TEXT" ]; then
  die "Use only one of --notes or --notes-file."
fi
if [ -n "$NOTES_FILE" ] && [ ! -f "$NOTES_FILE" ]; then
  die "Notes file not found: $NOTES_FILE"
fi

confirm() {
  [ "$ASSUME_YES" -eq 1 ] && return 0
  local reply
  printf '\033[33m?\033[0m %s [y/N] ' "$1"
  read -r reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

# --- preflight --------------------------------------------------------------
bold "silver-music-notifier release"
echo

command -v gh >/dev/null 2>&1 || die "GitHub CLI ('gh') not found. Install it: https://cli.github.com/"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside a git repository."

# CI publishes via a GitHub Release, so we need gh auth — not npm auth — locally.
gh auth status >/dev/null 2>&1 || die "Not logged in to GitHub CLI. Run 'gh auth login' first."
ok "Authenticated to GitHub CLI"

git remote get-url origin >/dev/null 2>&1 || die "No 'origin' remote. Add one: git remote add origin git@github.com:czarandy/silver-music-notifier.git"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  warn "You are on branch '$BRANCH', not 'main'."
  confirm "Continue releasing from '$BRANCH'?" || die "Aborted."
fi

# Working tree must be clean: npm version refuses to run otherwise, and a clean
# tree guarantees CI publishes exactly what is committed. dist/ is gitignored.
if [ -n "$(git status --porcelain)" ]; then
  git status --short
  die "Working tree is not clean. Commit or stash changes first."
fi
ok "Working tree clean (branch: $BRANCH)"

# Make sure local branch isn't diverged from origin.
git fetch --quiet origin "$BRANCH" 2>/dev/null || true
if git rev-parse "@{u}" >/dev/null 2>&1; then
  LOCAL="$(git rev-parse @)"; REMOTE="$(git rev-parse '@{u}')"
  if [ "$LOCAL" != "$REMOTE" ] && [ -n "$(git rev-list '@{u}..@' 2>/dev/null)" ] && [ -n "$(git rev-list '@..@{u}' 2>/dev/null)" ]; then
    die "Local '$BRANCH' has diverged from origin. Reconcile before releasing."
  fi
fi

PKG_NAME="$(node -p "require('./package.json').name")"
CUR_VERSION="$(node -p "require('./package.json').version")"
info "Package: $PKG_NAME @ $CUR_VERSION"

if npm view "${PKG_NAME}@${CUR_VERSION}" version >/dev/null 2>&1; then
  warn "${PKG_NAME}@${CUR_VERSION} is already published. The version bump below will move past it."
fi

echo

# --- preview each bump from the *actual* current version --------------------
BASE="${CUR_VERSION%%-*}"
IFS='.' read -r MAJ MIN PAT <<<"$BASE"
PATCH_NEXT="$MAJ.$MIN.$((PAT + 1))"
MINOR_NEXT="$MAJ.$((MIN + 1)).0"
MAJOR_NEXT="$((MAJ + 1)).0.0"
PRE_NEXT="${MAJ}.${MIN}.$((PAT + 1))-${PREID}.0"

# --- choose release type ----------------------------------------------------
if [ -z "$RELEASE_TYPE" ]; then
  bold "What kind of release is this?  (current: $CUR_VERSION)"
  echo "  1) patch       — bug fixes              ($CUR_VERSION → $PATCH_NEXT)"
  echo "  2) minor       — new, backward-compat   ($CUR_VERSION → $MINOR_NEXT)"
  echo "  3) major       — breaking changes       ($CUR_VERSION → $MAJOR_NEXT)"
  echo "  4) prerelease  — pre-release tag        ($CUR_VERSION → $PRE_NEXT)"
  printf '\033[33m?\033[0m Select 1-4: '
  read -r choice
  case "$choice" in
    1) RELEASE_TYPE="patch" ;;
    2) RELEASE_TYPE="minor" ;;
    3) RELEASE_TYPE="major" ;;
    4) RELEASE_TYPE="prerelease" ;;
    *) die "Invalid selection: $choice" ;;
  esac
fi

case "$RELEASE_TYPE" in
  patch) NEXT_VERSION="$PATCH_NEXT" ;;
  minor) NEXT_VERSION="$MINOR_NEXT" ;;
  major) NEXT_VERSION="$MAJOR_NEXT" ;;
  *)     NEXT_VERSION="" ;;
esac
if [ -n "$NEXT_VERSION" ]; then
  ok "Release type: $RELEASE_TYPE  ($CUR_VERSION → $NEXT_VERSION)"
else
  ok "Release type: $RELEASE_TYPE  (next version computed by npm)"
fi

IS_PRERELEASE=0
[[ "$RELEASE_TYPE" == pre* ]] && IS_PRERELEASE=1

echo
confirm "Proceed with checks and build?" || die "Aborted."

# --- quality gates (fast-fail; CI re-runs these) ----------------------------
bold "Running checks"
info "typecheck"; npm run typecheck
info "test";      npm test
info "lint";      npm run lint
ok "Checks passed"

bold "Building"
npm run build
ok "Build complete"

info "Validating package (publint)"; npm run check:exports
ok "publint passed"

info "Running package smoke test"; node scripts/package-smoke-test.mjs
ok "Package smoke test passed"

bold "Tarball contents"
npm pack --dry-run
echo
confirm "Does the tarball look correct?" || die "Aborted."

# --- stop here for dry runs -------------------------------------------------
if [ "$DRY_RUN" -eq 1 ]; then
  echo
  ok "Dry run complete — no version bump, tag, push, or GitHub Release created."
  exit 0
fi

# --- cut the release (CI publishes) -----------------------------------------
echo
bold "Ready to release ${PKG_NAME} (${RELEASE_TYPE})"
warn "This will: bump the version, create a git commit + tag, push to origin, and"
warn "create a GitHub Release. The release triggers CI to publish to npm."
confirm "Cut the release?" || die "Aborted before releasing."

# Build the default changelog from commit titles since the previous release tag.
if [ -z "$NOTES_FILE" ] && [ -z "$NOTES_TEXT" ]; then
  PREV_TAG="$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || true)"
  if [ -n "$PREV_TAG" ]; then
    NOTES_RANGE="${PREV_TAG}..HEAD"
  else
    NOTES_RANGE="HEAD"
  fi
  DEFAULT_NOTES="$(git log --no-merges --reverse --pretty=format:'- %s' "$NOTES_RANGE")"
  [ -z "$DEFAULT_NOTES" ] && DEFAULT_NOTES="- (no changes since ${PREV_TAG:-the previous release})"
fi

# 1. Version bump — updates package.json, commits, and creates a tag (vX.Y.Z).
if [ "$IS_PRERELEASE" -eq 1 ]; then
  NEW_TAG="$(npm version "$RELEASE_TYPE" --preid="$PREID")"
else
  NEW_TAG="$(npm version "$RELEASE_TYPE")"
fi
ok "Bumped to $NEW_TAG (commit + tag created)"

# 2. Push commit + tag. Roll back locally if the push fails so we can retry.
info "Pushing commit and tag to origin"
if ! git push --follow-tags; then
  warn "Push failed. Rolling back the version commit and tag."
  git tag -d "$NEW_TAG" 2>/dev/null || true
  git reset --hard HEAD~1
  die "Push failed — repository restored to pre-bump state. Fix the issue and re-run."
fi
ok "Pushed commit and tag to origin"

# 3. Create the GitHub Release. This is what triggers the publish workflow.
GH_FLAGS=(--title "$NEW_TAG")
[ "$IS_PRERELEASE" -eq 1 ] && GH_FLAGS+=(--prerelease)

if [ -n "$NOTES_FILE" ]; then
  GH_FLAGS+=(--notes-file "$NOTES_FILE")
elif [ -n "$NOTES_TEXT" ]; then
  GH_FLAGS+=(--notes "$NOTES_TEXT")
else
  NOTES_TMP="$(mktemp)"
  printf '%s\n' "$DEFAULT_NOTES" >"$NOTES_TMP"

  echo
  bold "Release notes for $NEW_TAG  (commits since ${PREV_TAG:-the beginning})"
  printf '%s\n' "$DEFAULT_NOTES"
  echo

  if [ "$EDIT_NOTES" -eq 1 ] \
     || { [ "$ASSUME_YES" -eq 0 ] && confirm "Edit these release notes before submitting?"; }; then
    "${EDITOR:-${VISUAL:-vi}}" "$NOTES_TMP"
  fi
  GH_FLAGS+=(--notes-file "$NOTES_TMP")
fi

info "Creating GitHub Release $NEW_TAG"
if ! gh release create "$NEW_TAG" "${GH_FLAGS[@]}"; then
  warn "The commit and tag are pushed, but creating the GitHub Release failed."
  warn "Finish manually (this triggers the publish):"
  warn "    gh release create $NEW_TAG ${GH_FLAGS[*]}"
  die "GitHub Release not created."
fi
ok "GitHub Release created"

echo
bold "🎉 Release $NEW_TAG cut. CI is now publishing ${PKG_NAME} to npm."
info "Watch it:   gh run watch  (or: gh run list --workflow=publish.yml)"
if [ "$IS_PRERELEASE" -eq 1 ]; then
  info "Pre-release → 'next' dist-tag. Install with: npm install ${PKG_NAME}@next"
else
  info "Once green:  npm install -g ${PKG_NAME}"
fi

#!/usr/bin/env bash
# Symlink Claude Code plugins into ~/.claude/plugins/.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGINS_SRC="$REPO_DIR/marketplace/plugins"
PLUGINS_DEST="$HOME/.claude/plugins"

DRY_RUN=false
VERBOSE=false
CREATED=0
SKIPPED=0
WARNED=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --verbose) VERBOSE=true ;;
  esac
done

log() { $VERBOSE && echo "  $*" || true; }

if [[ ! -d "$PLUGINS_SRC" ]]; then
  echo "No plugins directory found at $PLUGINS_SRC"
  exit 0
fi

for plugin_dir in "$PLUGINS_SRC"/*/; do
  [[ -d "$plugin_dir" ]] || continue

  plugin_name="$(basename "$plugin_dir")"

  # Verify it's a valid plugin (has plugin.json)
  if [[ ! -f "$plugin_dir/.claude-plugin/plugin.json" ]]; then
    log "SKIP: $plugin_name (no .claude-plugin/plugin.json)"
    ((SKIPPED++)) || true
    continue
  fi

  dest="$PLUGINS_DEST/$plugin_name"
  src="$(cd "$plugin_dir" && pwd)"

  # Already correct symlink
  if [[ -L "$dest" ]]; then
    existing=$(readlink "$dest")
    if [[ "$existing" == "$src" ]]; then
      log "SKIP: $dest (already linked)"
      ((SKIPPED++)) || true
      continue
    else
      log "REPLACE: $dest (was → $existing)"
      if ! $DRY_RUN; then
        rm "$dest"
      fi
    fi
  elif [[ -e "$dest" ]]; then
    log "WARN: $dest exists and is not a symlink, skipping"
    ((WARNED++)) || true
    continue
  fi

  if $DRY_RUN; then
    echo "  [dry-run] ln -s $src → $dest"
  else
    mkdir -p "$PLUGINS_DEST"
    ln -s "$src" "$dest"
    log "CREATED: $dest → $src"
  fi
  ((CREATED++)) || true
done

echo "Plugins: $CREATED synced, $SKIPPED skipped, $WARNED warnings"

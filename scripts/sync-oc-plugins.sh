#!/usr/bin/env bash
# Copy OpenCode .ts plugins, symlink .md commands into ~/.config/opencode/.
# .ts files must be copied (not symlinked) because OpenCode resolves
# imports relative to the file's real path, and symlinks break that.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OC_SRC="$REPO_DIR/oc-plugins"
OC_PLUGIN_DEST="$HOME/.config/opencode/plugins"
OC_COMMAND_DEST="$HOME/.config/opencode/commands"

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

copy_file() {
  local src="$1" dest="$2"

  if [[ -f "$dest" ]] && diff -q "$src" "$dest" &>/dev/null; then
    log "SKIP: $dest (already up to date)"
    ((SKIPPED++)) || true
    return
  fi

  if $DRY_RUN; then
    echo "  [dry-run] cp $src → $dest"
  else
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    log "COPIED: $src → $dest"
  fi
  ((CREATED++)) || true
}

symlink_file() {
  local src="$1" dest="$2"

  if [[ -L "$dest" ]]; then
    existing=$(readlink "$dest")
    if [[ "$existing" == "$src" ]]; then
      log "SKIP: $dest (already linked)"
      ((SKIPPED++)) || true
      return
    else
      log "REPLACE: $dest (was → $existing)"
      if ! $DRY_RUN; then
        rm "$dest"
      fi
    fi
  elif [[ -e "$dest" ]]; then
    log "WARN: $dest exists and is not a symlink, skipping"
    ((WARNED++)) || true
    return
  fi

  if $DRY_RUN; then
    echo "  [dry-run] ln -s $src → $dest"
  else
    mkdir -p "$(dirname "$dest")"
    ln -s "$src" "$dest"
    log "CREATED: $dest → $src"
  fi
  ((CREATED++)) || true
}

if [[ ! -d "$OC_SRC" ]]; then
  echo "No oc-plugins directory found at $OC_SRC"
  exit 0
fi

for plugin_dir in "$OC_SRC"/*/; do
  [[ -d "$plugin_dir" ]] || continue

  # Copy .ts plugin files (not symlink — imports break with symlinks)
  for ts_file in "$plugin_dir"*.ts; do
    [[ -f "$ts_file" ]] || continue
    # Skip test files
    case "$(basename "$ts_file")" in
      *.test.ts|*.spec.ts) continue ;;
    esac
    filename="$(basename "$ts_file")"
    copy_file "$ts_file" "$OC_PLUGIN_DEST/$filename"
  done

  # Symlink .md command files
  for md_file in "$plugin_dir"*.md; do
    [[ -f "$md_file" ]] || continue
    # Skip README
    case "$(basename "$md_file")" in
      README.md|readme.md) continue ;;
    esac
    filename="$(basename "$md_file")"
    symlink_file "$md_file" "$OC_COMMAND_DEST/$filename"
  done
done

echo "OpenCode: $CREATED synced, $SKIPPED skipped, $WARNED warnings"

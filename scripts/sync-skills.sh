#!/usr/bin/env bash
# Symlink skills into agent-specific directories based on config.json.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG="$REPO_DIR/skills/config.json"

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

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required. Install it with: brew install jq" >&2
  exit 1
fi

if [[ ! -f "$CONFIG" ]]; then
  echo "Error: $CONFIG not found" >&2
  exit 1
fi

# Helper: resolve agent path from config
agent_path() {
  local agent="$1"
  jq -r --arg a "$agent" '.paths[$a] // empty' "$CONFIG" | sed "s|^~|$HOME|"
}

# Get all agent names
all_agents() {
  jq -r '.paths | keys[]' "$CONFIG"
}

# Process each skill
while IFS='|' read -r skill agents_raw; do
  # Determine target agents
  if [[ "$agents_raw" == "all" ]]; then
    IFS=$'\n' read -d '' -ra targets < <(all_agents) || true
  else
    IFS=',' read -ra targets <<< "$agents_raw"
  fi

  skill_src="$REPO_DIR/skills/$skill"
  if [[ ! -d "$skill_src" ]]; then
    log "WARN: skill directory $skill_src does not exist"
    ((WARNED++)) || true
    continue
  fi

  for agent in "${targets[@]}"; do
    agent="${agent## }"; agent="${agent%% }"  # trim whitespace
    dest_dir="$(agent_path "$agent")"
    if [[ -z "$dest_dir" ]]; then
      log "WARN: no path configured for agent '$agent'"
      ((WARNED++)) || true
      continue
    fi

    dest="$dest_dir/$skill"

    # Already correct symlink
    if [[ -L "$dest" ]]; then
      existing=$(readlink "$dest")
      if [[ "$existing" == "$skill_src" ]]; then
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

    # Create symlink
    if $DRY_RUN; then
      echo "  [dry-run] ln -s $skill_src → $dest"
    else
      mkdir -p "$dest_dir"
      ln -s "$skill_src" "$dest"
      log "CREATED: $dest → $skill_src"
    fi
    ((CREATED++)) || true
  done
done < <(jq -r '
  .skills | to_entries[] |
  if (.value.agents | type) == "array" then
    "\(.key)|\(.value.agents | join(","))"
  else
    "\(.key)|\(.value.agents)"
  end
' "$CONFIG")

echo "Skills: $CREATED synced, $SKIPPED skipped, $WARNED warnings"

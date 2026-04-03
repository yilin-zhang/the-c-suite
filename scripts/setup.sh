#!/usr/bin/env bash
# Bootstrap the-c-suite: sync skills, plugins, and OpenCode plugins.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

PASSTHROUGH_ARGS=()
SKILLS=true
PLUGINS=true
OC=true

for arg in "$@"; do
  case "$arg" in
    --skills-only)  PLUGINS=false; OC=false ;;
    --plugins-only) SKILLS=false; OC=false ;;
    --oc-only)      SKILLS=false; PLUGINS=false ;;
    --dry-run|--verbose) PASSTHROUGH_ARGS+=("$arg") ;;
    --help|-h)
      echo "Usage: setup.sh [--dry-run] [--verbose] [--skills-only] [--plugins-only] [--oc-only]"
      exit 0
      ;;
  esac
done

echo "the-c-suite setup"
echo "=================="
echo ""

step=0
total=0
$SKILLS  && ((total++))
$PLUGINS && ((total++))
$OC      && ((total++))

if $SKILLS; then
  ((step++))
  echo "Step $step/$total: Syncing skills..."
  bash "$SCRIPT_DIR/sync-skills.sh" "${PASSTHROUGH_ARGS[@]+"${PASSTHROUGH_ARGS[@]}"}"
  echo ""
fi

if $PLUGINS; then
  ((step++))
  echo "Step $step/$total: Syncing Claude Code plugins..."
  bash "$SCRIPT_DIR/sync-plugins.sh" "${PASSTHROUGH_ARGS[@]+"${PASSTHROUGH_ARGS[@]}"}"
  echo ""
fi

if $OC; then
  ((step++))
  echo "Step $step/$total: Syncing OpenCode plugins..."
  bash "$SCRIPT_DIR/sync-oc-plugins.sh" "${PASSTHROUGH_ARGS[@]+"${PASSTHROUGH_ARGS[@]}"}"
  echo ""
fi

echo "Done!"

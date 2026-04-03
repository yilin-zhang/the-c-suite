#!/usr/bin/env bash
# Usage: notify.sh <event> <project_dir>
# Events: stop, subagent_stop, plan_ready, question, permission

set -euo pipefail

EVENT="${1:-}"
PROJECT="${2:-}"
TITLE="Claude Code${PROJECT:+ — $(basename "$PROJECT")}"

# Load config: user config takes priority, falls back to plugin defaults
PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${HOME}/.claude/macnotify/sounds.sh"
[ -f "$CONFIG" ] || CONFIG="${PLUGIN_DIR}/config/sounds.sh"

SOUND_STOP="Glass"
SOUND_SUBAGENT_STOP="Purr"
SOUND_PLAN_READY="Hero"
SOUND_QUESTION="Ping"
SOUND_PERMISSION="Frog"

# shellcheck source=/dev/null
[ -f "$CONFIG" ] && source "$CONFIG"

notify() {
  local message="$1" sound="$2"
  # Escape double quotes for AppleScript string literals
  local safe_msg="${message//\"/\\\"}"
  local safe_title="${TITLE//\"/\\\"}"
  if [ -n "$sound" ]; then
    local safe_sound="${sound//\"/\\\"}"
    osascript -e "display notification \"${safe_msg}\" with title \"${safe_title}\" sound name \"${safe_sound}\""
  else
    osascript -e "display notification \"${safe_msg}\" with title \"${safe_title}\""
  fi
}

case "$EVENT" in
  stop)            notify "✅ Task complete"        "$SOUND_STOP" ;;
  subagent_stop)   notify "🤖 Agent complete"       "$SOUND_SUBAGENT_STOP" ;;
  plan_ready)      notify "📋 Plan ready for review" "$SOUND_PLAN_READY" ;;
  question)        notify "❓ Claude needs your input" "$SOUND_QUESTION" ;;
  permission)      notify "🔔 Permission requested"  "$SOUND_PERMISSION" ;;
  *)               echo "Unknown event: $EVENT" >&2; exit 1 ;;
esac

#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
exec emacs --batch -l "$DIR/elisp-nav.el" -- "$@"

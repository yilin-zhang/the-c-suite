#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LISP_FILE="${SKILL_DIR}/lisp/package-audit.el"

if [[ $# -lt 1 ]]; then
  echo "usage: $0 PACKAGE [PACKAGE ...]" >&2
  exit 1
fi

LISP_LIST="'("
for pkg in "$@"; do
  LISP_LIST+="${pkg} "
done
LISP_LIST+=")"

read -r -d '' ELISP <<EOF || true
(progn
  (load-file "${LISP_FILE}")
  (prin1
   (elisp-pkg-audit-upgrade-archive-packages
    ${LISP_LIST})))
EOF

emacsclient --eval "${ELISP}"

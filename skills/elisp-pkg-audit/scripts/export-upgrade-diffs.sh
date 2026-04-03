#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LISP_FILE="${SKILL_DIR}/lisp/package-audit.el"

if [[ $# -lt 1 ]]; then
  echo "usage: $0 OUTPUT_DIR [PACKAGE ...]" >&2
  exit 1
fi

OUTPUT_DIR="$1"
shift
PACKAGES=("$@")

LISP_LIST="nil"
if [[ ${#PACKAGES[@]} -gt 0 ]]; then
  LISP_LIST="'("
  for pkg in "${PACKAGES[@]}"; do
    LISP_LIST+="${pkg} "
  done
  LISP_LIST+=")"
fi

read -r -d '' ELISP <<EOF || true
(progn
  (load-file "${LISP_FILE}")
  (prin1
   (elisp-pkg-audit-export-diffs
    "${OUTPUT_DIR}"
    ${LISP_LIST})))
EOF

emacsclient --eval "${ELISP}"
printf 'summary: %s\n' "${OUTPUT_DIR}/summary.json"

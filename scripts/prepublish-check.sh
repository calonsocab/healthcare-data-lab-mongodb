#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== Git status =="
git status --porcelain=v1 || true
echo

echo "== Tracked sensitive files check =="
bad_tracked="$(git ls-files | rg -n '(^|/)(\\.env(\\.|$)|\\.env\\.|\\.env$)|(^|/)\\.drone\\.yml$|(^|/)environments/.*\\.ya?ml$|(^|/)\\.kehrnel_registry\\.json$' || true)"
if [[ -n "${bad_tracked}" ]]; then
  echo "Found tracked files that should not be published:"
  echo "${bad_tracked}"
  echo
  echo "Fix: remove them from the repo (or rename to *.example) before publishing."
  exit 2
fi
echo "OK"
echo

echo "== Basic secret pattern scan (best-effort) =="
# Keep this intentionally conservative to avoid false positives.
rg -n "BEGIN (RSA|OPENSSH) PRIVATE KEY|AKIA[0-9A-Z]{16}|xox[baprs]-|ghp_[A-Za-z0-9]{36}|AIza[0-9A-Za-z\\-_]{35}|mongodb\\+srv://[^\\s]+:[^\\s]+@|NEXTAUTH_SECRET\\s*=|GOOGLE_CLIENT_SECRET\\s*=|OPENAI_API_KEY\\s*=" \
  -S . --hidden --glob '!**/.git/**' --glob '!**/node_modules/**' --glob '!**/.next/**' || true
echo

echo "== High-risk primitives scan =="
rg -n "dangerouslySetInnerHTML|eval\\(|new Function\\(|child_process|exec\\(|spawn\\(" -S src || true
echo

echo "Done."


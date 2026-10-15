#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
scratch_root="$(mktemp -d /tmp/journeyproof-clean.XXXXXX)"
trap 'rm -rf "$scratch_root"' EXIT
for iteration in 1 2; do
  target_dir="$scratch_root/run-$iteration"
  git clone --quiet --no-hardlinks "$project_root" "$target_dir"
  cd "$target_dir"
  npm ci --no-audit --no-fund
  npm run build
  npm run test:e2e
done

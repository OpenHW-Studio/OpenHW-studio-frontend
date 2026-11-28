#!/usr/bin/env bash
# integrate-lanes.sh — merge the parallel coverage lanes into ONE integration
# branch, gate every merge, never touch md, never push.
#
# Usage:
#   ./scripts/integrate-lanes.sh                 # merge into lane/integration-2026-10-20
#   INTEGRATION=my-branch ./scripts/integrate-lanes.sh
#
# Rules it enforces:
#   * the target branch is NEVER md and never a remote branch (no push, ever)
#   * every merge is followed by `npm run build` + `npx vitest run`
#   * `public/version.json` (rewritten by every build) is reverted after each build
#   * a conflicted merge ABORTS the script and prints the conflicted files
#     (it never auto-resolves a matrix.md conflict for you — matrix.md is
#      the contract and a human decides which cell value wins)
#
# Lane order matters: the engine-bytes lane is the base (every lane is
# branched from it), then the coverage lanes (they own disjoint matrix rows),
# then the matrix lane last (it owns the global sections).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASE_BRANCH="${BASE_BRANCH:-lane/engine-bytes}"
INTEGRATION="${INTEGRATION:-lane/integration-2026-10-20}"
LANES=(
  lane/f1-cov2
  lane/f4-cov2
  lane/esp32-cov2
  lane/pico-cov2
  lane/matrix-complete
)

echo "== integration branch: $INTEGRATION (base: $BASE_BRANCH)"
git switch -C "$INTEGRATION" "$BASE_BRANCH"

gate () {
  echo "== gate: build"
  npm run build >/tmp/integrate-build.log 2>&1 || {
    echo "BUILD FAILED — see /tmp/integrate-build.log"; git checkout -- public/version.json 2>/dev/null || true
    exit 1; }
  git checkout -- public/version.json 2>/dev/null || true
  echo "== gate: vitest"
  TMPDIR="$PWD/.tmp-vitest" TEMP="$PWD/.tmp-vitest" TMP="$PWD/.tmp-vitest" \
    npx vitest run >/tmp/integrate-vitest.log 2>&1 || {
    echo "VITEST FAILED — see /tmp/integrate-vitest.log"; exit 1; }
  tail -4 /tmp/integrate-vitest.log
}

for lane in "${LANES[@]}"; do
  if ! git rev-parse --verify "$lane" >/dev/null 2>&1; then
    echo "-- skip $lane (branch not present)"; continue
  fi
  echo "== merge $lane"
  if ! git merge --no-ff -m "integrate: $lane" "$lane"; then
    echo "CONFLICT while merging $lane — conflicted files:"
    git diff --name-only --diff-filter=U
    echo
    echo "Resolve them by hand (matrix.md rows: the lane that owns a row wins;"
    echo "if both changed a cell, keep the value with the cell + serial evidence),"
    echo "then: git add <files> && git commit && ./scripts/integrate-lanes.sh"
    exit 2
  fi
  gate
done

echo
echo "== done: $INTEGRATION"
git log --oneline -15
echo
echo "Next (integrator's call, NOT done here):"
echo "  git switch md && git merge --ff-only $INTEGRATION && git push origin md"
echo "(push only when the owner says so)"

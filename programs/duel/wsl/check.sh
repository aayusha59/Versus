#!/bin/bash
# Host-side checks inside WSL: rustfmt, clippy and the unit tests (math + Pyth layout).
# Runs in the synced build dir (~/duel by default) and copies formatting fixes back to the repo.
#
# Usage (from Windows):  wsl -d Ubuntu -- bash -lc 'bash /mnt/c/.../programs/duel/wsl/check.sh'
set -euo pipefail

SRC="${DUEL_SRC:-$(cd "$(dirname "$0")/.." && pwd)}"
DST="${DUEL_BUILD_DIR:-$HOME/duel}"
cd "$DST"

cargo fmt --all
rsync -a "$DST/programs/duel/src/" "$SRC/programs/duel/src/"
cargo clippy -p duel --all-targets -- -D warnings
cargo test -p duel

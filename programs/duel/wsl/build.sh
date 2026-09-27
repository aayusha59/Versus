#!/bin/bash
# Build the program inside WSL on the native filesystem (building on /mnt/c is slow and
# hits file locks). Syncs programs/duel -> ~/duel, runs `anchor build` there, then copies
# target/idl, target/types and target/deploy back into the repo and the IDL into
# packages/sdk/idl.
#
# Usage (from Windows):  wsl -d Ubuntu -- bash -lc 'bash /mnt/c/.../programs/duel/wsl/build.sh'
# Extra args are passed to `anchor build` (e.g. `-- --features foo`).
set -euo pipefail

SRC="${DUEL_SRC:-$(cd "$(dirname "$0")/.." && pwd)}"
DST="${DUEL_BUILD_DIR:-$HOME/duel}"
REPO="$(cd "$SRC/../.." && pwd)"

mkdir -p "$DST" "$DST/target/deploy"
rsync -a --delete \
  --exclude target --exclude node_modules --exclude .anchor \
  --exclude test-ledger --exclude .keys \
  "$SRC/" "$DST/"

# Keep the program keypair stable so the id matches declare_id!.
if [ -f "$SRC/target/deploy/duel-keypair.json" ]; then
  cp "$SRC/target/deploy/duel-keypair.json" "$DST/target/deploy/duel-keypair.json"
elif [ -f "$HOME/duel-keys/duel-keypair.json" ]; then
  cp "$HOME/duel-keys/duel-keypair.json" "$DST/target/deploy/duel-keypair.json"
fi

cd "$DST"
bash wsl/fix-lock.sh
anchor build "$@"

echo "program id: $(solana-keygen pubkey target/deploy/duel-keypair.json)"

mkdir -p "$SRC/target/idl" "$SRC/target/types" "$SRC/target/deploy" "$REPO/packages/sdk/idl"
cp target/idl/duel.json "$SRC/target/idl/duel.json"
cp target/types/duel.ts "$SRC/target/types/duel.ts"
cp target/deploy/duel.so "$SRC/target/deploy/duel.so"
cp target/deploy/duel-keypair.json "$SRC/target/deploy/duel-keypair.json"
cp target/idl/duel.json "$REPO/packages/sdk/idl/duel.json"
cp target/types/duel.ts "$REPO/packages/sdk/idl/duel.ts"
cp Cargo.lock "$SRC/Cargo.lock"
echo "artifacts copied to $SRC/target and $REPO/packages/sdk/idl"

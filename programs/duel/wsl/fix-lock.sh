#!/bin/bash
# Make Cargo.lock parseable by the platform-tools cargo (1.84) that cargo-build-sbf uses.
#
# The host cargo (1.92) resolves the lockfile MSRV-aware (see .cargo/config.toml), but crates
# that use edition 2024 without declaring `rust-version` still slip through. This loop asks the
# platform-tools cargo to read the metadata, and every time it trips over such a crate pins it to
# the newest non-edition-2024 version listed by crates.io.
#
# Usage: bash wsl/fix-lock.sh   (run inside the workspace dir, e.g. ~/duel)
set -euo pipefail

PT_CARGO="${PT_CARGO:-$(ls -d "$HOME"/.cache/solana/*/platform-tools/rust/bin/cargo | sort -V | tail -1)}"
echo "platform-tools cargo: $PT_CARGO ($("$PT_CARGO" --version))"

[ -f Cargo.lock ] || cargo generate-lockfile

for _ in $(seq 1 40); do
  set +e
  err=$("$PT_CARGO" metadata --format-version 1 2>&1 >/dev/null)
  rc=$?
  set -e
  if [ $rc -eq 0 ]; then
    echo "Cargo.lock is compatible with platform-tools cargo"
    exit 0
  fi
  crate_dir=$(echo "$err" | sed -n 's/.*failed to parse manifest at `\(.*\)\/Cargo.toml`.*/\1/p' | head -1)
  if [ -z "$crate_dir" ]; then
    echo "$err" | head -20
    echo "fix-lock: unrecognized error from platform-tools cargo" >&2
    exit 1
  fi
  base=$(basename "$crate_dir")
  name=${base%-*}
  ver=${base##*-}
  echo "incompatible: $name@$ver"
  candidate=$(curl -sf "https://crates.io/api/v1/crates/$name/versions" -A "duel-build (fix-lock.sh)" |
    jq -r '.versions[] | select(.yanked == false and .edition != "2024" and (.num | test("-") | not)) | .num' |
    sort -V | tail -1)
  if [ -z "$candidate" ]; then
    echo "fix-lock: no pre-2024-edition version of $name found" >&2
    exit 1
  fi
  echo "  pinning $name $ver -> $candidate"
  cargo update -p "$name@$ver" --precise "$candidate"
done
echo "fix-lock: too many iterations" >&2
exit 1

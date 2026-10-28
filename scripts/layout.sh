#!/usr/bin/env bash
# Usage: scripts/layout.sh <Contract> [out.json]
# Writes the storage layout of <Contract> from the current Foundry project.
set -euo pipefail
if [ $# -lt 1 ]; then echo "usage: $0 <Contract> [out.json]" >&2; exit 2; fi
out="${2:-$1.layout.json}"
forge inspect "$1" storageLayout --json > "$out"
echo "wrote $out"

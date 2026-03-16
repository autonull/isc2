#!/bin/bash
# ISC Extended Verification Script Wrapper
# Runs comprehensive readiness tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Run extended verification
./node_modules/.pnpm/node_modules/.bin/tsx scripts/verify-extended.ts "$@"

#!/bin/bash
# ISC System Verification Script Wrapper
# Runs the TypeScript verification script using tsx

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Run tsx with the verification script
./node_modules/.pnpm/node_modules/.bin/tsx scripts/verify-system.ts "$@"

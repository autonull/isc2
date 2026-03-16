#!/bin/bash
# ISC Reality Check - Automated Functional Verification
# Runs Playwright tests against the actual running app

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "              ISC REALITY CHECK"
echo "═══════════════════════════════════════════════════════════"
echo "  This tests ACTUAL functionality, not just builds"
echo ""

# First ensure browser is built
echo "Building browser app..."
pnpm --filter @isc/apps/browser build > /dev/null 2>&1

# Ensure CLI is built
echo "Building CLI..."
pnpm --filter @isc/apps/cli build > /dev/null 2>&1

# Ensure TUI is built
echo "Building TUI..."
pnpm --filter @isc/apps/tui build > /dev/null 2>&1

echo ""
echo "Running reality check tests..."
echo ""

# Run the playwright tests
pnpm exec playwright test tests/e2e/reality-check.spec.ts --reporter=list

#!/usr/bin/env bash

# Kill any stray turbo/node processes from this project
# Run this if you encounter hanging processes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="isc2"

echo "Cleaning up stray processes for $PROJECT_NAME..."

# Find and kill processes related to this project
pkill -f "turbo.*$PROJECT_NAME" 2>/dev/null && echo "✓ Killed turbo processes" || true
pkill -f "vite.*$PROJECT_NAME" 2>/dev/null && echo "✓ Killed vite processes" || true
pkill -f "node.*$PROJECT_NAME.*dev" 2>/dev/null && echo "✓ Killed dev processes" || true

# Clean up temp directories
rm -rf "$SCRIPT_DIR"/demo-* 2>/dev/null && echo "✓ Cleaned demo directories" || true
rm -rf "$SCRIPT_DIR"/test-swarm-* 2>/dev/null && echo "✓ Cleaned swarm test directories" || true
rm -rf "$SCRIPT_DIR"/test-debug* 2>/dev/null && echo "✓ Cleaned debug directories" || true

# Clean turbo cache
rm -rf "$SCRIPT_DIR"/.turbo 2>/dev/null && echo "✓ Cleaned turbo cache" || true

echo "Cleanup complete!"

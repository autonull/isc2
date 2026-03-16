#!/bin/bash
# ISC Protocol Verification
# Tests the ESSENTIALS: DHT, Discovery, Posts, Channels, Persistence

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

node scripts/verify-protocol.js "$@"

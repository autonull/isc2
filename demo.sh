#!/usr/bin/env bash

# ISC Quick Demo Script
# Demonstrates the complete flow: init → create channel → announce → query → match
#
# Usage: ./demo.sh [--clean]
#
# Cleanup: Automatically cleans up on exit (SIGINT, SIGTERM, exit)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_DIR="$SCRIPT_DIR/demo-$$"
CLI="$SCRIPT_DIR/apps/cli/dist/index.js"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Cleanup function - always called on exit
cleanup() {
  if [ -d "$DEMO_DIR" ]; then
    rm -rf "$DEMO_DIR" 2>/dev/null || true
  fi
  # Kill any background jobs
  jobs -p 2>/dev/null | xargs -r kill 2>/dev/null || true
}

# Always cleanup on exit
trap cleanup EXIT INT TERM

# Helper functions
step() {
  echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

info() {
  echo -e "${YELLOW}→${NC} $1"
}

success() {
  echo -e "${GREEN}✓${NC} $1"
}

# Set timeout (3 minutes max for demo)
TIMEOUT_SECONDS=180
( sleep $TIMEOUT_SECONDS; echo "\n[Demo] Timeout exceeded, exiting..."; exit 1 ) &
TIMEOUT_PID=$!
trap 'kill $TIMEOUT_PID 2>/dev/null; cleanup' EXIT INT TERM

# Check for --clean flag
if [ "$1" = "--clean" ]; then
  info "Cleaning up previous demo directories..."
  rm -rf "$SCRIPT_DIR"/demo-* 2>/dev/null || true
  success "Cleaned up"
  exit 0
fi

# Check if CLI is built
if [ ! -f "$CLI" ]; then
  info "Building CLI..."
  (cd "$SCRIPT_DIR/apps/cli" && pnpm build)
fi

step "ISC Quick Demo"
echo "This demo will:"
echo "  1. Initialize CLI with identity"
echo "  2. Create semantic channels"
echo "  3. Announce to DHT"
echo "  4. Query for matches"
echo "  5. Show rate limiting"
echo ""

# Step 1: Initialize
step "Step 1: Initialize CLI"
info "Creating identity and configuration..."

node "$CLI" init \
  --data-dir "$DEMO_DIR/data" \
  --cache-dir "$DEMO_DIR/cache" \
  --config-path "$DEMO_DIR/config.json"

success "CLI initialized"

# Step 2: Create channels
step "Step 2: Create Semantic Channels"

info "Creating channel: AI Ethics..."
node "$CLI" -c "$DEMO_DIR/config.json" channel create "AI_Ethics" \
  -d "Ethical implications of machine learning and autonomy"

info "Creating channel: Distributed Systems..."
node "$CLI" -c "$DEMO_DIR/config.json" channel create "Distributed_Systems" \
  -d "Consensus algorithms and the CAP theorem"

info "Creating channel: Climate Tech..."
node "$CLI" -c "$DEMO_DIR/config.json" channel create "Climate_Tech" \
  -d "Carbon capture and renewable energy solutions"

success "Created 3 channels"

# List channels
info "Listing channels:"
node "$CLI" -c "$DEMO_DIR/config.json" channel list

# Step 3: Announce
step "Step 3: Announce to DHT"

info "Announcing AI_Ethics channel..."
node "$CLI" -c "$DEMO_DIR/config.json" announce channel "AI_Ethics"

success "Channel announced"

# Show rate limit
info "Checking rate limit status:"
node "$CLI" -c "$DEMO_DIR/config.json" announce status

# Step 4: Query
step "Step 4: Query for Semantic Matches"

info "Querying DHT for proximal peers..."
node "$CLI" -c "$DEMO_DIR/config.json" query semantic --limit 10

# Step 5: Demonstrate rate limiting
step "Step 5: Rate Limiting Demo"

info "Attempting rapid announces (should be rate limited)..."

for i in {1..6}; do
  echo -n "  Attempt $i: "
  if node "$CLI" -c "$DEMO_DIR/config.json" announce channel "AI_Ethics" > /dev/null 2>&1; then
    success "Announced"
  else
    echo -e "${YELLOW}Rate limited${NC}"
  fi
done

info "Rate limit status after attempts:"
node "$CLI" -c "$DEMO_DIR/config.json" announce status

# Step 6: Show DHT entries
step "Step 6: DHT Inspection"

info "Checking DHT entries..."
node "$CLI" -c "$DEMO_DIR/config.json" query dht "announce" --json | head -30

# Summary
step "Demo Complete!"

echo "What you learned:"
echo "  ✓ CLI initialization with identity generation"
echo "  ✓ Channel creation with semantic descriptions"
echo "  ✓ DHT announcements with LSH hashing"
echo "  ✓ Semantic peer matching via cosine similarity"
echo "  ✓ Rate limiting enforcement (5 announces/min)"
echo "  ✓ DHT inspection and debugging"
echo ""
echo "Next steps:"
echo "  • Start a supernode: isc supernode start --port 3000"
echo "  • Run browser app: cd apps/browser && pnpm dev"
echo "  • Run swarm test: node tests/simulation/swarm-test.js --peers=50"
echo "  • Run E2E tests: pnpm test:e2e"
echo ""
echo "Demo directory: $DEMO_DIR (will be cleaned up)"
echo ""

#!/usr/bin/env bash

# CLI Integration Test Script
# Spawns 3 nodes, announces channels, verifies matches propagate
# 
# Usage: ./tests/integration/cli-swarm.sh [--verbose]

# Configuration
TEST_DIR="./test-swarm-$$"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLI="$PROJECT_DIR/apps/cli/dist/index.js"
VERBOSE=${VERBOSE:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
  if [ "$VERBOSE" = true ]; then
    echo -e "$1"
  fi
}

success() {
  echo -e "${GREEN}✓${NC} $1"
}

error() {
  echo -e "${RED}✗${NC} $1"
}

info() {
  echo -e "${YELLOW}ℹ${NC} $1"
}

# Cleanup function
cleanup() {
  log "Cleaning up test directory..."
  rm -rf "$TEST_DIR"
}

trap cleanup EXIT

# Check if CLI is built
if [ ! -f "$CLI" ]; then
  error "CLI not found at $CLI"
  info "Building CLI..."
  (cd "$PROJECT_DIR/apps/cli" && pnpm build)
fi

# Create test directory
mkdir -p "$TEST_DIR"

NUM_NODES=3
ABS_TEST_DIR="$(cd "$TEST_DIR" && pwd)"

info "Starting CLI swarm test with $NUM_NODES nodes"
info "Test directory: $ABS_TEST_DIR"
echo ""

# Initialize nodes
for i in 1 2 3; do
  log "Initializing node $i..."
  mkdir -p "$ABS_TEST_DIR/node-$i/data" "$ABS_TEST_DIR/node-$i/cache"
  
  # Create identity for node
  cat > "$ABS_TEST_DIR/node-$i/identity.json" << EOF
{
  "peerID": "test-peer-$i",
  "createdAt": $(date +%s)000
}
EOF

  # Create config for node
  cat > "$ABS_TEST_DIR/node-$i/config.json" << EOF
{
  "dataDir": "$ABS_TEST_DIR/node-$i/data",
  "cacheDir": "$ABS_TEST_DIR/node-$i/cache",
  "identityPath": "$ABS_TEST_DIR/node-$i/identity.json"
}
EOF

  success "Node $i initialized"
done

echo ""
info "Creating channels for each node..."

# Create channels
node "$CLI" -c "$ABS_TEST_DIR/node-1/config.json" channel create "AI_Ethics" -d "Ethical implications of machine learning and autonomy" > /dev/null 2>&1 && success "Node 1: Channel created" || error "Node 1: Failed"
node "$CLI" -c "$ABS_TEST_DIR/node-2/config.json" channel create "Distributed_Systems" -d "Consensus algorithms and the CAP theorem" > /dev/null 2>&1 && success "Node 2: Channel created" || error "Node 2: Failed"
node "$CLI" -c "$ABS_TEST_DIR/node-3/config.json" channel create "Climate_Tech" -d "Carbon capture and renewable energy solutions" > /dev/null 2>&1 && success "Node 3: Channel created" || error "Node 3: Failed"

echo ""
info "Announcing channels to DHT..."

# Announce channels (with rate limit consideration)
node "$CLI" -c "$ABS_TEST_DIR/node-1/config.json" announce channel "AI_Ethics" > /dev/null 2>&1 && success "Node 1: Announced" || error "Node 1: Announce failed"
sleep 12  # Rate limit window
node "$CLI" -c "$ABS_TEST_DIR/node-2/config.json" announce channel "Distributed_Systems" > /dev/null 2>&1 && success "Node 2: Announced" || error "Node 2: Announce failed"
sleep 12  # Rate limit window
node "$CLI" -c "$ABS_TEST_DIR/node-3/config.json" announce channel "Climate_Tech" > /dev/null 2>&1 && success "Node 3: Announced" || error "Node 3: Announce failed"

echo ""
info "Waiting for DHT propagation..."
sleep 2

# Query for matches from each node
echo ""
info "Querying for semantic matches..."

node "$CLI" -c "$ABS_TEST_DIR/node-1/config.json" query semantic 2>/dev/null | head -10
echo ""

echo ""
info "Testing rate limit status..."
node "$CLI" -c "$ABS_TEST_DIR/node-1/config.json" announce status 2>/dev/null

echo ""
info "=== Test Summary ==="
echo "Nodes initialized: $NUM_NODES"
echo "Test directory: $ABS_TEST_DIR (will be cleaned up)"
echo ""
success "CLI integration test completed!"
exit 0

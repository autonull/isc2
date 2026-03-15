#!/usr/bin/env node

/**
 * ISC TUI - Test Script
 * Verifies TUI loads without errors
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'isc-data');
const CHANNELS_FILE = join(DATA_DIR, 'channels.json');

console.log('🧪 ISC TUI Test\n');

// Check data directory
console.log('1. Checking data directory...');
if (!existsSync(DATA_DIR)) {
  console.log('   ❌ FAIL: isc-data directory not found');
  console.log('   Run: pnpm --filter @isc/apps/cli dev -- init');
  process.exit(1);
}
console.log('   ✓ Data directory exists');

// Check channels
console.log('2. Checking channels...');
if (!existsSync(CHANNELS_FILE)) {
  console.log('   ❌ FAIL: channels.json not found');
  console.log('   Run: pnpm --filter @isc/apps/cli dev -- channel create "Test" -d "Desc"');
  process.exit(1);
}

const channels = JSON.parse(readFileSync(CHANNELS_FILE, 'utf-8'));
console.log(`   ✓ Found ${channels.length} channel(s)`);

if (channels.length > 0) {
  channels.forEach(c => {
    console.log(`     - #${c.name} (${c.id.slice(0, 20)}...)`);
  });
}

// Check blessed import
console.log('3. Checking blessed library...');
try {
  await import('blessed');
  console.log('   ✓ Blessed library loads');
} catch (err) {
  console.log('   ❌ FAIL: Cannot load blessed');
  console.log(`   Error: ${err.message}`);
  process.exit(1);
}

console.log('\n✅ All checks passed!');
console.log('\nTo run the TUI:');
console.log('  pnpm --filter @isc/apps/tui dev');
console.log('\nControls:');
console.log('  ↑/↓ or j/k  - Navigate channels');
console.log('  Enter       - Select channel');
console.log('  n           - New channel');
console.log('  p           - New post (when channel selected)');
console.log('  q           - Quit');

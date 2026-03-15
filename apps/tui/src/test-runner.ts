import { TUI } from './index.js';

async function main() {
  const numPeers = parseInt(process.argv[2] || '2');

  if (isNaN(numPeers) || numPeers < 2 || numPeers > 10) {
    console.error('Usage: tsx test-runner.ts [num_peers (2-10)]');
    process.exit(1);
  }

  const tui = new TUI(numPeers);

  // Setup UI input callbacks
  for (let i = 0; i < numPeers; i++) {
    tui.onInput(i, (text) => {
      tui.logMessage(i, `[You]: ${text}`);
    });
  }

  tui.render();

  try {
    await tui.initNetwork();
  } catch (err) {
    tui.logMessage(0, `Network error: ${err}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

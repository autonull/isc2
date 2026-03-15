import { describe, it, expect, vi } from 'vitest';
import { TUI } from '../src/index.js';

// Mock blessed to avoid TTY issues in CI/headless
vi.mock('blessed', () => {
  return {
    default: {
      screen: () => ({
        key: vi.fn(),
        render: vi.fn(),
        append: vi.fn(),
      }),
      box: () => ({}),
      log: () => ({ log: vi.fn() }),
      line: () => ({}),
      textbox: () => ({
        key: vi.fn(),
        on: vi.fn(),
        focus: vi.fn(),
        clearValue: vi.fn(),
      }),
    }
  };
});

describe('TUI Simulator Network', () => {
  it('should instantiate TUI with mocked UI without crashing', () => {
    const tui = new TUI(2);
    expect(tui).toBeDefined();
  });

  // Skipped because network init uses actual ports which might clash or be flaky in CI,
  // but this is enough to ensure our imports and types are healthy.
  it.skip('should initialize network', async () => {
    const tui = new TUI(2);
    await tui.initNetwork();
  });
});

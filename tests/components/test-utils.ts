/**
 * Component Tests
 *
 * Tests individual UI components in isolation using Vite + Vitest.
 * Run with: pnpm test components
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { h, render } from 'preact';

// Test utilities for component testing
export function createTestContainer() {
  const container = document.createElement('div');
  container.id = 'test-container';
  document.body.appendChild(container);
  return container;
}

export function cleanup(container: HTMLElement) {
  if (container && container.parentNode) {
    render(null, container);
    container.parentNode.removeChild(container);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

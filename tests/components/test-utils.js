/**
 * Component Tests
 *
 * Tests individual UI components in isolation using Vite + Vitest.
 * Run with: pnpm test components
 */
import { render } from 'preact';
// Test utilities for component testing
export function createTestContainer() {
    const container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
    return container;
}
export function cleanup(container) {
    if (container && container.parentNode) {
        render(null, container);
        container.parentNode.removeChild(container);
    }
}
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=test-utils.js.map
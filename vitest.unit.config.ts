import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/core/src/**/*.{ts,tsx}', 'apps/browser/src/**/*.{ts,tsx}'],
      exclude: ['**/*.d.ts', '**/*.test.ts', '**/node_modules/**'],
    },
  },
});

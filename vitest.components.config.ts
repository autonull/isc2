import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/components/setup.ts'],
    include: ['tests/components/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['apps/browser/src/components/**/*.{ts,tsx}'],
    },
  },
  plugins: [preact()],
});

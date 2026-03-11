import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@isc/core': '../../packages/core/dist',
      '@isc/adapters': '../../packages/adapters/dist',
      '@isc/protocol': '../../packages/protocol/dist',
    },
  },
});

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
      '@isc/core': resolve(__dirname, '../../packages/core/src'),
      '@isc/core/crypto': resolve(__dirname, '../../packages/core/src/crypto'),
      '@isc/core/math': resolve(__dirname, '../../packages/core/src/math'),
      '@isc/core/encoding': resolve(__dirname, '../../packages/core/src/encoding'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
});

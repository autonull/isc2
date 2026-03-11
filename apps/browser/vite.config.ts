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
      '@isc/core/crypto': resolve(__dirname, '../../packages/core/src/crypto/index.js'),
      '@isc/core/math': resolve(__dirname, '../../packages/core/src/math/index.js'),
      '@isc/core/math/lsh': resolve(__dirname, '../../packages/core/src/math/lsh.js'),
      '@isc/core/encoding': resolve(__dirname, '../../packages/core/src/encoding.js'),
      '@isc/core/types': resolve(__dirname, '../../packages/core/src/types.js'),
      '@isc/core/semantic': resolve(__dirname, '../../packages/core/src/semantic/index.js'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
});

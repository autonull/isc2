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
      '@isc/core': resolve(__dirname, '../../packages/core/dist'),
      '@isc/core/crypto': resolve(__dirname, '../../packages/core/dist/crypto/index.js'),
      '@isc/core/math': resolve(__dirname, '../../packages/core/dist/math/index.js'),
      '@isc/core/math/lsh': resolve(__dirname, '../../packages/core/dist/math/lsh.js'),
      '@isc/core/encoding': resolve(__dirname, '../../packages/core/dist/encoding.js'),
      '@isc/core/types': resolve(__dirname, '../../packages/core/dist/types.js'),
      '@isc/core/semantic': resolve(__dirname, '../../packages/core/dist/semantic/index.js'),
      '@isc/adapters': resolve(__dirname, '../../packages/adapters/dist'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
});

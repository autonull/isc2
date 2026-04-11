import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 3001,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@isc/apps/browser': resolve(__dirname, '../browser/src'),
    },
  },
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm']
  }
});

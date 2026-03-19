import { defineConfig } from 'vite';
import { resolve } from 'path';
import { VitePWA } from 'vite-plugin-pwa';
import preact from '@preact/preset-vite';

export default defineConfig({
  server: {
    port: 3000,
    headers: {
      // Content Security Policy for XSS protection
      'Content-Security-Policy': `
        default-src 'self';
        script-src 'self' 'unsafe-inline' blob:;
        style-src 'self' 'unsafe-inline';
        img-src 'self' data: blob:;
        font-src 'self' data:;
        connect-src 'self' blob: wss: ws: https:;
        worker-src 'self' blob:;
        child-src 'self' blob:;
        object-src 'none';
        base-uri 'self';
        form-action 'self';
        frame-ancestors 'none';
      `.replace(/\s+/g, ' ').trim(),
    },
  },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      // Disable injectManifest which can conflict with custom workers
      injectRegister: null,
      strategies: 'generateSW',
      manifest: {
        name: 'ISC - Internet Semantic Chat',
        short_name: 'ISC',
        description: 'Decentralized P2P social platform with semantic matching',
        theme_color: '#1da1f2',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Don't cache worker files
        ignoreURLParametersMatching: [],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'esnext',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'shared-worker': resolve(__dirname, 'src/shared-workers/shared-worker.ts'),
        'service-worker': resolve(__dirname, 'src/shared-workers/service-worker.ts'),
      },
      external: ['@xenova/transformers', 'onnxruntime-web'],
      output: {
        // Configure worker output format
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
    // Configure worker build separately
    worker: {
      format: 'es',
    },
  },
  optimizeDeps: {
    exclude: ['@xenova/transformers', 'onnxruntime-web'],
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
      '@isc/navigation': resolve(__dirname, '../../packages/navigation/dist'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
});

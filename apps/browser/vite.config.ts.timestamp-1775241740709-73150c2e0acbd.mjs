// vite.config.ts
import { defineConfig } from "file:///home/me/isc2/node_modules/.pnpm/vite@5.4.21_@types+node@20.19.37/node_modules/vite/dist/node/index.js";
import { resolve } from "path";
import { VitePWA } from "file:///home/me/isc2/node_modules/.pnpm/vite-plugin-pwa@1.2.0_vite@5.4.21_workbox-build@7.4.0_workbox-window@7.4.0/node_modules/vite-plugin-pwa/dist/index.js";
import preact from "file:///home/me/isc2/node_modules/.pnpm/@preact+preset-vite@2.10.3_@babel+core@7.29.0_preact@10.29.0_vite@7.3.1/node_modules/@preact/preset-vite/dist/esm/index.mjs";
var __vite_injected_original_dirname = "/home/me/isc2/apps/browser";
var vite_config_default = defineConfig({
  server: {
    port: 3e3,
    sourcemapIgnoreList: (source) => source.includes("node_modules"),
    headers: {
      // Content Security Policy for XSS protection
      "Content-Security-Policy": `
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
      `.replace(/\s+/g, " ").trim()
    }
  },
  plugins: [
    preact(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/*.png", "icons/*.svg"],
      // Disable injectManifest which can conflict with custom workers
      injectRegister: null,
      strategies: "generateSW",
      manifest: {
        name: "ISC - Internet Semantic Chat",
        short_name: "ISC",
        description: "Decentralized P2P social platform with semantic matching",
        theme_color: "#1da1f2",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Don't cache worker files
        ignoreURLParametersMatching: [],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
                // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30
                // 30 days
              }
            }
          },
          {
            urlPattern: /^https:\/\/api\./i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24
                // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    target: "esnext",
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__vite_injected_original_dirname, "index.html"),
        "shared-worker": resolve(__vite_injected_original_dirname, "src/shared-workers/shared-worker.ts"),
        "service-worker": resolve(__vite_injected_original_dirname, "src/shared-workers/service-worker.ts")
      },
      external: ["@xenova/transformers", "onnxruntime-web"],
      output: {
        // Configure worker output format
        entryFileNames: "assets/[name]-[hash].js"
      }
    },
    // Configure worker build separately
    worker: {
      format: "es"
    }
  },
  optimizeDeps: {
    exclude: ["@xenova/transformers", "onnxruntime-web"]
  },
  resolve: {
    alias: {
      react: "preact/compat",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
      "@isc/core": resolve(__vite_injected_original_dirname, "../../packages/core/src"),
      "@isc/core/crypto": resolve(__vite_injected_original_dirname, "../../packages/core/src/crypto/index.ts"),
      "@isc/core/math": resolve(__vite_injected_original_dirname, "../../packages/core/src/math/index.ts"),
      "@isc/core/math/lsh": resolve(__vite_injected_original_dirname, "../../packages/core/src/math/lsh.ts"),
      "@isc/core/encoding": resolve(__vite_injected_original_dirname, "../../packages/core/src/encoding.ts"),
      "@isc/core/types": resolve(__vite_injected_original_dirname, "../../packages/core/src/types.ts"),
      "@isc/core/semantic": resolve(__vite_injected_original_dirname, "../../packages/core/src/semantic/index.ts"),
      "@isc/adapters": resolve(__vite_injected_original_dirname, "../../packages/adapters/src")
    }
  },
  test: {
    environment: "node",
    globals: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9tZS9pc2MyL2FwcHMvYnJvd3NlclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvbWUvaXNjMi9hcHBzL2Jyb3dzZXIvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvbWUvaXNjMi9hcHBzL2Jyb3dzZXIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnO1xuaW1wb3J0IHByZWFjdCBmcm9tICdAcHJlYWN0L3ByZXNldC12aXRlJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogMzAwMCxcbiAgICBzb3VyY2VtYXBJZ25vcmVMaXN0OiAoc291cmNlKSA9PiBzb3VyY2UuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcycpLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgIC8vIENvbnRlbnQgU2VjdXJpdHkgUG9saWN5IGZvciBYU1MgcHJvdGVjdGlvblxuICAgICAgJ0NvbnRlbnQtU2VjdXJpdHktUG9saWN5JzogYFxuICAgICAgICBkZWZhdWx0LXNyYyAnc2VsZic7XG4gICAgICAgIHNjcmlwdC1zcmMgJ3NlbGYnICd1bnNhZmUtaW5saW5lJyBibG9iOjtcbiAgICAgICAgc3R5bGUtc3JjICdzZWxmJyAndW5zYWZlLWlubGluZSc7XG4gICAgICAgIGltZy1zcmMgJ3NlbGYnIGRhdGE6IGJsb2I6O1xuICAgICAgICBmb250LXNyYyAnc2VsZicgZGF0YTo7XG4gICAgICAgIGNvbm5lY3Qtc3JjICdzZWxmJyBibG9iOiB3c3M6IHdzOiBodHRwczo7XG4gICAgICAgIHdvcmtlci1zcmMgJ3NlbGYnIGJsb2I6O1xuICAgICAgICBjaGlsZC1zcmMgJ3NlbGYnIGJsb2I6O1xuICAgICAgICBvYmplY3Qtc3JjICdub25lJztcbiAgICAgICAgYmFzZS11cmkgJ3NlbGYnO1xuICAgICAgICBmb3JtLWFjdGlvbiAnc2VsZic7XG4gICAgICAgIGZyYW1lLWFuY2VzdG9ycyAnbm9uZSc7XG4gICAgICBgLnJlcGxhY2UoL1xccysvZywgJyAnKS50cmltKCksXG4gICAgfSxcbiAgfSxcbiAgcGx1Z2luczogW1xuICAgIHByZWFjdCgpLFxuICAgIFZpdGVQV0Eoe1xuICAgICAgcmVnaXN0ZXJUeXBlOiAncHJvbXB0JyxcbiAgICAgIGluY2x1ZGVBc3NldHM6IFsnaWNvbnMvKi5wbmcnLCAnaWNvbnMvKi5zdmcnXSxcbiAgICAgIC8vIERpc2FibGUgaW5qZWN0TWFuaWZlc3Qgd2hpY2ggY2FuIGNvbmZsaWN0IHdpdGggY3VzdG9tIHdvcmtlcnNcbiAgICAgIGluamVjdFJlZ2lzdGVyOiBudWxsLFxuICAgICAgc3RyYXRlZ2llczogJ2dlbmVyYXRlU1cnLFxuICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgbmFtZTogJ0lTQyAtIEludGVybmV0IFNlbWFudGljIENoYXQnLFxuICAgICAgICBzaG9ydF9uYW1lOiAnSVNDJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdEZWNlbnRyYWxpemVkIFAyUCBzb2NpYWwgcGxhdGZvcm0gd2l0aCBzZW1hbnRpYyBtYXRjaGluZycsXG4gICAgICAgIHRoZW1lX2NvbG9yOiAnIzFkYTFmMicsXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjZmZmZmZmJyxcbiAgICAgICAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxuICAgICAgICBvcmllbnRhdGlvbjogJ3BvcnRyYWl0LXByaW1hcnknLFxuICAgICAgICBzY29wZTogJy8nLFxuICAgICAgICBzdGFydF91cmw6ICcvJyxcbiAgICAgICAgaWNvbnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzcmM6ICcvaWNvbnMvaWNvbi0xOTJ4MTkyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzE5MngxOTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzcmM6ICcvaWNvbnMvaWNvbi01MTJ4NTEyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzcmM6ICcvaWNvbnMvaWNvbi01MTJ4NTEyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgICBwdXJwb3NlOiAnYW55IG1hc2thYmxlJyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIHdvcmtib3g6IHtcbiAgICAgICAgZ2xvYlBhdHRlcm5zOiBbJyoqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnLHdvZmYyfSddLFxuICAgICAgICAvLyBEb24ndCBjYWNoZSB3b3JrZXIgZmlsZXNcbiAgICAgICAgaWdub3JlVVJMUGFyYW1ldGVyc01hdGNoaW5nOiBbXSxcbiAgICAgICAgcnVudGltZUNhY2hpbmc6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL2ZvbnRzXFwuZ29vZ2xlYXBpc1xcLmNvbVxcLy4qL2ksXG4gICAgICAgICAgICBoYW5kbGVyOiAnQ2FjaGVGaXJzdCcsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogJ2dvb2dsZS1mb250cy1jYWNoZScsXG4gICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcbiAgICAgICAgICAgICAgICBtYXhFbnRyaWVzOiAxMCxcbiAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzNjUsIC8vIDEgeWVhclxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZToge1xuICAgICAgICAgICAgICAgIHN0YXR1c2VzOiBbMCwgMjAwXSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXFwuKD86cG5nfGpwZ3xqcGVnfHN2Z3xnaWZ8d2VicCkkLyxcbiAgICAgICAgICAgIGhhbmRsZXI6ICdDYWNoZUZpcnN0JyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnaW1hZ2VzLWNhY2hlJyxcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjoge1xuICAgICAgICAgICAgICAgIG1heEVudHJpZXM6IDEwMCxcbiAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzMCwgLy8gMzAgZGF5c1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvYXBpXFwuL2ksXG4gICAgICAgICAgICBoYW5kbGVyOiAnTmV0d29ya0ZpcnN0JyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnYXBpLWNhY2hlJyxcbiAgICAgICAgICAgICAgbmV0d29ya1RpbWVvdXRTZWNvbmRzOiA1LFxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgbWF4RW50cmllczogNTAsXG4gICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0LCAvLyAxIGRheVxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZToge1xuICAgICAgICAgICAgICAgIHN0YXR1c2VzOiBbMCwgMjAwXSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSksXG4gIF0sXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBpbnB1dDoge1xuICAgICAgICBtYWluOiByZXNvbHZlKF9fZGlybmFtZSwgJ2luZGV4Lmh0bWwnKSxcbiAgICAgICAgJ3NoYXJlZC13b3JrZXInOiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy9zaGFyZWQtd29ya2Vycy9zaGFyZWQtd29ya2VyLnRzJyksXG4gICAgICAgICdzZXJ2aWNlLXdvcmtlcic6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL3NoYXJlZC13b3JrZXJzL3NlcnZpY2Utd29ya2VyLnRzJyksXG4gICAgICB9LFxuICAgICAgZXh0ZXJuYWw6IFsnQHhlbm92YS90cmFuc2Zvcm1lcnMnLCAnb25ueHJ1bnRpbWUtd2ViJ10sXG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgLy8gQ29uZmlndXJlIHdvcmtlciBvdXRwdXQgZm9ybWF0XG4gICAgICAgIGVudHJ5RmlsZU5hbWVzOiAnYXNzZXRzL1tuYW1lXS1baGFzaF0uanMnLFxuICAgICAgfSxcbiAgICB9LFxuICAgIC8vIENvbmZpZ3VyZSB3b3JrZXIgYnVpbGQgc2VwYXJhdGVseVxuICAgIHdvcmtlcjoge1xuICAgICAgZm9ybWF0OiAnZXMnLFxuICAgIH0sXG4gIH0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnQHhlbm92YS90cmFuc2Zvcm1lcnMnLCAnb25ueHJ1bnRpbWUtd2ViJ10sXG4gIH0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgcmVhY3Q6ICdwcmVhY3QvY29tcGF0JyxcbiAgICAgICdyZWFjdC1kb20nOiAncHJlYWN0L2NvbXBhdCcsXG4gICAgICAncmVhY3QvanN4LXJ1bnRpbWUnOiAncHJlYWN0L2pzeC1ydW50aW1lJyxcbiAgICAgICdAaXNjL2NvcmUnOiByZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjJyksXG4gICAgICAnQGlzYy9jb3JlL2NyeXB0byc6IHJlc29sdmUoX19kaXJuYW1lLCAnLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvY3J5cHRvL2luZGV4LnRzJyksXG4gICAgICAnQGlzYy9jb3JlL21hdGgnOiByZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL21hdGgvaW5kZXgudHMnKSxcbiAgICAgICdAaXNjL2NvcmUvbWF0aC9sc2gnOiByZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL21hdGgvbHNoLnRzJyksXG4gICAgICAnQGlzYy9jb3JlL2VuY29kaW5nJzogcmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9lbmNvZGluZy50cycpLFxuICAgICAgJ0Bpc2MvY29yZS90eXBlcyc6IHJlc29sdmUoX19kaXJuYW1lLCAnLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvdHlwZXMudHMnKSxcbiAgICAgICdAaXNjL2NvcmUvc2VtYW50aWMnOiByZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL3NlbWFudGljL2luZGV4LnRzJyksXG4gICAgICAnQGlzYy9hZGFwdGVycyc6IHJlc29sdmUoX19kaXJuYW1lLCAnLi4vLi4vcGFja2FnZXMvYWRhcHRlcnMvc3JjJyksXG4gICAgfSxcbiAgfSxcbiAgdGVzdDoge1xuICAgIGVudmlyb25tZW50OiAnbm9kZScsXG4gICAgZ2xvYmFsczogdHJ1ZSxcbiAgfSxc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

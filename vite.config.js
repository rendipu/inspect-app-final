// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['icons/*.png', 'favicon.ico', 'logo/*.webp'],
      manifest: {
        name: 'MineInspect',
        short_name: 'MineInspect',
        description: 'Aplikasi inspeksi kendaraan alat berat tambang',
        start_url: '/',
        display: 'standalone',
        background_color: '#fafaf7',
        theme_color: '#f59e0b',
        orientation: 'portrait-primary',
        lang: 'id',
        icons: [
          { src: '/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable any' },
          { src: '/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' },
        ],
        shortcuts: [
          { name: 'Buat Inspeksi',   url: '/', icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
          { name: 'Jadwal Hari Ini', url: '/', icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
        ],
      },
      workbox: {
        // Jangan cache /api sama sekali — semua API request harus ke network langsung
        // Ini mencegah Workbox mencoba parse response API dan crash dengan
        // "Cannot read properties of undefined (reading 'payload')"
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Cache font Google
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cache assets statis (logo, icons)
            urlPattern: /\.(png|jpg|jpeg|webp|svg|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          // TIDAK ada cache untuk /api/* — semua API harus NetworkOnly
          // karena data inspeksi harus selalu fresh dari server
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } },
  },
  build: {
    modulePreload: false,
    minify: 'esbuild',
    target: 'es2020',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'recharts':     ['recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
})
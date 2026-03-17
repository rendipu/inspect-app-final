// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'favicon.ico'],
      manifest: {
        name: 'Inspect Mining App',
        short_name: 'InspectApp',
        description: 'Aplikasi inspeksi kendaraan alat berat tambang',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#f59e0b',
        orientation: 'portrait-primary',
        lang: 'id',
        icons: [
          { src: '/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable any' },
          { src: '/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' },
        ],
        shortcuts: [
          { name: 'Buat Inspeksi', url: '/#inspection', icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
          { name: 'Jadwal Hari Ini', url: '/#schedules', icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
        ],
      },
      workbox: {
        // Cache strategi
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cloudinary-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /\/api\/questions/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-questions',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 5 },
            },
          },
          {
            urlPattern: /\/api\/units/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-units',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 5 },
            },
          },
          // SSE tidak boleh di-cache
          { urlPattern: /\/api\/sse/, handler: 'NetworkOnly' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // Proxy semua request /api ke Express server di port 3001
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Code splitting untuk bundle lebih kecil
        manualChunks: {
          vendor: ['react', 'react-dom'],
          recharts: ['recharts'],
        },
      },
    },
  },
})

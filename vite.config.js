import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
          { name: 'Buat Inspeksi', url: '/#inspection', icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
          { name: 'Jadwal Hari Ini', url: '/#schedules', icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
        ],
      },
      workbox: {
        runtimeCaching: [
          { urlPattern: /\/api\/questions/, handler: 'StaleWhileRevalidate', options: { cacheName: 'api-questions', expiration: { maxEntries: 10, maxAgeSeconds: 300 } } },
          { urlPattern: /\/api\/units/,     handler: 'StaleWhileRevalidate', options: { cacheName: 'api-units',     expiration: { maxEntries: 10, maxAgeSeconds: 300 } } },
          { urlPattern: /\/api\/sse/,        handler: 'NetworkOnly' },
          { urlPattern: /\/api\/.*/,         handler: 'NetworkFirst',        options: { cacheName: 'api-cache',     expiration: { maxEntries: 50,  maxAgeSeconds: 60  } } },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } },
  },
  build: {
    target: 'es2020',
    // ✅ FIX: minify agresif, hapus console.log di production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
      },
    },
    rollupOptions: {
      output: {
        // ✅ FIX: split chunk per halaman — lazy load bekerja optimal
        manualChunks(id) {
          if (id.includes('recharts') || id.includes('d3-')) return 'recharts'
          if (id.includes('react-dom'))  return 'react-dom'
          if (id.includes('react'))      return 'react'
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
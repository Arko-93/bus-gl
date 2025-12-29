import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const orgId = env.VITE_ORG_ID || '968'

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'bus-icon.svg'],
        manifest: {
          name: 'Nuuk Bus Live Map',
          short_name: 'Nuuk Bus',
          description: 'Real-time bus tracking for Nuuk, Greenland',
          theme_color: '#1e40af',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              // Cache OpenStreetMap tiles
              urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'osm-tiles',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Cache Leaflet assets
              urlPattern: /^https:\/\/unpkg\.com\/leaflet.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'leaflet-assets',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
          ],
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('react-dom') || id.includes('/react/')) return 'react-vendor'
            if (id.includes('@tanstack/react-query') || id.includes('zustand')) return 'state-vendor'
            if (id.includes('react-leaflet') || id.includes('leaflet')) return 'map-vendor'
            if (id.includes('lucide-react')) return 'icons'
            if (id.includes('fuse.js')) return 'search'
            return undefined
          },
        },
      },
    },
    server: {
      proxy: {
        '/api/nuuk-realtime': {
          target: 'https://pilet.ee',
          changeOrigin: true,
          rewrite: () => `/viipe/ajax/gotlandpublicrealtime?org_id=${orgId}`,
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              // Add CORS headers for dev
              proxyRes.headers['access-control-allow-origin'] = '*'
            })
          },
        },
      },
    },
  }
})

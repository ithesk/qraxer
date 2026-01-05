import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const appVersion = packageJson.version;

// Plugin to generate version.json
const versionPlugin = () => ({
  name: 'version-plugin',
  writeBundle() {
    const versionData = {
      version: appVersion,
      buildTime: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.resolve(__dirname, 'dist/version.json'),
      JSON.stringify(versionData, null, 2)
    );
    console.log(`\n📦 Version ${appVersion} written to version.json`);
  },
});

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    host: true,
  },
  build: {
    // Optimizaciones de build
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          scanner: ['html5-qrcode'],
        },
      },
    },
  },
  plugins: [
    react(),
    versionPlugin(),
    process.env.DISABLE_PWA === '1' ? null : VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-192x192.png',
        'maskable-512x512.png',
      ],
      manifest: {
        name: 'QRaxer - Scanner de Reparaciones',
        short_name: 'QRaxer',
        description: 'Escanea QR para actualizar estados de reparacion en Odoo',
        theme_color: '#2563eb',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['business', 'utilities', 'productivity'],
        lang: 'es',
        dir: 'ltr',
        permissions: ['camera'],
        capture_links: 'none',
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
            src: 'maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Escanear QR',
            short_name: 'Escanear',
            description: 'Abrir escaner de QR',
            url: '/',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // Estrategias de cache
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache para la API del backend
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200],
              },
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutos
              },
            },
          },
          {
            // Cache para fuentes
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 año
              },
            },
          },
          {
            // Cache para imágenes
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
              },
            },
          },
        ],
        // Limpiar caches antiguos
        cleanupOutdatedCaches: true,
        // Activar inmediatamente
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false, // Deshabilitar en desarrollo para evitar problemas
      },
    }),
  ].filter(Boolean),
});

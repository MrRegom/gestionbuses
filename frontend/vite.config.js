import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // El registro lo hace main.jsx: además de registrar, vuelve a
      // buscar versión cuando la pestaña recupera el foco. El script
      // que inyecta el plugin solo mira al cargar la página, y con eso
      // un usuario con la app abierta se queda en la versión vieja.
      injectRegister: null,
      workbox: {
        // Un despliegue nuevo tiene que llegar solo. Sin esto el
        // service worker sirve el bundle anterior hasta que alguien
        // limpia la caché a mano, y entonces el frontend viejo habla
        // con el backend nuevo: fue exactamente lo que dejó al
        // administrador sin menú, porque el bundle anterior no conocía
        // el rol ADMIN y lo filtraba de todas las pantallas.
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        // La API nunca se cachea: son datos de operación en vivo.
        navigateFallbackDenylist: [/^\/api\//, /^\/admin\//],
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'PlussChile SGO',
        short_name: 'SGO',
        description: 'Sistema de Gestión Operacional - PlussChile',
        // Alineado con el design system v4: chrome neutro, sin navy.
        theme_color: '#FFFFFF',
        background_color: '#F5F5F5',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    // En producción Vercel reescribe /api al backend (ver vercel.json).
    // En local hay que hacer lo mismo o axios pega contra el server de
    // Vite y devuelve 404 en vez de los datos de Django.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})

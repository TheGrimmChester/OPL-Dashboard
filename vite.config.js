import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // `@open-family/ui` is linked with `file:`, so Vite resolves through the
  // symlink to the real path — without this, `import 'react'` inside the kit
  // finds the kit's own copy and you get two Reacts and an invalid hook call.
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/oam-auth': {
        target: process.env.VITE_OAM_PROXY_TARGET || 'http://127.0.0.1:8090',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/oam-auth/, ''),
      },
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8092',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 600,
  },
})

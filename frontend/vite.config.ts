import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
    // Ignore TypeScript errors during build
    typescript: {
      noEmit: false,
      ignoreBuildErrors: true,
    },
  },
  root: './',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3014',
        changeOrigin: true,
        secure: false,
      }
    }
  },
}) 
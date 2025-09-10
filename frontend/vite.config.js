import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
  port: 3000,
  // Allow Vite to fall back to the next free port if 3000 is in use
  strictPort: false,
  proxy: {
    // Proxy API calls to backend during development
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true,
    },
    '/openapi.json': {
      target: 'http://localhost:5000',
      changeOrigin: true,
    },
    '/favicon.ico': {
      target: 'http://localhost:5000',
      changeOrigin: true,
    },
  },
  },
  preview: {
  port: 3000,
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
});

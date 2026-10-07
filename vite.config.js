import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    // The browser calls /api/... on the Vite origin; Vite forwards it to the Express server.
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true }
    }
  }
});

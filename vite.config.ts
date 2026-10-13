import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = `http://127.0.0.1:${process.env.PORT || 4321}`;

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 5173,
    // The API lives in src/server.js; in dev, Vite forwards these paths to it.
    proxy: {
      '/api': { target: api, changeOrigin: true },
      '/resumes': { target: api, changeOrigin: true },
    },
  },
});

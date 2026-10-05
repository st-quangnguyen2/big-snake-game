import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  server: {
    port: Number(process.env.PORT) || 5173,
  },
  build: {
    // three.js alone is ~600 kB minified; that is expected for a 3D game.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        models: resolve(import.meta.dirname, 'models.html'),
      },
    },
  },
});

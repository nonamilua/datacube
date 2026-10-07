import { defineConfig } from 'vite';

export default defineConfig({
  // cubing creates module workers with dynamic puzzle imports.
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['cubing'] },
  // DOM-based preload helpers cannot run inside cubing's module workers.
  build: {
    modulePreload: { polyfill:false, resolveDependencies: () => [] },
    rollupOptions: { output: { manualChunks(id) {
      if (id.includes('vite/preload-helper')) return 'preload-helper';
    } } },
  },
  server: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
});

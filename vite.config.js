import { defineConfig } from 'vite';

// TypeScript support enabled via tsconfig.json (strict mode)
// Vite auto-discovers and respects tsconfig.json compiler options
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          physics: ['@dimforge/rapier3d-compat'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  optimizeDeps: {
    include: ['three', 'zustand', '@dimforge/rapier3d-compat'],
  },
});

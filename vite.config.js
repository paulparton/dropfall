import { defineConfig } from 'vite';

export default defineConfig(async ({ mode }) => {
  const plugins = [];

  if (mode === 'vr') {
    const basicSsl = (await import('@vitejs/plugin-basic-ssl')).default;
    plugins.push(basicSsl());
  }

  return {
    plugins,
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
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
        },
      },
    },
    optimizeDeps: {
      include: ['three', 'zustand', '@dimforge/rapier3d-compat'],
    },
  };
});

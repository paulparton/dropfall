import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.{js,ts}'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});

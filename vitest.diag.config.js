import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/e2e/diag3.e2e.js'], environment: 'node' } });

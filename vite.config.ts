import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const dir = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@engine': dir('./src/engine'),
      '@game': dir('./src/game'),
      '@lab': dir('./src/lab'),
      '@packs': dir('./packs'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    include: ['src/**/*.test.ts', 'packs/**/*.test.ts', 'tools/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});

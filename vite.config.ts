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
    rollupOptions: {
      // Two pages: the game and the style lab (/lab/).
      input: { main: dir('./index.html'), lab: dir('./lab/index.html') },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'packs/**/*.test.ts', 'tools/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});

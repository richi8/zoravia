import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const dir = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // Relative asset paths (C38): the release works from any folder, e.g. a GitHub Pages
  // project site at /<repo>/.
  base: './',
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
    // The release ships only the game (C38). The style lab (/lab/) is a dev-server page;
    // `ZORAVIA_LAB=1 npm run build` builds it too. No source maps in the release.
    sourcemap: process.env['ZORAVIA_LAB'] === '1',
    chunkSizeWarningLimit: 2600,
    rollupOptions: {
      input:
        process.env['ZORAVIA_LAB'] === '1'
          ? { main: dir('./index.html'), lab: dir('./lab/index.html') }
          : { main: dir('./index.html') },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'packs/**/*.test.ts', 'tools/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});

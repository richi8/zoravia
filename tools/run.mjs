/**
 * Runs a TypeScript tool with the project's path aliases (`@game/*`, …) by loading it
 * through Vite. Usage: `node tools/run.mjs <module.ts> [args…]`; the module exports
 * `main(args)` returning an exit code.
 */
import { resolve } from 'node:path';
import { createServer } from 'vite';

const [entry, ...args] = process.argv.slice(2);
if (!entry) {
  console.error('Usage: node tools/run.mjs <module.ts> [args…]');
  process.exit(1);
}

const server = await createServer({
  configFile: resolve(import.meta.dirname, '../vite.config.ts'),
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});
let code = 1;
try {
  const mod = await server.ssrLoadModule(resolve(entry));
  code = (await mod.main(args)) ?? 0;
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
} finally {
  await server.close();
}
process.exit(code);

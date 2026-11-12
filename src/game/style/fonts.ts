/**
 * Bundled fonts (SIL OFL, served from our own build — no runtime CDN):
 * Fredoka (display) and Nunito (UI). Split by `unicode-range`, so browsers fetch only the
 * subsets a page uses (Latin, Latin-Ext, …).
 *
 * Pixi measures text when a `Text` is created, so call `loadFonts()` before building UI.
 */

import '@fontsource-variable/fredoka/wght.css';
import '@fontsource-variable/nunito/wght.css';
import { createLogger } from '@engine/core/logger';

const log = createLogger('game:fonts');

const FACES = [
  '400 16px "Nunito Variable"',
  '700 16px "Nunito Variable"',
  '800 16px "Nunito Variable"',
  '500 16px "Fredoka Variable"',
  '700 16px "Fredoka Variable"',
];

/** Resolves when the fonts are ready (or after `timeoutMs`, falling back to system fonts). */
export async function loadFonts(timeoutMs = 3000): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  const load = Promise.all(FACES.map((f) => document.fonts.load(f, 'Zoravia'))).then(
    () => true,
    () => false,
  );
  const timeout = new Promise<boolean>((r) => setTimeout(() => r(false), timeoutMs));
  if (!(await Promise.race([load, timeout]))) log.warn('fonts not loaded, using fallbacks');
}

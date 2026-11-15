/**
 * `npm run smoke` (C39): plays the release build in headless Chrome and fails when the game
 * does not boot, start, save, load, fight or report a crash.
 *
 * It serves `dist/` with Vite's preview server and drives the page with the keyboard only,
 * the way a player would. The release has no debug hook, so what happened is read from the
 * save in IndexedDB. A battle is made certain by moving the saved place to the tile in front
 * of a route trainer, who then spots the player.
 *
 * Uses the Chrome installed on the machine (`playwright-core`, no browser download).
 * `SMOKE_CHROME=<path>` picks another binary; `--keep` leaves a screenshot of the last frame.
 */

/// <reference lib="dom" />
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { preview } from 'vite';
import overlay from '@packs/core/maps/verdale/overlay.json';
import { verdaleTrainerNpcs } from '@packs/core/verdale-trainers';

/** The trainer the battle step walks up to: the first one on Verdale's road south. */
const TRAINER = 'picnicker-nell';
const SLOT = 'slot-1';
/** `SETTINGS_KEY` in `src/game/settings/settings.ts` (browser code, not imported here). */
const SETTINGS_KEY = 'zoravia:settings';

interface SavedPlace {
  map: string;
  x: number;
  y: number;
  facing: string;
}
interface Saved {
  savedAt: string;
  place: SavedPlace;
  party: {
    team: { species: string; level: number }[];
    dex: { seen: string[] };
    trainers: Record<string, { wins: number }>;
  };
}

class SmokeError extends Error {}

function check(ok: unknown, what: string): asserts ok {
  if (!ok) throw new SmokeError(what);
}

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

/** Reads a key of the game's save database from inside the page. */
function readSave(page: Page, key: string): Promise<Saved | undefined> {
  return page.evaluate(
    (k) =>
      new Promise<Saved | undefined>((done, fail) => {
        const open = indexedDB.open('zoravia');
        open.onerror = () => fail(new Error('could not open the save database'));
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('saves')) {
            db.close();
            done(undefined);
            return;
          }
          const get = db.transaction('saves', 'readonly').objectStore('saves').get(k);
          get.onsuccess = () => {
            db.close();
            done(get.result as Saved | undefined);
          };
          get.onerror = () => fail(new Error('could not read the save'));
        };
      }),
    key,
  );
}

/** Moves the saved place (and drops the backup, so the edit is what loads). */
function movePlace(page: Page, key: string, place: Partial<SavedPlace>): Promise<void> {
  return page.evaluate(
    ([k, p]) =>
      new Promise<void>((done, fail) => {
        const open = indexedDB.open('zoravia');
        open.onerror = () => fail(new Error('could not open the save database'));
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('saves', 'readwrite');
          const store = tx.objectStore('saves');
          const get = store.get(k);
          get.onsuccess = () => {
            const save = get.result as { place: object };
            save.place = { ...save.place, ...p };
            store.put(save, k);
          };
          tx.oncomplete = () => {
            db.close();
            done();
          };
          tx.onerror = () => fail(new Error('could not write the save'));
        };
      }),
    [key, place] as const,
  );
}

/** Polls until `test` holds for the save, or fails with `what` after `ms`. */
async function waitForSave(
  page: Page,
  test: (save: Saved | undefined) => boolean,
  what: string,
  ms: number,
  each?: () => Promise<void>,
): Promise<Saved> {
  const end = Date.now() + ms;
  for (;;) {
    const save = await readSave(page, SLOT);
    if (test(save) && save) return save;
    check(Date.now() < end, `${what} (waited ${ms / 1000} s)`);
    if (each) await each();
    else await sleep(200);
  }
}

async function press(page: Page, code: string, after = 450): Promise<void> {
  await page.keyboard.press(code, { delay: 60 });
  await sleep(after);
}

async function hold(page: Page, code: string, ms: number): Promise<void> {
  await page.keyboard.down(code);
  await sleep(ms);
  await page.keyboard.up(code);
  await sleep(150);
}

/** Loads the page and waits for the title screen (the boot message goes when it is up). */
async function boot(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30_000 });
  check(await page.locator('canvas[aria-label]').count(), 'the game canvas is missing');
  await sleep(600);
}

async function play(page: Page, url: string, step: (name: string) => void): Promise<void> {
  step('boot to the title screen');
  await boot(page, url);

  step('new game: slot 1, Verdale, first starter');
  for (let i = 0; i < 5; i++) await press(page, 'KeyE'); // New game, slot, region, starter, yes
  const fresh = await waitForSave(page, (s) => !!s, 'a new game was not saved', 15_000);
  check(fresh.party.team.length === 1, 'a new game should start with one Zorling');
  check(fresh.party.team[0]?.level === 6, 'the starter should be level 6');
  check(fresh.place.map === 'core:verdale', `started on ${fresh.place.map}, not Verdale`);
  await sleep(2500); // the iris into the world

  step('walk, then autosave by closing the pause menu');
  await hold(page, 'KeyA', 900);
  await hold(page, 'KeyW', 500);
  await press(page, 'Escape');
  await press(page, 'Escape');
  const walked = await waitForSave(
    page,
    (s) => !!s && (s.place.x !== fresh.place.x || s.place.y !== fresh.place.y),
    'walking and closing the menu did not save a new place',
    10_000,
  );

  step('reload: the title offers the save');
  await boot(page, url);

  step('continue in front of a trainer and fight to the end');
  const npc = verdaleTrainerNpcs[TRAINER];
  const spawn = overlay.anchors.spawn;
  check(npc && npc.x !== undefined && npc.y !== undefined, `trainer ${TRAINER} has no place`);
  check(npc.facing === 'right', `trainer ${TRAINER} should face right for this test`);
  // The save keeps region tiles from the map's origin; the new game's place is the spawn anchor.
  const front = {
    x: fresh.place.x + (npc.x + 1 - spawn.x),
    y: fresh.place.y + (npc.y - spawn.y),
  };
  await movePlace(page, SLOT, { ...front, facing: 'left' });
  await boot(page, url);
  await press(page, 'KeyE', 3000); // Continue
  // `E` reads the trainer's lines, picks the first move every turn and closes the results.
  // Only `E` is pressed, so the player stays put: a win is in the trainer log, and a loss
  // shows as waking up at the Zorling center.
  const won = (s: Saved): boolean => `core:${TRAINER}` in s.party.trainers;
  const lost = (s: Saved): boolean => s.place.x !== front.x || s.place.y !== front.y;
  const fought = await waitForSave(
    page,
    (s) => !!s && s.savedAt !== walked.savedAt && (won(s) || lost(s)),
    'no battle was fought and saved',
    180_000,
    () => press(page, 'KeyE', 250),
  );
  check(fought.party.team.length >= 1, 'the team is empty after the battle');
  console.info(`  ${won(fought) ? 'won' : 'lost'} against ${TRAINER}`);

  step('a frame that throws shows the crash screen');
  await page.evaluate(() => {
    const boom = (): never => {
      throw new Error('smoke test crash');
    };
    for (const gl of [WebGL2RenderingContext, WebGLRenderingContext]) {
      gl.prototype.drawElements = boom;
      gl.prototype.drawArrays = boom;
    }
  });
  await page.waitForSelector('#crash', { timeout: 10_000 });
  const details = (await page.locator('#crash-details').textContent()) ?? '';
  check(details.includes('smoke test crash'), 'the crash screen does not show the error');
  check(/Zoravia v\d/.test(details), 'the crash screen does not show the version');
  await page.waitForFunction(
    () => !document.getElementById('crash-save')?.textContent?.startsWith('Saving'),
    undefined,
    { timeout: 10_000 },
  );
  check(
    await page.evaluate(() => document.activeElement?.id === 'crash-reload'),
    'the Reload button is not focused',
  );
}

export async function main(args: readonly string[]): Promise<number> {
  const dist = resolve('dist');
  if (!existsSync(join(dist, 'index.html'))) {
    console.error('No build in dist/. Run `npm run build` first, or `npm run smoke`.');
    return 1;
  }
  const server = await preview({
    logLevel: 'silent',
    preview: { port: 4179, host: '127.0.0.1' },
  });
  const url = server.resolvedUrls?.local[0];
  const chrome = process.env['SMOKE_CHROME'];
  const browser = await chromium.launch({
    ...(chrome ? { executablePath: chrome } : { channel: 'chrome' }),
    // Headless Chrome has no GPU: let WebGL run on the software renderer.
    args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'],
  });
  const problems: string[] = [];
  let crashExpected = false;
  let current = '';
  let page: Page | undefined;
  let code = 0;
  try {
    check(url, 'the preview server has no address');
    page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    // Fast battles and text; nothing else differs from a player's first visit.
    await page.addInitScript(
      ([key, value]) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, value);
      },
      [SETTINGS_KEY, JSON.stringify({ battleSpeed: 2, textSpeed: 'fast' })] as const,
    );
    page.on('pageerror', (e) => problems.push(`page error during "${current}": ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error' || crashExpected) return;
      problems.push(`console error during "${current}": ${m.text()}`);
    });
    page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`));
    const started = Date.now();
    await play(page, url, (name) => {
      current = name;
      crashExpected = name.includes('crash');
      console.info(`· ${name}`);
    });
    check(problems.length === 0, problems.join('\n'));
    console.info(`Smoke test passed in ${Math.round((Date.now() - started) / 1000)} s.`);
  } catch (e) {
    code = 1;
    console.error(`Smoke test FAILED at "${current}":`);
    console.error(e instanceof Error ? e.message : e);
    for (const p of problems) console.error(p);
  } finally {
    if (page && (code !== 0 || args.includes('--keep'))) {
      const shot = join(tmpdir(), 'zoravia-smoke.png');
      await page.screenshot({ path: shot }).catch(() => undefined);
      console.error(`Last frame: ${shot}`);
    }
    await browser.close();
    await new Promise<void>((done) => server.httpServer.close(() => done()));
  }
  return code;
}

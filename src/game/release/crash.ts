/**
 * The crash screen (C39). When a frame throws, the engine stops its loop and the game would
 * sit frozen. This shows a plain DOM message over the canvas instead: what happened, whether
 * the game was saved, the error and version for a bug report, and a Reload button.
 */

export interface CrashReport {
  readonly error: unknown;
  readonly version: string;
  /** Resolves to true when the game state was written after the crash. */
  readonly saved: Promise<boolean>;
}

/** The lines for a bug report: version, message and the top of the stack. */
export function crashDetails(error: unknown, version: string): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const stack =
    error instanceof Error && error.stack
      ? error.stack
          .split('\n')
          .filter((line) => line.trim().startsWith('at '))
          .slice(0, 4)
          .map((line) => line.trim())
      : [];
  return [`Zoravia ${version}`, message, ...stack].join('\n');
}

/** What the screen says about the save, once the attempt is over. */
export function crashSaveLine(saved: boolean): string {
  return saved
    ? 'Your game was saved just now.'
    : 'Your last save is safe. Anything after it may be lost.';
}

/** Shows the crash screen. Safe to call more than once: only the first call shows. */
export function showCrashScreen(doc: Document, report: CrashReport): void {
  if (doc.getElementById('crash')) return;
  const root = doc.createElement('div');
  root.id = 'crash';
  root.setAttribute('role', 'alertdialog');
  root.setAttribute('aria-labelledby', 'crash-title');
  root.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
    'padding:16px;background:rgba(13,15,31,0.92);color:#f5f6fb;' +
    'font:500 16px/1.5 system-ui,sans-serif;z-index:10';

  const box = doc.createElement('div');
  box.style.cssText = 'max-width:560px;width:100%';

  const title = doc.createElement('h1');
  title.id = 'crash-title';
  title.textContent = 'Zoravia ran into a problem and had to stop.';
  title.style.cssText = 'font-size:20px;margin:0 0 8px';

  const save = doc.createElement('p');
  save.id = 'crash-save';
  save.textContent = 'Saving your game…';
  save.style.margin = '0 0 12px';
  void report.saved
    .catch(() => false)
    .then((ok) => {
      save.textContent = crashSaveLine(ok);
    });

  const details = doc.createElement('pre');
  details.id = 'crash-details';
  details.textContent = crashDetails(report.error, report.version);
  details.style.cssText =
    'font:12px/1.4 ui-monospace,monospace;white-space:pre-wrap;word-break:break-word;' +
    'background:#1b1e36;padding:8px;margin:0 0 12px;max-height:30vh;overflow:auto';

  const reload = doc.createElement('button');
  reload.id = 'crash-reload';
  reload.textContent = 'Reload the game';
  reload.style.cssText =
    'font:600 16px system-ui,sans-serif;padding:8px 16px;cursor:pointer;' +
    'background:#f0c75e;color:#2b1d12;border:2px solid #2b1d12';
  reload.addEventListener('click', () => doc.defaultView?.location.reload());

  box.append(title, save, details, reload);
  root.append(box);
  doc.body.append(root);
  reload.focus();
}

/**
 * UI sound hook (C24). Widgets report what happened (`uiSound('move')`); the game installs a
 * sink that turns it into sound. Without a sink (tests, the lab) nothing plays.
 */

export type UiSound =
  /** The cursor moved. */
  | 'move'
  /** An item was chosen. */
  | 'select'
  /** Back / close. */
  | 'back'
  /** Not possible right now (disabled item, can't afford). */
  | 'blocked'
  /** A screen or the inspect mode opened. */
  | 'open'
  /** Dialog went to the next page. */
  | 'advance';

let sink: ((sound: UiSound) => void) | undefined;

/** Installs (or with `undefined` removes) the function that plays UI sounds. */
export function setUiSoundSink(fn: ((sound: UiSound) => void) | undefined): void {
  sink = fn;
}

export function uiSound(sound: UiSound): void {
  sink?.(sound);
}

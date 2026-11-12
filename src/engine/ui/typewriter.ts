/**
 * Typewriter text reveal over pages (pure logic).
 *
 * Controls (DESIGN.md): `confirm` advances; holding `confirm` speeds up the reveal; `back`
 * finishes the current page instantly.
 *
 * - While a page is typing, holding confirm multiplies the speed.
 * - A confirm *press* on a finished page goes to the next page (or finishes the dialog).
 *   A press while typing does nothing extra — the hold already speeds it up — so mashing E
 *   can't skip a page unread.
 */

export interface TypewriterOptions {
  /** Characters per second. Default 40. */
  readonly charsPerSecond?: number;
  /** Speed multiplier while confirm is held. Default 5. */
  readonly fastMultiplier?: number;
}

export interface TypewriterInput {
  readonly confirmPressed: boolean;
  readonly confirmHeld: boolean;
  readonly backPressed: boolean;
}

export class Typewriter {
  private pageIndex = 0;
  private shown = 0;
  private finished = false;
  readonly charsPerSecond: number;
  readonly fastMultiplier: number;

  constructor(
    private readonly pages: readonly string[],
    options: TypewriterOptions = {},
  ) {
    this.charsPerSecond = options.charsPerSecond ?? 40;
    this.fastMultiplier = options.fastMultiplier ?? 5;
    if (pages.length === 0) this.finished = true;
  }

  get page(): number {
    return this.pageIndex;
  }

  get pageCount(): number {
    return this.pages.length;
  }

  get pageText(): string {
    return this.pages[this.pageIndex] ?? '';
  }

  /** The part of the current page revealed so far. */
  get visibleText(): string {
    return this.pageText.slice(0, Math.floor(this.shown));
  }

  get pageComplete(): boolean {
    return Math.floor(this.shown) >= this.pageText.length;
  }

  get isLastPage(): boolean {
    return this.pageIndex >= this.pages.length - 1;
  }

  /** True after the last page was confirmed. */
  get done(): boolean {
    return this.finished;
  }

  /** Advances time and applies input. Returns true if the visible text changed. */
  update(dt: number, input: TypewriterInput): boolean {
    if (this.finished) return false;
    const before = Math.floor(this.shown);
    const pageBefore = this.pageIndex;

    if (this.pageComplete) {
      if (input.confirmPressed) this.next();
    } else if (input.backPressed) {
      this.completePage();
    } else {
      const speed = this.charsPerSecond * (input.confirmHeld ? this.fastMultiplier : 1);
      this.shown = Math.min(this.shown + speed * dt, this.pageText.length);
    }
    return Math.floor(this.shown) !== before || this.pageIndex !== pageBefore || this.finished;
  }

  completePage(): void {
    this.shown = this.pageText.length;
  }

  /** Moves to the next page, or finishes on the last one. */
  next(): void {
    if (this.isLastPage) {
      this.finished = true;
      return;
    }
    this.pageIndex++;
    this.shown = 0;
  }
}

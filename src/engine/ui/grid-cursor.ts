/**
 * Cursor over a list (1 column) or grid of items, with wrap-around and disabled-item skipping.
 * Pure logic; menus render it.
 *
 * - Up/down move within a column and wrap top ↔ bottom.
 * - Left/right move within a row and wrap; in a single-column list they do nothing.
 * - A ragged last row is handled: moving into a missing cell wraps to the column's other end.
 * - Disabled items are skipped by continuing in the same direction.
 */

import type { Direction } from '../input/input-manager';

export class GridCursor {
  private current = -1;

  constructor(
    private count: number,
    readonly columns = 1,
    private isEnabled: (index: number) => boolean = () => true,
  ) {
    this.current = this.firstEnabled();
  }

  /** Selected index, or -1 if nothing is selectable. */
  get index(): number {
    return this.current;
  }

  get rows(): number {
    return Math.ceil(this.count / this.columns);
  }

  /** Updates item count / enabled check (e.g. after items changed) and keeps the index valid. */
  reset(count: number, isEnabled: (index: number) => boolean = this.isEnabled): void {
    this.count = count;
    this.isEnabled = isEnabled;
    if (this.current < 0 || this.current >= count || !isEnabled(this.current)) {
      this.current = this.firstEnabled();
    }
  }

  /** Sets the index directly (mouse hover). Ignores disabled or out-of-range indices. */
  set(index: number): boolean {
    if (index < 0 || index >= this.count || !this.isEnabled(index) || index === this.current) {
      return false;
    }
    this.current = index;
    return true;
  }

  /** Moves one step; returns whether the index changed. */
  move(dir: Direction): boolean {
    if (this.current < 0) return false;
    if (this.columns === 1 && (dir === 'left' || dir === 'right')) return false;
    let i = this.current;
    // At most `count` hops: guarantees termination if everything else is disabled.
    for (let hop = 0; hop < this.count; hop++) {
      i = this.step(i, dir);
      if (i === this.current) return false;
      if (this.isEnabled(i)) {
        this.current = i;
        return true;
      }
    }
    return false;
  }

  private step(i: number, dir: Direction): number {
    const cols = this.columns;
    const row = Math.floor(i / cols);
    const col = i % cols;
    switch (dir) {
      case 'up': {
        if (row > 0) return i - cols;
        // Wrap to the last row that has this column.
        const lastRow = Math.floor((this.count - 1 - col) / cols);
        return lastRow * cols + col;
      }
      case 'down': {
        const next = i + cols;
        return next < this.count ? next : col;
      }
      case 'left': {
        const rowStart = row * cols;
        const rowEnd = Math.min(rowStart + cols, this.count) - 1;
        return i > rowStart ? i - 1 : rowEnd;
      }
      case 'right': {
        const rowStart = row * cols;
        const rowEnd = Math.min(rowStart + cols, this.count) - 1;
        return i < rowEnd ? i + 1 : rowStart;
      }
    }
  }

  private firstEnabled(): number {
    for (let i = 0; i < this.count; i++) if (this.isEnabled(i)) return i;
    return -1;
  }
}

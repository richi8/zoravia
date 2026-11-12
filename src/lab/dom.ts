/** Tiny DOM helpers for the lab (no framework). */

type Attrs = Record<string, string | number | boolean | undefined>;
type Child = Node | string | null | undefined | false;

/** `h('div', { class: 'x' }, 'text', child)` */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

/** Parses trusted, code-generated SVG markup into an element. */
export function svg(markup: string): Element {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  return document.importNode(doc.documentElement, true);
}

export interface LabSection {
  readonly id: string;
  readonly title: string;
  /** Chunk that builds it (shown as a tag). */
  readonly chunk: string;
  readonly ready: boolean;
  render(el: HTMLElement): void;
}

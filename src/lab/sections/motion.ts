import { EASINGS } from '@engine/core/easing';
import { motion } from '@game/style/tokens';
import { h, type LabSection } from '../dom';

/** Animates each dot across its track with the given easing; click a row to replay. */
export const motionSection: LabSection = {
  id: 'motion',
  title: 'Motion',
  chunk: 'C07',
  ready: true,
  render(el) {
    const rows: {
      dot: HTMLElement;
      ease: (t: number) => number;
      duration: number;
      start: number;
    }[] = [];
    const track = (label: string, ease: (t: number) => number, duration: number): HTMLElement => {
      const dot = h('span', { class: 'motion-dot' });
      const row = h(
        'button',
        { class: 'motion-row', type: 'button', title: 'Replay' },
        h('code', {}, label),
        h('span', { class: 'motion-track' }, dot),
      );
      const entry = { dot, ease, duration, start: performance.now() };
      rows.push(entry);
      row.addEventListener('click', () => (entry.start = performance.now()));
      return row;
    };
    const named = Object.entries(motion.easing).map(([role, name]) =>
      track(
        `${role} · ${name} · ${motion.duration.slower}s`,
        EASINGS[name],
        motion.duration.slower,
      ),
    );
    const durations = Object.entries(motion.duration)
      .filter(([k]) => k !== 'battleActionMax')
      .map(([k, v]) => track(`${k} · ${v}s`, EASINGS.cubicOut, v));
    el.append(
      h(
        'p',
        { class: 'lead' },
        `Durations are seconds (the engine's unit). One battle action stays ≤ ${motion.duration.battleActionMax}s. Dialog text: ${motion.text.charsPerSecond} chars/s, ×${motion.text.fastMultiplier} while holding E. Click a row to replay.`,
      ),
      h('h3', {}, 'Easing roles'),
      ...named,
      h('h3', {}, 'Durations'),
      ...durations,
    );
    const PAUSE = 0.6;
    const frame = (now: number): void => {
      for (const r of rows) {
        const t = (now - r.start) / 1000;
        const cycle = r.duration + PAUSE;
        const local = Math.min(1, (t % cycle) / r.duration);
        // left: p% of the track, shifted back by p% of the dot, so 0 and 1 sit at the ends.
        // (A single calc() breaks on negative values, which backOut can produce.)
        const p = r.ease(local) * 100;
        r.dot.style.left = `${p.toFixed(2)}%`;
        r.dot.style.transform = `translateX(${(-p).toFixed(2)}%)`;
      }
      if (el.isConnected) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },
};

import { describe, expect, it } from 'vitest';
import { CONDITION_IDS, TYPE_IDS } from '@game/style/tokens';
import {
  APPLIES,
  CONDITIONS,
  FOE,
  TEAM,
  effectiveness,
  exploits,
  moveView,
  typeTooltip,
} from './data';

describe('battle mock data (DESIGN.md tables)', () => {
  it('every type applies exactly one condition, each condition once', () => {
    expect(new Set(TYPE_IDS.map((t) => APPLIES[t])).size).toBe(8);
    for (const c of CONDITION_IDS) expect(TYPE_IDS).toContain(CONDITIONS[c].applier);
  });

  it('matches the reaction table', () => {
    expect(exploits('fire')).toEqual(['overgrown']);
    expect(exploits('water')).toEqual(['burning']);
    expect(exploits('electric')).toEqual(['wet']);
    expect(exploits('ice')).toEqual(['wet']);
    expect(exploits('earth').sort()).toEqual(['airborne', 'chilled']);
    expect(exploits('wind')).toEqual(['exposed']);
    expect(exploits('metal')).toEqual(['charged']);
    expect(exploits('nature')).toEqual(['muddy']);
  });

  it('type effectiveness', () => {
    expect(effectiveness('electric', ['water'])).toBe(1.5);
    expect(effectiveness('fire', ['water'])).toBeCloseTo(0.67);
    expect(effectiveness('nature', ['metal'])).toBeCloseTo(0.67);
    expect(effectiveness('wind', ['fire'])).toBe(1);
  });

  it('move tips: combo beats effectiveness, then warnings', () => {
    const moves = TEAM[0]?.moves ?? [];
    const [ember, spark, gust] = moves;
    if (!ember || !spark || !gust) throw new Error('mock moves missing');
    const foe = FOE.genome.types;
    const spk = moveView(spark, foe, ['wet']);
    expect(spk.tip?.good).toBe(true);
    expect(spk.tip?.text).toContain('Conducted');
    expect(moveView(spark, foe, []).tip?.text).toContain('Strong vs Water');
    expect(moveView(ember, foe, []).tip).toEqual({ good: false, text: 'Weak vs Water ×0.67' });
    expect(moveView(gust, foe, []).tip).toBeUndefined();
    expect(spk.applies).toBe('charged');
  });

  it('type tooltips name strengths and weaknesses', () => {
    expect(typeTooltip('water').body).toContain('Strong vs Fire, Earth.');
    expect(typeTooltip('water').body).toContain('Weak to Nature, Electric.');
  });
});

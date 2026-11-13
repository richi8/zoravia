import { describe, expect, it } from 'vitest';
import { AudioEngine } from './audio-engine';
import { curvePoints, midiHz, scaleSpec, sequence, specDuration, type SoundSpec } from './spec';

const spec: SoundSpec = {
  tones: [
    { wave: 'square', dur: 0.1, freq: [440, 880] },
    { wave: 'noise', at: 0.2, dur: 0.3, filter: { type: 'lowpass', freq: 1000 } },
  ],
};

describe('sound specs', () => {
  it('measures length and reads curves', () => {
    expect(specDuration(spec)).toBeCloseTo(0.5);
    expect(specDuration({ tones: [] })).toBe(0);
    expect(curvePoints(5)).toEqual([5]);
    expect(curvePoints([1, 2])).toEqual([1, 2]);
    expect(midiHz(69)).toBe(440);
    expect(midiHz(81)).toBeCloseTo(880);
  });

  it('scales pitch, time and gain without touching the original', () => {
    const s = scaleSpec(spec, { pitch: 2, stretch: 0.5, gain: 0.5 });
    expect(s.tones[0]?.freq).toEqual([880, 1760]);
    expect(s.tones[1]?.filter?.freq).toBe(2000);
    expect(s.tones[1]?.at).toBeCloseTo(0.1);
    expect(specDuration(s)).toBeCloseTo(0.25);
    expect(s.gain).toBe(0.5);
    expect(spec.tones[0]?.freq).toEqual([440, 880]);
    expect(scaleSpec(spec, {})).toBe(spec);
    // Pitch stays in the audible range.
    expect(scaleSpec(spec, { pitch: 100 }).tones[0]?.freq).toEqual([18_000, 18_000]);
  });

  it('sequences two specs', () => {
    const s = sequence(spec, spec, 0.1);
    expect(s.tones).toHaveLength(4);
    expect(specDuration(s)).toBeCloseTo(1.1);
  });
});

describe('AudioEngine', () => {
  it('is a silent no-op without Web Audio', () => {
    const audio = new AudioEngine(() => undefined);
    audio.unlock();
    expect(audio.ready).toBe(false);
    expect(audio.play(spec)).toBe(false);
    audio.setVolume('sfx', 2);
    expect(audio.volume('sfx')).toBe(1);
    audio.setVolume('master', -1);
    expect(audio.volume('master')).toBe(0);
  });
});

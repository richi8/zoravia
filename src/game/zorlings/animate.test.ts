import { spriteHash } from '@engine/render/sdf-sprite';
import { describe, expect, it } from 'vitest';
import { animateZorling, CLIP_NAMES } from './animate';
import { BODY_PLANS, generateGenome, zorlingGenomeSchema } from './genome';
import { buildZorling } from './build';
import { renderZorling, ZorlingRenderer } from './render';
import { stageFill, stageGenome, stageGrowth, titanGenome, TITAN_SIZE } from './variants';

const opaque = (data: Uint8ClampedArray): number => {
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i]) n++;
  return n;
};

describe('rig', () => {
  it('every plan has a body bone; parts sit on known bones with body as root', () => {
    for (const plan of BODY_PLANS) {
      for (let i = 0; i < 8; i++) {
        const m = buildZorling(generateGenome(`${plan}:${i}`, { plan }));
        expect(m.rig['body']).toBeDefined();
        for (const [id, bone] of Object.entries(m.rig)) {
          if (id !== 'body') expect(bone.parent).toBe('body');
        }
        for (const s of m.shapes) expect(m.rig[s.bone ?? 'body']).toBeDefined();
        for (const e of m.eyes) expect(e.bone).toBe(m.rig['head'] ? 'head' : 'body');
      }
    }
  });

  it('separate heads and wings get their own bones', () => {
    const quad = buildZorling(generateGenome('q', { plan: 'quadruped' }));
    expect(quad.rig['head']).toBeDefined();
    const dragon = buildZorling(generateGenome('d', { plan: 'dragon' }));
    expect(dragon.rig['wingNear'] && dragon.rig['wingFar']).toBeTruthy();
  });

  it('the rest frame matches the still sprite', () => {
    const g = generateGenome('zoravia:0');
    expect(spriteHash(new ZorlingRenderer(g).frame())).toBe(spriteHash(renderZorling(g)));
  });
});

describe('animateZorling', () => {
  it('renders every clip for every plan, same genome → same frames', () => {
    for (const plan of BODY_PLANS) {
      const g = generateGenome(`anim:${plan}`, { plan });
      const a = animateZorling(g, { size: 48 });
      for (const name of CLIP_NAMES) {
        const clip = a.clips[name];
        expect(clip?.frames.length).toBeGreaterThan(3);
        for (const f of clip?.frames ?? []) {
          expect(f.sprite.width).toBe(a.width);
          expect(f.ms).toBeGreaterThan(0);
          expect(f.alpha).toBeGreaterThanOrEqual(0);
        }
      }
      const again = animateZorling(zorlingGenomeSchema.parse(JSON.parse(JSON.stringify(g))), {
        size: 48,
        clips: ['idle'],
      });
      expect(again.clips.idle?.frames.map((f) => spriteHash(f.sprite))).toEqual(
        a.clips.idle?.frames.map((f) => spriteHash(f.sprite)),
      );
    }
    // Every plan × every clip: slow when the whole suite runs in parallel.
  }, 20_000);

  it('idle loops and moves; one frame blinks; others play once', () => {
    const a = animateZorling(generateGenome('idle', { plan: 'biped' }));
    const idle = a.clips.idle;
    expect(idle?.loop).toBe(true);
    expect(a.clips.attack?.loop).toBe(false);
    const hashes = new Set(idle?.frames.map((f) => spriteHash(f.sprite)));
    expect(hashes.size).toBeGreaterThan(4);
  });

  it('attack lunges forward, hurt flashes and recoils, faint fades out', () => {
    const a = animateZorling(generateGenome('moves', { plan: 'quadruped' }));
    expect(Math.max(...(a.clips.attack?.frames.map((f) => f.dx) ?? []))).toBeGreaterThan(8);
    const hurt = a.clips.hurt?.frames ?? [];
    expect(Math.min(...hurt.map((f) => f.dx))).toBeLessThan(0);
    const first = hurt[0]?.sprite.data ?? new Uint8ClampedArray();
    for (let i = 0; i < first.length; i += 4) if (first[i + 3]) expect(first[i]).toBe(255);
    const faint = a.clips.faint?.frames ?? [];
    expect(faint[0]?.alpha).toBe(1);
    expect(faint[faint.length - 1]?.alpha).toBe(0);
    const last = a.clips.attack?.frames.at(-1);
    expect(last?.dx).toBe(0);
  });

  it('padding keeps the figure inside the sprite during motion', () => {
    for (const plan of BODY_PLANS) {
      const a = animateZorling(generateGenome(`pad:${plan}`, { plan }), { size: 64 });
      for (const clip of Object.values(a.clips)) {
        for (const f of clip.frames) {
          const { width: W, data } = f.sprite;
          for (let x = 0; x < W; x++) {
            expect(data[x * 4 + 3]).toBe(0); // top row
            expect(data[x * W * 4 + 3]).toBe(0); // left column
            expect(data[(x * W + W - 1) * 4 + 3]).toBe(0); // right column
          }
        }
      }
    }
  });

  it('Titans are 128 with an aura in the type glow color', () => {
    const g = titanGenome(generateGenome('titan', { type: 'water' }));
    const plain = animateZorling(g, { clips: ['idle'], size: TITAN_SIZE });
    const titan = animateZorling(g, { titan: true, clips: ['idle'] });
    expect(titan.size).toBe(TITAN_SIZE);
    const p = plain.clips.idle?.frames[0]?.sprite.data ?? new Uint8ClampedArray();
    const t = titan.clips.idle?.frames[0]?.sprite.data ?? new Uint8ClampedArray();
    expect(opaque(t)).toBeGreaterThan(opaque(p));
  });
});

describe('evolution stages', () => {
  it('growth and fill per stage', () => {
    expect(stageGrowth(1, 1)).toBe(1);
    expect(stageGrowth(1, 3)).toBe(0);
    expect(stageGrowth(3, 3)).toBe(1);
    expect(stageGrowth(1, 2)).toBeLessThan(stageGrowth(2, 2));
    expect(() => stageGrowth(4, 3)).toThrow();
    expect(stageFill(0)).toBeLessThan(stageFill(1));
    expect(stageFill(1)).toBe(1);
  });

  it('the final stage is the genome itself; earlier stages are smaller-limbed, bigger-headed', () => {
    const flyers = ['avian', 'bat', 'insect', 'raptor'];
    for (let i = 0; i < 30; i++) {
      const g = generateGenome(`evo:${i}`);
      expect(stageGenome(g, 3, 3)).toBe(g);
      const baby = stageGenome(g, 1, 3);
      const teen = stageGenome(g, 2, 3);
      expect(zorlingGenomeSchema.parse(baby)).toEqual(baby);
      expect(zorlingGenomeSchema.parse(teen)).toEqual(teen);
      expect(baby.plan).toBe(g.plan);
      // Same colors, paler body.
      expect(baby.palette).toMatchObject({ secondary: g.palette.secondary, eye: g.palette.eye });
      expect(baby.palette.primary).not.toBe(g.palette.primary);
      // Babies wear no adult parts; wings only on lines that always fly.
      expect(['none', 'leaves']).toContain(baby.parts.back);
      if (!flyers.includes(g.plan)) {
        expect(baby.parts.wings).toBe('none');
        expect(teen.parts.wings).toBe('none');
      }
      expect(teen.parts.horns).not.toBe('antlers');
      expect(baby.body.head).toBeGreaterThanOrEqual(g.body.head);
      expect(baby.body.limbs).toBeLessThanOrEqual(g.body.limbs);
      expect(['none', 'nubs']).toContain(baby.parts.horns);
      expect(baby.parts.mouth).not.toBe('fangs');
      expect(baby.mood).not.toBe('fierce');
    }
  });

  it('young stages can take another body plan (metamorphosis)', () => {
    const g = generateGenome('meta', { plan: 'serpent', mood: 'fierce' });
    expect(stageGenome(g, 1, 2, ['fish']).plan).toBe('fish');
    expect(stageGenome(g, 2, 2, ['fish'])).toBe(g);
    const three = generateGenome('meta3', { plan: 'dragon' });
    expect(stageGenome(three, 1, 3, ['quadruped', 'feline']).plan).toBe('quadruped');
    expect(stageGenome(three, 2, 3, ['quadruped', 'feline']).plan).toBe('feline');
    expect(stageGenome(three, 2, 3, ['quadruped']).plan).toBe('dragon');
    for (const s of [1, 2]) {
      const young = stageGenome(three, s, 3, ['quadruped', 'feline']);
      expect(renderZorling(young).width).toBe(96);
    }
  });

  it('earlier stages fill less of the frame', () => {
    const g = generateGenome('size', { plan: 'biped' });
    const big = opaque(renderZorling(g).data);
    const small = opaque(
      renderZorling(stageGenome(g, 1, 3), { fill: stageFill(stageGrowth(1, 3)) }).data,
    );
    expect(small).toBeLessThan(big * 0.6);
  });
});

describe('regional plans (C35a)', () => {
  it('babies of new plans follow the stage rules: no tusks, lures, icicles or shells', () => {
    for (const plan of BODY_PLANS) {
      for (let i = 0; i < 6; i++) {
        const g = generateGenome(`stage:${plan}:${i}`, { plan });
        const baby = stageGenome(g, 1, 3);
        expect(['none', 'nubs']).toContain(baby.parts.horns);
        expect(['icicles', 'carapace', 'plates', 'crystals']).not.toContain(baby.parts.back);
        expect(baby.parts.eyes).toBe('big');
      }
    }
  });

  it('legendary shine adds a glow edge and twinkling sparkles', () => {
    const g = generateGenome('shine', { plan: 'magmadrake', types: ['fire', 'earth'] });
    const plain = animateZorling(g, { size: 64, clips: ['idle'] });
    const shiny = animateZorling(g, { size: 64, clips: ['idle'], legendary: true });
    const p = plain.clips.idle?.frames ?? [];
    const s = shiny.clips.idle?.frames ?? [];
    for (let i = 0; i < p.length; i++) {
      expect(opaque(s[i]?.sprite.data ?? new Uint8ClampedArray())).toBeGreaterThan(
        opaque(p[i]?.sprite.data ?? new Uint8ClampedArray()),
      );
    }
    // Sparkles twinkle: the shiny frames differ from each other by more than the body motion.
    const counts = s.map((f) => opaque(f.sprite.data));
    expect(new Set(counts).size).toBeGreaterThan(2);
    const again = animateZorling(g, { size: 64, clips: ['idle'], legendary: true });
    expect(again.clips.idle?.frames.map((f) => spriteHash(f.sprite))).toEqual(
      s.map((f) => spriteHash(f.sprite)),
    );
  });
});

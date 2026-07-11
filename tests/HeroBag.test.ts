import { describe, expect, it } from 'vitest';

import { HeroBag } from '../src/battle/HeroBag';
import { SeededRandom } from '../src/battle/SeededRandom';

const HERO_POOL = ['gale', 'ember', 'stone', 'starlight'] as const;

describe('HeroBag', () => {
  it('每个 8 张袋中四名英雄各出现 2 次', () => {
    const bag = new HeroBag(HERO_POOL, 2, new SeededRandom('bag-counts'));
    const firstRound = Array.from({ length: 8 }, () => bag.draw());

    for (const heroId of HERO_POOL) {
      expect(firstRound.filter((value) => value === heroId)).toHaveLength(2);
    }
    expect(bag.remainingCount).toBe(0);

    bag.draw();
    expect(bag.remainingCount).toBe(7);
  });

  it('同一种子复现跨越多个英雄袋的完整序列', () => {
    const first = new HeroBag(HERO_POOL, 2, new SeededRandom('same-bag'));
    const second = new HeroBag(HERO_POOL, 2, new SeededRandom('same-bag'));

    const firstSequence = Array.from({ length: 24 }, () => first.draw());
    const secondSequence = Array.from({ length: 24 }, () => second.draw());

    expect(firstSequence).toEqual(secondSequence);
  });
});

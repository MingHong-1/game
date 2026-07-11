import { describe, expect, it } from 'vitest';

import { BATTLE_CONFIG } from '../src/data/battleConfig';
import {
  canUpgradeHeroStar,
  getHeroStarUnitValue,
  getNextHeroStar,
  HERO_STARS,
  isHeroStar,
  isMaximumHeroStar,
  MAX_HERO_STAR,
  MIN_HERO_STAR,
  toHeroStar,
  type HeroStar,
} from '../src/battle/HeroStar';
import { SlotSystem } from '../src/battle/SlotSystem';
import { deriveHeroStarUiState } from '../src/ui/state/HeroStarUiState';

describe('HeroStar 权威模型', () => {
  it('只接受1～4星并拒绝范围外输入', () => {
    expect(MIN_HERO_STAR).toBe(1);
    expect(MAX_HERO_STAR).toBe(4);
    expect(HERO_STARS).toEqual([1, 2, 3, 4]);
    for (const star of HERO_STARS) expect(isHeroStar(star)).toBe(true);
    for (const invalid of [0, 5, -1, 1.5, Number.NaN, '4']) {
      expect(isHeroStar(invalid)).toBe(false);
      expect(() => toHeroStar(invalid)).toThrow('英雄星级必须是 1～4 的整数');
    }
  });

  it('等价值为1、2、4、8且4星为满星', () => {
    expect(HERO_STARS.map(getHeroStarUnitValue)).toEqual([1, 2, 4, 8]);
    expect(HERO_STARS.map(getNextHeroStar)).toEqual([2, 3, 4, null]);
    expect(canUpgradeHeroStar(3)).toBe(true);
    expect(canUpgradeHeroStar(4)).toBe(false);
    expect(isMaximumHeroStar(4)).toBe(true);
    expect(() => getHeroStarUnitValue(5 as HeroStar)).toThrow(
      '英雄星级必须是 1～4 的整数',
    );
  });

  it('UI将4星标为满星且不提供继续升星语义', () => {
    expect(deriveHeroStarUiState(3)).toMatchObject({
      maximum: false,
      canUpgrade: true,
      detailLabel: '★★★  3 星',
    });
    expect(deriveHeroStarUiState(4)).toMatchObject({
      maximum: true,
      canUpgrade: false,
      detailLabel: '★★★★  4 星 · 满星',
    });
  });

  it('格位运行时边界拒绝被不安全类型绕过的5星输入', () => {
    const slots = new SlotSystem([{ x: 0, y: 0 }], {
      ...BATTLE_CONFIG.summon,
      slotUnlockTiers: [{ successfulSummons: 0, unlockedSlots: 1 }],
    });
    expect(() =>
      slots.occupyFirstAvailable({
        instanceId: 'illegal-five-star',
        heroDefinitionId: 'gale-hunter',
        starLevel: 5 as HeroStar,
      }),
    ).toThrow('格位英雄星级必须是 1～4 的整数');
    expect(slots.heroCount).toBe(0);
  });

  it('4星格位单位仍可通过现有释放接口参与未来遣散等非升星操作', () => {
    const slots = new SlotSystem([{ x: 0, y: 0 }], {
      ...BATTLE_CONFIG.summon,
      slotUnlockTiers: [{ successfulSummons: 0, unlockedSlots: 1 }],
    });
    slots.occupyFirstAvailable({
      instanceId: 'maximum-star-hero',
      heroDefinitionId: 'gale-hunter',
      starLevel: 4,
    });
    expect(slots.vacate(0)).toMatchObject({
      instanceId: 'maximum-star-hero',
      starLevel: 4,
    });
    expect(slots.heroCount).toBe(0);
  });
});

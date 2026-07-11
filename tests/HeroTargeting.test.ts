import { describe, expect, it } from 'vitest';

import { isEnemyInHeroAttackArea } from '../src/battle/HeroTargeting';
import { HERO_DEFINITIONS_BY_ID } from '../src/data/heroDefinitions';

interface AttackAreaCase {
  readonly heroId: string;
  readonly minimumProgress: number;
  readonly checks: readonly (readonly [pathProgress: number, expected: boolean])[];
}

const ATTACK_AREA_CASES: readonly AttackAreaCase[] = [
  {
    heroId: 'gale-hunter',
    minimumProgress: 0.05,
    checks: [
      [0, false],
      [0.049, false],
      [0.05, true],
      [0.95, true],
    ],
  },
  {
    heroId: 'ember-mage',
    minimumProgress: 0.2,
    checks: [
      [0.05, false],
      [0.199, false],
      [0.2, true],
      [0.8, true],
    ],
  },
  {
    heroId: 'starlight-priest',
    minimumProgress: 0.35,
    checks: [
      [0.2, false],
      [0.349, false],
      [0.35, true],
      [0.9, true],
    ],
  },
  {
    heroId: 'stone-vanguard',
    minimumProgress: 0.7,
    checks: [
      [0.35, false],
      [0.699, false],
      [0.7, true],
      [1, true],
    ],
  },
];

describe('职业道路攻击区域', () => {
  for (const attackAreaCase of ATTACK_AREA_CASES) {
    it(`${attackAreaCase.heroId} 只攻击配置进度后的目标`, () => {
      const hero = HERO_DEFINITIONS_BY_ID.get(attackAreaCase.heroId);
      expect(hero).toBeDefined();
      if (hero === undefined) {
        return;
      }

      expect(hero.minimumAttackPathProgress).toBe(
        attackAreaCase.minimumProgress,
      );
      for (const [pathProgress, expected] of attackAreaCase.checks) {
        expect(isEnemyInHeroAttackArea(hero, pathProgress)).toBe(expected);
      }
    });
  }
});

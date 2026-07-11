import { describe, expect, it } from 'vitest';

import {
  createCombatStats,
  DEFAULT_COMBAT_STATS,
  getEffectiveAttackIntervalMs,
} from '../src/battle/combat/CombatStats';
import { HERO_DEFINITIONS_BY_ID } from '../src/data/heroDefinitions';

describe('CombatStats', () => {
  it('默认属性合法且不改变基础伤害', () => {
    expect(createCombatStats()).toEqual(DEFAULT_COMBAT_STATS);
    expect(DEFAULT_COMBAT_STATS).toMatchObject({
      attackSpeedMultiplier: 1,
      critChance: 0,
      critDamageMultiplier: 1.8,
      outgoingDamageMultiplier: 1,
      armor: 0,
      resistance: 0,
      damageTakenMultiplier: 1,
    });
  });

  it('拒绝NaN、Infinity和非法负值', () => {
    expect(() => createCombatStats({ attackPower: Number.NaN })).toThrow(
      'attackPower必须是有限数字',
    );
    expect(() =>
      createCombatStats({ resistance: Number.POSITIVE_INFINITY }),
    ).toThrow('resistance必须是有限数字');
    expect(() => createCombatStats({ armor: -1 })).toThrow(
      'armor不能为负数',
    );
    expect(() => createCombatStats({ attackSpeedMultiplier: 0 })).toThrow(
      'attackSpeedMultiplier必须大于0',
    );
  });

  it('按规则限制暴击和穿透百分比', () => {
    expect(createCombatStats({
      critChance: 4,
      critDamageMultiplier: 8,
      armorPenetrationPercent: 2,
      resistancePenetrationPercent: 1.5,
    })).toMatchObject({
      critChance: 0.8,
      critDamageMultiplier: 3,
      armorPenetrationPercent: 1,
      resistancePenetrationPercent: 1,
    });
    expect(createCombatStats({ critDamageMultiplier: 0.5 }).critDamageMultiplier)
      .toBe(1);
    expect(() => createCombatStats({ critChance: -0.1 })).toThrow(
      'critChance不能为负数',
    );
    expect(() =>
      createCombatStats({ armorPenetrationPercent: -0.1 }),
    ).toThrow('armorPenetrationPercent不能为负数');
  });

  it('攻击速度1保持间隔，2使间隔减半，并拒绝非法速度', () => {
    expect(getEffectiveAttackIntervalMs(360, 1)).toBe(360);
    expect(getEffectiveAttackIntervalMs(360, 2)).toBe(180);
    expect(() => getEffectiveAttackIntervalMs(360, 0)).toThrow(
      'attackSpeedMultiplier必须大于0',
    );
    expect(() => getEffectiveAttackIntervalMs(360, -1)).toThrow(
      'attackSpeedMultiplier必须大于0',
    );
  });

  it('疾风猎手基础暴击率10%，其他当前英雄默认0%', () => {
    const gale = HERO_DEFINITIONS_BY_ID.get('gale-hunter');
    expect(createCombatStats(gale?.combatStats).critChance).toBe(0.1);
    for (const heroId of [
      'ember-mage',
      'stone-vanguard',
      'starlight-priest',
    ]) {
      expect(createCombatStats(
        HERO_DEFINITIONS_BY_ID.get(heroId)?.combatStats,
      ).critChance).toBe(0);
    }
  });
});

import { describe, expect, it } from 'vitest';

import {
  aggregateCombatStats,
  type CombatModifier,
} from '../src/battle/combat/CombatModifiers';
import { createCombatStats } from '../src/battle/combat/CombatStats';

describe('CombatModifiers', () => {
  const base = createCombatStats({ attackPower: 100, armor: 20 });

  it('按base→add→multiply→override顺序聚合', () => {
    const result = aggregateCombatStats(base, [
      modifier('add-a', 'attackPower', 'add', 20),
      modifier('multiply-a', 'attackPower', 'multiply', 1.5),
    ]);
    expect(result.stats.attackPower).toBe(180);
    expect(result.details.attackPower).toMatchObject({
      baseValue: 100,
      valueBeforeRules: 180,
      finalValue: 180,
    });

    const overridden = aggregateCombatStats(base, [
      modifier('add-a', 'attackPower', 'add', 20),
      modifier('multiply-a', 'attackPower', 'multiply', 1.5),
      modifier('override-a', 'attackPower', 'override', 77),
    ]);
    expect(overridden.stats.attackPower).toBe(77);
  });

  it('override使用高priority，平局时稳定sourceId较小者优先', () => {
    expect(aggregateCombatStats(base, [
      modifier('low', 'armor', 'override', 10, 1),
      modifier('high', 'armor', 'override', 80, 2),
    ]).stats.armor).toBe(80);
    expect(aggregateCombatStats(base, [
      modifier('z-source', 'armor', 'override', 90, 5),
      modifier('a-source', 'armor', 'override', 40, 5),
    ]).stats.armor).toBe(40);
  });

  it('输入顺序不影响结果且不修改静态基础属性', () => {
    const modifiers = [
      modifier('a', 'attackPower', 'add', 0.1),
      modifier('b', 'attackPower', 'add', 0.2),
      modifier('c', 'attackPower', 'multiply', 1.5),
    ] as const;
    const forward = aggregateCombatStats(base, modifiers).stats;
    const reverse = aggregateCombatStats(base, [...modifiers].reverse()).stats;
    expect(forward).toEqual(reverse);
    expect(base.attackPower).toBe(100);
    expect(Object.isFrozen(base)).toBe(true);
  });

  it('拒绝重复身份和会产生非法最终属性的修改器', () => {
    expect(() => aggregateCombatStats(base, [
      modifier('same', 'armor', 'add', 1),
      modifier('same', 'armor', 'add', 2),
    ])).toThrow('存在重复属性修改器');
    expect(() => aggregateCombatStats(base, [
      modifier('bad', 'attackSpeedMultiplier', 'override', 0),
    ])).toThrow('attackSpeedMultiplier必须大于0');
  });
});

function modifier(
  sourceId: string,
  stat: CombatModifier['stat'],
  operation: CombatModifier['operation'],
  value: number,
  priority = 0,
): CombatModifier {
  return { sourceId, stat, operation, value, priority };
}

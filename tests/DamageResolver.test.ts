import { describe, expect, it } from 'vitest';

import { SeededRandom } from '../src/battle/SeededRandom';
import { DamageApplicationLedger } from '../src/battle/combat/DamageApplication';
import { createCombatStats } from '../src/battle/combat/CombatStats';
import {
  calculateDamageReduction,
  calculateEffectiveDefense,
} from '../src/battle/combat/DamageMitigation';
import type { DamageRequest } from '../src/battle/combat/DamageRequest';
import { resolveDamage, type RandomFloatSource } from '../src/battle/combat/DamageResolver';
import { createDamageTags, type DamageType } from '../src/battle/combat/DamageTypes';
import { getHeroStarDamageMultiplier } from '../src/battle/combat/HeroStarCombat';
import type { HeroStar } from '../src/battle/HeroStar';

class CountingRandom implements RandomFloatSource {
  public calls = 0;
  public constructor(private readonly value: number) {}
  public nextFloat(): number {
    this.calls += 1;
    return this.value;
  }
}

function request(overrides: Partial<DamageRequest> = {}): DamageRequest {
  return {
    requestId: 'damage-1',
    requestSequence: 1,
    source: { kind: 'hero', instanceId: 'hero-1', definitionId: 'hero-a' },
    target: { kind: 'enemy', instanceId: 'enemy-1', definitionId: 'enemy-a' },
    baseAmount: 100,
    damageType: 'physical',
    tags: createDamageTags('basicAttack', 'projectile'),
    canCrit: true,
    simulationTimeMs: 200,
    sourceStar: 1,
    sourceStats: createCombatStats({ attackPower: 100 }),
    targetStats: createCombatStats(),
    targetIsBoss: false,
    targetHpBefore: 1_000,
    ...overrides,
  };
}

describe('DamageResolver 星级、暴击与RNG', () => {
  it('1～4星倍率为1、1.65、2.65、4.10且拒绝第5档', () => {
    expect([1, 2, 3, 4].map((star) =>
      getHeroStarDamageMultiplier(star as HeroStar)))
      .toEqual([1, 1.65, 2.65, 4.1]);
    expect(() => getHeroStarDamageMultiplier(5 as HeroStar)).toThrow(
      '英雄星级必须是 1～4 的整数',
    );
  });

  it('暴击率0、canCrit=false和DoT均不消耗RNG', () => {
    const random = new CountingRandom(0);
    expect(resolveDamage(request(), random).isCritical).toBe(false);
    expect(resolveDamage(request({
      requestId: 'damage-2',
      requestSequence: 2,
      canCrit: false,
      sourceStats: createCombatStats({ critChance: 0.8 }),
    }), random).isCritical).toBe(false);
    expect(resolveDamage(request({
      requestId: 'damage-3',
      requestSequence: 3,
      tags: createDamageTags('dot'),
      sourceStats: createCombatStats({ critChance: 0.8 }),
    }), random).isCritical).toBe(false);
    expect(random.calls).toBe(0);
  });

  it('符合条件的请求只消费一次RNG并正确应用暴击倍率', () => {
    const random = new CountingRandom(0.2);
    const result = resolveDamage(request({
      sourceStats: createCombatStats({
        critChance: 0.5,
        critDamageMultiplier: 1.8,
      }),
    }), random);
    expect(random.calls).toBe(1);
    expect(result).toMatchObject({
      isCritical: true,
      criticalMultiplier: 1.8,
      damageBeforeCritical: 100,
      damageAfterCritical: 180,
      calculatedDamage: 180,
    });
  });

  it('相同combat seed产生相同暴击序列', () => {
    const first = new SeededRandom('same-combat-seed');
    const second = new SeededRandom('same-combat-seed');
    const sourceStats = createCombatStats({ critChance: 0.5 });
    const firstSequence: boolean[] = [];
    const secondSequence: boolean[] = [];
    for (let index = 1; index <= 20; index += 1) {
      const current = request({
        requestId: `damage-${index}`,
        requestSequence: index,
        sourceStats,
      });
      firstSequence.push(resolveDamage(current, first).isCritical);
      secondSequence.push(resolveDamage(current, second).isCritical);
    }
    expect(firstSequence).toEqual(secondSequence);
  });

  it('真实伤害只有显式允许时才进行暴击判定', () => {
    const random = new CountingRandom(0);
    expect(resolveDamage(request({
      damageType: 'true',
      sourceStats: createCombatStats({ critChance: 0.8 }),
    }), random).isCritical).toBe(false);
    expect(random.calls).toBe(0);
    expect(resolveDamage(request({
      requestId: 'damage-2',
      requestSequence: 2,
      damageType: 'true',
      allowTrueDamageCritical: true,
      sourceStats: createCombatStats({ critChance: 0.8 }),
    }), random).isCritical).toBe(true);
    expect(random.calls).toBe(1);
  });

  it('非法请求和已死亡目标在随机消费前失败', () => {
    const random = new CountingRandom(0);
    expect(() => resolveDamage(request({ baseAmount: Number.NaN }), random))
      .toThrow('baseAmount必须是非负有限数字');
    expect(() => resolveDamage(request({ targetHpBefore: 0 }), random))
      .toThrow('已死亡或非法目标不能结算伤害');
    expect(random.calls).toBe(0);
  });
});

describe('DamageResolver 防御、穿透与乘区', () => {
  it('物理读取护甲，四种元素读取抗性', () => {
    const targetStats = createCombatStats({ armor: 100, resistance: 300 });
    expect(resolve('physical', targetStats).damageReduction).toBeCloseTo(0.5);
    for (const type of ['fire', 'ice', 'lightning', 'nature'] as const) {
      expect(resolve(type, targetStats).damageReduction).toBeCloseTo(0.7);
    }
  });

  it('真实伤害绕过护甲抗性但仍受输出倍率和易伤影响', () => {
    const result = resolveDamage(request({
      damageType: 'true',
      sourceStats: createCombatStats({ outgoingDamageMultiplier: 1.5 }),
      targetStats: createCombatStats({
        armor: 10_000,
        resistance: 10_000,
        damageTakenMultiplier: 1.2,
      }),
    }), new CountingRandom(1));
    expect(result).toMatchObject({
      defenseBeforePenetration: 0,
      effectiveDefense: 0,
      damageReduction: 0,
      calculatedDamage: 180,
    });
  });

  it('先百分比穿透再固定穿透且有效防御不低于0', () => {
    expect(calculateEffectiveDefense(200, 0.5, 20)).toBe(80);
    expect(calculateEffectiveDefense(20, 1, 100)).toBe(0);
    expect(calculateDamageReduction(10_000)).toBe(0.7);
  });

  it('护甲穿透不影响元素，抗性穿透不影响物理', () => {
    const sourceStats = createCombatStats({
      armorPenetrationPercent: 1,
      resistancePenetrationPercent: 0,
    });
    const targetStats = createCombatStats({ armor: 100, resistance: 100 });
    expect(resolveDamage(request({ sourceStats, targetStats }), new CountingRandom(1))
      .effectiveDefense).toBe(0);
    expect(resolveDamage(request({
      damageType: 'fire',
      sourceStats,
      targetStats,
    }), new CountingRandom(1)).effectiveDefense).toBe(100);
  });

  it('skill、summon和Boss倍率仅在对应条件应用', () => {
    const sourceStats = createCombatStats({
      skillDamageMultiplier: 2,
      summonDamageMultiplier: 3,
      bossDamageMultiplier: 4,
    });
    expect(resolveDamage(request({ sourceStats }), new CountingRandom(1))
      .calculatedDamage).toBe(100);
    expect(resolveDamage(request({
      sourceStats,
      tags: createDamageTags('skill'),
    }), new CountingRandom(1)).calculatedDamage).toBe(200);
    expect(resolveDamage(request({
      sourceStats,
      tags: createDamageTags('summon'),
    }), new CountingRandom(1)).calculatedDamage).toBe(300);
    expect(resolveDamage(request({
      sourceStats,
      targetIsBoss: true,
    }), new CountingRandom(1)).calculatedDamage).toBe(400);
  });

  it('暴击先于防御减伤，最后应用damageTakenMultiplier', () => {
    const result = resolveDamage(request({
      sourceStats: createCombatStats({
        critChance: 0.8,
        critDamageMultiplier: 2,
      }),
      targetStats: createCombatStats({
        armor: 100,
        damageTakenMultiplier: 1.5,
      }),
    }), new CountingRandom(0));
    expect(result.damageAfterCritical).toBe(200);
    expect(result.mitigatedDamage).toBe(100);
    expect(result.calculatedDamage).toBe(150);
  });
});

describe('DamageResult与应用', () => {
  it('区分计算、实际、溢出和致死伤害，HP不低于0', () => {
    const result = resolveDamage(request({ targetHpBefore: 60 }), new CountingRandom(1));
    expect(result).toMatchObject({
      calculatedDamage: 100,
      appliedDamage: 60,
      overkillDamage: 40,
      targetHpBefore: 60,
      targetHpAfter: 0,
      isLethal: true,
    });
  });

  it('同一结果只应用一次且已死亡目标不再应用', () => {
    const result = resolveDamage(request(), new CountingRandom(1));
    const ledger = new DamageApplicationLedger();
    const target = { id: 'enemy-1', health: 1_000 };
    expect(ledger.apply(result, target)).toBe(true);
    expect(target.health).toBe(900);
    expect(() => ledger.apply(result, target)).toThrow('不能重复应用');

    const deadTarget = { id: 'enemy-1', health: 0 };
    const freshLedger = new DamageApplicationLedger();
    expect(freshLedger.apply(result, deadTarget)).toBe(false);
    expect(freshLedger.appliedCount).toBe(0);
  });

  it('重置清空应用身份，不保留旧局应用记录', () => {
    const result = resolveDamage(request(), new CountingRandom(1));
    const ledger = new DamageApplicationLedger();
    const target = { id: 'enemy-1', health: 1_000 };
    ledger.apply(result, target);
    ledger.reset();
    expect(ledger.appliedCount).toBe(0);
  });
});

function resolve(
  damageType: DamageType,
  targetStats = createCombatStats(),
) {
  return resolveDamage(
    request({ damageType, targetStats }),
    new CountingRandom(1),
  );
}

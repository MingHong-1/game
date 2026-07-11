import { describe, expect, it } from 'vitest';

import { BattleSimulation } from '../src/battle/BattleSimulation';
import { BattleState } from '../src/battle/BattleState';
import type {
  BattleConfig,
  EnemyDefinition,
  HeroDefinition,
  LevelDefinition,
} from '../src/battle/definitions';
import type { DamageAppliedBattleEvent } from '../src/battle/BattleEvents';

const CONFIG: BattleConfig = {
  fixedStepMs: 20,
  maxFrameDeltaMs: 250,
  defaultTimeScale: 1,
  supportedTimeScales: [1, 2],
  projectileRadius: 4,
  energy: { initialEnergy: 15 },
  summon: {
    heroCopiesPerBag: 2,
    initialStarLevel: 1,
    costTiers: [{ minSuccessfulSummons: 0, cost: 5 }],
    slotUnlockTiers: [{ successfulSummons: 0, unlockedSlots: 1 }],
  },
};

const HERO: HeroDefinition = {
  id: 'damage-hero',
  name: '伤害测试英雄',
  role: 'marksman',
  color: 0xffffff,
  radius: 10,
  attackDamage: 25,
  attackIntervalMs: 100,
  minimumAttackPathProgress: 0,
  projectileSpeed: 1_000_000,
  projectileColor: 0xffffff,
  targeting: 'closest-to-core',
};

const ENEMY: EnemyDefinition = {
  id: 'damage-boss',
  name: '伤害测试Boss',
  kind: 'boss',
  color: 0xff0000,
  maxHealth: 60,
  traversalTimeSeconds: 100,
  coreDamage: 100,
  killEnergyReward: 0,
  radius: 10,
};

function level(enemyId = ENEMY.id): LevelDefinition {
  return {
    id: 'damage-level',
    name: '伤害测试关卡',
    defaultSeed: 'damage-seed',
    coreMaxHealth: 100,
    coreRadius: 20,
    coreColor: 0xffffff,
    initialPreparationSeconds: 0,
    wavePreviewSeconds: 0,
    path: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    laneLayout: {
      laneCount: 3,
      corridorWidthStart: 90,
      corridorWidthMiddle: 80,
      corridorWidthEnd: 60,
      laneSpacing: 20,
      localJitter: 0,
    },
    heroPool: [HERO.id],
    heroSlots: [{ x: 0, y: 0 }],
    waves: [{
      id: 'damage-wave',
      startTimeMs: 0,
      completionEnergyReward: 0,
      preview: { title: '伤害', threat: 'boss', formation: '中央' },
      spawns: [{
        enemyPool: [enemyId],
        count: 1,
        intervalMs: 0,
        startDelayMs: 0,
        laneMode: 'center-assault',
      }],
    }],
  };
}

function createBattle(
  hero: HeroDefinition = HERO,
  enemy: EnemyDefinition = ENEMY,
  seed = 'damage-seed',
): BattleSimulation {
  const battle = new BattleSimulation({
    config: CONFIG,
    level: level(enemy.id),
    heroDefinitions: new Map([[hero.id, hero]]),
    enemyDefinitions: new Map([[enemy.id, enemy]]),
    seed,
  });
  battle.addHero('hero-1', hero.id, { x: 0, y: 0 });
  return battle;
}

describe('当前基础攻击接入统一伤害内核', () => {
  it('保持100ms攻击间隔、原弹道命中节奏和目标，并稳定派发伤害后死亡事件', () => {
    const battle = createBattle();
    battle.start();
    for (let step = 0; step < 11; step += 1) battle.update(20);

    const events = battle.drainEvents();
    const attacks = events.filter((event) => event.type === 'hero-attacked');
    const damages = events.filter(
      (event): event is DamageAppliedBattleEvent => event.type === 'damage-applied',
    );
    const kills = events.filter((event) => event.type === 'enemy-killed');
    expect(attacks).toHaveLength(3);
    expect(damages.map((event) => event.result.simulationTimeMs))
      .toEqual([20, 100, 200]);
    expect(damages.map((event) => event.result.baseDamage))
      .toEqual([25, 25, 25]);
    expect(damages[0]?.result).toMatchObject({
      damageType: 'physical',
      tags: ['basicAttack', 'projectile'],
      calculatedDamage: 25,
      isCritical: false,
      isLethal: false,
    });
    expect(damages[2]?.result).toMatchObject({
      appliedDamage: 10,
      overkillDamage: 15,
      targetHpAfter: 0,
      isLethal: true,
    });
    expect(kills).toHaveLength(1);
    expect(events.findIndex((event) => event.type === 'damage-applied'))
      .toBeLessThan(events.findIndex((event) => event.type === 'enemy-killed'));
    expect(battle.state).toBe(BattleState.Victory);
  });

  it('两个弹道同tick命中时死亡只结算一次，后续弹道不消费有效伤害', () => {
    const lethalHero = { ...HERO, attackDamage: 100 };
    const battle = createBattle(lethalHero);
    battle.addHero('hero-2', lethalHero.id, { x: 0, y: 0 });
    battle.start();
    battle.update(20);

    const events = battle.drainEvents();
    expect(events.filter((event) => event.type === 'damage-applied')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'enemy-killed')).toHaveLength(1);
    expect(battle.getSnapshot().enemies).toHaveLength(0);
  });

  it('4星基础攻击正式使用4.10倍率', () => {
    const durableEnemy = { ...ENEMY, maxHealth: 1_000 };
    const battle = new BattleSimulation({
      config: CONFIG,
      level: level(durableEnemy.id),
      heroDefinitions: new Map([[HERO.id, HERO]]),
      enemyDefinitions: new Map([[durableEnemy.id, durableEnemy]]),
    });
    battle.addHero('hero-1', HERO.id, { x: 0, y: 0 }, 4);
    battle.start();
    battle.update(20);
    const damage = battle.drainEvents().find(
      (event): event is DamageAppliedBattleEvent => event.type === 'damage-applied',
    );
    expect(damage?.result.starDamageMultiplier).toBe(4.1);
    expect(damage?.result.calculatedDamage).toBeCloseTo(102.5);
  });

  it('可配置元素类型读取抗性，缺少类型安全默认physical', () => {
    const resistantEnemy = {
      ...ENEMY,
      maxHealth: 1_000,
      combatStats: { armor: 0, resistance: 100 },
    };
    const physical = createBattle(HERO, resistantEnemy);
    physical.start();
    physical.update(20);
    const physicalDamage = getFirstDamage(physical);
    expect(physicalDamage.result.damageType).toBe('physical');
    expect(physicalDamage.result.calculatedDamage).toBe(25);

    const fire = createBattle({ ...HERO, damageType: 'fire' }, resistantEnemy);
    fire.start();
    fire.update(20);
    const fireDamage = getFirstDamage(fire);
    expect(fireDamage.result.damageType).toBe('fire');
    expect(fireDamage.result.calculatedDamage).toBe(12.5);
  });

  it('同seed重置后恢复相同combatRng暴击序列和requestId', () => {
    const criticalHero = {
      ...HERO,
      attackIntervalMs: 20,
      combatStats: { critChance: 0.5 },
    };
    const durableEnemy = { ...ENEMY, maxHealth: 10_000 };
    const battle = createBattle(criticalHero, durableEnemy, 'repeat-damage');

    const run = (): readonly [readonly boolean[], readonly string[]] => {
      battle.start();
      for (let step = 0; step < 10; step += 1) battle.update(20);
      const damages = battle.drainEvents().filter(
        (event): event is DamageAppliedBattleEvent => event.type === 'damage-applied',
      );
      return [
        damages.map((event) => event.result.isCritical),
        damages.map((event) => event.result.requestId),
      ];
    };

    const first = run();
    battle.reset('repeat-damage');
    battle.addHero('hero-1', criticalHero.id, { x: 0, y: 0 });
    const second = run();
    expect(second).toEqual(first);
  });

  it('重置清空旧弹道、伤害事件和请求序列', () => {
    const battle = createBattle();
    battle.start();
    battle.update(20);
    battle.reset();
    expect(battle.drainEvents()).toEqual([]);
    expect(battle.getSnapshot().projectiles).toEqual([]);
    battle.addHero('hero-1', HERO.id, { x: 0, y: 0 });
    battle.start();
    battle.update(20);
    expect(getFirstDamage(battle).result.requestId).toBe('damage-1');
  });
});

function getFirstDamage(battle: BattleSimulation): DamageAppliedBattleEvent {
  const event = battle.drainEvents().find(
    (candidate): candidate is DamageAppliedBattleEvent =>
      candidate.type === 'damage-applied',
  );
  if (event === undefined) throw new Error('测试未产生伤害事件');
  return event;
}

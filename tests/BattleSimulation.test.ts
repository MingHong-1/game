import { describe, expect, it } from 'vitest';

import {
  BattleSimulation,
  type BattleSimulationOptions,
} from '../src/battle/BattleSimulation';
import { BattleState } from '../src/battle/BattleState';
import type {
  BattleConfig,
  EnemyDefinition,
  HeroDefinition,
  LevelDefinition,
} from '../src/battle/definitions';
import { MIN_HERO_STAR, type HeroStar } from '../src/battle/HeroStar';
import { BATTLE_CONFIG } from '../src/data/battleConfig';
import { ENEMY_DEFINITIONS_BY_ID } from '../src/data/enemyDefinitions';
import { HERO_DEFINITIONS_BY_ID } from '../src/data/heroDefinitions';
import { PROTOTYPE_LEVEL } from '../src/data/levelDefinitions';

const TEST_CONFIG: BattleConfig = {
  fixedStepMs: 20,
  maxFrameDeltaMs: 1_000,
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

const TEST_BOSS: EnemyDefinition = {
  id: 'test-boss',
  name: '测试 Boss',
  kind: 'boss',
  color: 0xff0000,
  maxHealth: 50,
  traversalTimeSeconds: 0.5,
  coreDamage: 50,
  killEnergyReward: 0,
  radius: 10,
};

const TEST_HERO: HeroDefinition = {
  id: 'test-hero',
  name: '测试英雄',
  role: 'marksman',
  color: 0x00ffff,
  radius: 12,
  attackDamage: 100,
  attackIntervalMs: 100,
  minimumAttackPathProgress: 0,
  projectileSpeed: 1_000,
  projectileColor: 0xffffff,
  targeting: 'closest-to-core',
};

function createTestLevel(withHero: boolean): LevelDefinition {
  return {
    id: withHero ? 'victory-level' : 'defeat-level',
    name: '测试关卡',
    defaultSeed: 'test-seed',
    coreMaxHealth: 50,
    coreRadius: 20,
    coreColor: 0x00ffff,
    initialPreparationSeconds: 0,
    wavePreviewSeconds: 0,
    path: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    laneLayout: {
      laneCount: 5,
      corridorWidthStart: 100,
      corridorWidthMiddle: 80,
      corridorWidthEnd: 50,
      laneSpacing: 18,
      localJitter: 2,
    },
    heroPool: withHero ? [TEST_HERO.id] : [],
    heroSlots: [{ x: 0, y: 0 }],
    waves: [
      {
        id: 'boss-wave',
        startTimeMs: 0,
        completionEnergyReward: 2,
        preview: { title: 'Boss 波', threat: 'boss', formation: '中央' },
        spawns: [
          {
            enemyPool: [TEST_BOSS.id],
            count: 1,
            intervalMs: 0,
            startDelayMs: 0,
          },
        ],
      },
    ],
  };
}

function createTestSimulation(
  withHero: boolean,
  starLevel: HeroStar = MIN_HERO_STAR,
): BattleSimulation {
  const heroDefinitions = withHero
    ? new Map([[TEST_HERO.id, TEST_HERO]])
    : new Map<string, HeroDefinition>();

  const battle = new BattleSimulation({
    config: TEST_CONFIG,
    level: createTestLevel(withHero),
    heroDefinitions,
    enemyDefinitions: new Map([[TEST_BOSS.id, TEST_BOSS]]),
  });
  if (withHero) {
    battle.addHero('test-hero-1', TEST_HERO.id, { x: 0, y: 0 }, starLevel);
  }
  return battle;
}

function createPrototypeSimulation(seed = 'prototype-test'): BattleSimulation {
  const battle = new BattleSimulation({
    config: BATTLE_CONFIG,
    level: PROTOTYPE_LEVEL,
    heroDefinitions: HERO_DEFINITIONS_BY_ID,
    enemyDefinitions: ENEMY_DEFINITIONS_BY_ID,
    seed,
  });
  PROTOTYPE_LEVEL.heroPool.slice(0, 4).forEach((heroId, index) => {
    const position = PROTOTYPE_LEVEL.heroSlots[index];
    if (position !== undefined) {
      battle.addHero(
        `prototype-hero-${index + 1}`,
        heroId,
        position,
      );
    }
  });
  return battle;
}

describe('BattleSimulation', () => {
  it('暂停和技能选择期间完全停止模拟时间', () => {
    const battle = createPrototypeSimulation();
    battle.start();
    battle.update(250);
    const runningTime = battle.getSnapshot().elapsedMs;

    expect(battle.pause()).toBe(true);
    battle.update(1_000);
    expect(battle.getSnapshot().elapsedMs).toBe(runningTime);

    expect(battle.resume()).toBe(true);
    expect(battle.openSkillSelection()).toBe(true);
    battle.update(1_000);
    expect(battle.getSnapshot().elapsedMs).toBe(runningTime);

    expect(battle.closeSkillSelection()).toBe(true);
    battle.update(20);
    expect(battle.getSnapshot().elapsedMs).toBeGreaterThan(runningTime);
  });

  it('2 倍速在相同真实时间内推进两倍模拟步数', () => {
    const oneX = createPrototypeSimulation('speed-seed');
    const twoX = createPrototypeSimulation('speed-seed');
    oneX.start();
    twoX.start();
    twoX.setTimeScale(2);

    for (let frame = 0; frame < 10; frame += 1) {
      oneX.update(20);
      twoX.update(20);
    }

    expect(oneX.getSnapshot().elapsedMs).toBe(200);
    expect(twoX.getSnapshot().elapsedMs).toBe(400);
  });

  it('同一种子和输入序列得到相同战斗快照', () => {
    const first = createPrototypeSimulation('same-battle-seed');
    const second = createPrototypeSimulation('same-battle-seed');
    first.start();
    second.start();

    for (const delta of [16, 33, 120, 41, 250, 80, 17, 200]) {
      first.update(delta);
      second.update(delta);
    }

    expect(first.getSnapshot()).toEqual(second.getSnapshot());
  });

  it('Boss 死亡后进入胜利状态', () => {
    const battle = createTestSimulation(true);
    battle.start();
    battle.update(40);

    expect(battle.state).toBe(BattleState.Victory);
    expect(battle.getSnapshot().enemies).toHaveLength(0);
  });

  it('4星英雄保持正常攻击且快照标记为满星领域值', () => {
    const battle = createTestSimulation(true, 4);
    battle.start();
    battle.update(40);

    expect(battle.state).toBe(BattleState.Victory);
    expect(battle.getSnapshot().heroes[0]?.starLevel).toBe(4);
  });

  it('战斗运行时拒绝非法5星英雄', () => {
    const battle = createTestSimulation(false);
    expect(() =>
      battle.addHero(
        'illegal-five-star',
        TEST_HERO.id,
        { x: 0, y: 0 },
        5 as HeroStar,
      ),
    ).toThrow('战斗英雄星级必须是 1～4 的整数');
    expect(battle.getSnapshot().heroes).toHaveLength(0);
  });

  it('敌人抵达星核并将生命扣至零后失败', () => {
    const battle = createTestSimulation(false);
    battle.start();
    for (let frame = 0; frame < 30; frame += 1) battle.update(20);

    expect(battle.state).toBe(BattleState.Defeat);
    expect(battle.getSnapshot().coreHealth).toBe(0);
  });

  it('原型关卡可以在固定配置下完整胜利', () => {
    const battle = createPrototypeSimulation(PROTOTYPE_LEVEL.defaultSeed);
    battle.start();
    battle.setTimeScale(2);

    for (
      let frame = 0;
      frame < 2_000 && battle.state === BattleState.Running;
      frame += 1
    ) {
      battle.update(50);
    }

    expect(battle.state).toBe(BattleState.Victory);
    expect(battle.getSnapshot().coreHealth).toBeGreaterThan(0);
  });

  it('格位坐标不影响索敌，并优先攻击道路进度最大的合法目标', () => {
    const priorityHero: HeroDefinition = {
      ...TEST_HERO,
      id: 'priority-hero',
      projectileSpeed: 1_000_000,
    };
    const slowBoss: EnemyDefinition = {
      ...TEST_BOSS,
      id: 'slow-boss',
      traversalTimeSeconds: 5,
    };
    const fastBoss: EnemyDefinition = {
      ...TEST_BOSS,
      id: 'fast-boss',
      traversalTimeSeconds: 2,
    };
    const level: LevelDefinition = {
      ...createTestLevel(true),
      id: 'target-priority-level',
      heroPool: [priorityHero.id],
      waves: [
        {
          id: 'priority-wave',
          startTimeMs: 0,
          completionEnergyReward: 0,
          preview: { title: '优先级', threat: 'boss', formation: '测试' },
          spawns: [slowBoss, fastBoss].map((enemy) => ({
            enemyPool: [enemy.id],
            count: 1,
            intervalMs: 0,
            startDelayMs: 0,
          })),
        },
      ],
    };
    const battle = new BattleSimulation({
      config: TEST_CONFIG,
      level,
      heroDefinitions: new Map([[priorityHero.id, priorityHero]]),
      enemyDefinitions: new Map([
        [slowBoss.id, slowBoss],
        [fastBoss.id, fastBoss],
      ]),
    });
    battle.start();
    battle.update(100);
    battle.addHero('far-away-visual-slot', priorityHero.id, {
      x: 10_000,
      y: 10_000,
    });
    battle.update(20);

    expect(battle.drainEvents()).toContainEqual(
      expect.objectContaining({
        type: 'enemy-killed',
        enemyDefinitionId: fastBoss.id,
      }),
    );
    expect(battle.state).toBe(BattleState.Victory);
  });

  it('重置后清空单局对象、时间和结果状态', () => {
    const battle = createTestSimulation(true);
    battle.start();
    battle.update(40);
    expect(battle.state).toBe(BattleState.Victory);

    battle.reset();
    const snapshot = battle.getSnapshot();

    expect(snapshot.state).toBe(BattleState.Ready);
    expect(snapshot.elapsedMs).toBe(0);
    expect(snapshot.enemies).toHaveLength(0);
    expect(snapshot.projectiles).toHaveLength(0);
    expect(snapshot.coreHealth).toBe(snapshot.coreMaxHealth);
  });

  it('同屏生成至少 30 个多通道敌人时模拟与重置保持稳定', () => {
    const crowdEnemy: EnemyDefinition = {
      ...TEST_BOSS,
      id: 'crowd-enemy',
      name: '怪潮单位',
      kind: 'normal',
      maxHealth: 1_000,
      traversalTimeSeconds: 100,
      coreDamage: 1,
    };
    const level: LevelDefinition = {
      ...createTestLevel(false),
      id: 'crowd-level',
      waves: [
        {
          id: 'crowd-wave',
          startTimeMs: 0,
          completionEnergyReward: 0,
          preview: { title: '怪潮', threat: 'horde', formation: '全线' },
          spawns: [{
            enemyPool: [crowdEnemy.id],
            count: 30,
            intervalMs: 20,
            startDelayMs: 0,
            laneMode: 'full-line',
            spawnFormation: 'line',
          }],
        },
        {
          id: 'future-boss-wave',
          startTimeMs: 100_000,
          completionEnergyReward: 0,
          preview: { title: 'Boss 波', threat: 'boss', formation: '中央' },
          spawns: [{
            enemyPool: [TEST_BOSS.id],
            count: 1,
            intervalMs: 0,
            startDelayMs: 0,
            laneMode: 'boss-center-wings',
          }],
        },
      ],
    };
    const battle = new BattleSimulation({
      config: TEST_CONFIG,
      level,
      heroDefinitions: new Map(),
      enemyDefinitions: new Map([
        [crowdEnemy.id, crowdEnemy],
        [TEST_BOSS.id, TEST_BOSS],
      ]),
      seed: 'crowd-seed',
    });
    battle.start();
    battle.update(120);
    const snapshot = battle.getSnapshot();
    expect(snapshot.enemies).toHaveLength(30);
    expect(new Set(snapshot.enemies.map((enemy) => enemy.laneIndex)).size).toBe(5);
    expect(snapshot.enemies.every((enemy) => Number.isFinite(enemy.x) && Number.isFinite(enemy.y)))
      .toBe(true);

    battle.reset();
    expect(battle.getSnapshot().enemies).toHaveLength(0);
    expect(battle.getSnapshot().state).toBe(BattleState.Ready);
  });

  it('缺失敌人配置时拒绝启动半配置战斗', () => {
    const options: BattleSimulationOptions = {
      config: TEST_CONFIG,
      level: createTestLevel(false),
      heroDefinitions: new Map(),
      enemyDefinitions: new Map(),
    };

    expect(() => new BattleSimulation(options)).toThrow(
      '波次引用了未知敌人',
    );
  });
});

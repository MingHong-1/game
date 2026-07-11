import { describe, expect, it } from 'vitest';

import {
  BattleSimulation,
  MAX_SIMULATION_STEPS_PER_FRAME,
} from '../src/battle/BattleSimulation';
import { BattleState } from '../src/battle/BattleState';
import {
  getInterpolationAlpha,
  interpolateNumber,
} from '../src/battle/RenderInterpolation';
import type {
  BattleConfig,
  EnemyDefinition,
  HeroDefinition,
  LevelDefinition,
} from '../src/battle/definitions';

const TEST_CONFIG: BattleConfig = {
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

const MOVING_ENEMY: EnemyDefinition = {
  id: 'interpolation-enemy',
  name: '插值测试敌人',
  kind: 'normal',
  color: 0xffffff,
  maxHealth: 10_000,
  traversalTimeSeconds: 10,
  coreDamage: 1,
  killEnergyReward: 0,
  radius: 10,
};

const FUTURE_BOSS: EnemyDefinition = {
  ...MOVING_ENEMY,
  id: 'interpolation-boss',
  name: '插值测试 Boss',
  kind: 'boss',
  traversalTimeSeconds: 45,
};

const TEST_HERO: HeroDefinition = {
  id: 'interpolation-hero',
  name: '插值测试英雄',
  role: 'marksman',
  color: 0x00ffff,
  radius: 10,
  attackDamage: 1,
  attackIntervalMs: 1_000,
  minimumAttackPathProgress: 0,
  projectileSpeed: 100,
  projectileColor: 0xffffff,
  targeting: 'closest-to-core',
};

function createLevel(
  enemy: EnemyDefinition = MOVING_ENEMY,
): LevelDefinition {
  return {
    id: 'render-interpolation-level',
    name: '渲染插值测试',
    defaultSeed: 'render-seed',
    coreMaxHealth: 100,
    coreRadius: 20,
    coreColor: 0x00ffff,
    initialPreparationSeconds: 0,
    wavePreviewSeconds: 0,
    path: [
      { x: 100, y: 0 },
      { x: 180, y: 220 },
      { x: 80, y: 500 },
    ],
    laneLayout: {
      laneCount: 5,
      corridorWidthStart: 240,
      corridorWidthMiddle: 200,
      corridorWidthEnd: 140,
      laneSpacing: 34,
      localJitter: 6,
    },
    heroPool: [TEST_HERO.id],
    heroSlots: [{ x: 100, y: 600 }],
    waves: [
      {
        id: 'moving-wave',
        startTimeMs: 0,
        completionEnergyReward: 0,
        preview: { title: '移动波', threat: 'normal', formation: '随机' },
        spawns: [
          {
            enemyPool: [enemy.id],
            count: 1,
            intervalMs: 0,
            startDelayMs: 0,
            laneMode: 'random',
          },
        ],
      },
      ...(enemy.kind === 'boss'
        ? []
        : [
            {
              id: 'future-boss-wave',
              startTimeMs: 100_000,
              completionEnergyReward: 0,
              preview: {
                title: '未来 Boss',
                threat: 'boss' as const,
                formation: '中央',
              },
              spawns: [
                {
                  enemyPool: [FUTURE_BOSS.id],
                  count: 1,
                  intervalMs: 0,
                  startDelayMs: 0,
                  laneMode: 'boss-center-wings' as const,
                },
              ],
            },
          ]),
    ],
  };
}

function createBattle(enemy: EnemyDefinition = MOVING_ENEMY): BattleSimulation {
  return new BattleSimulation({
    config: TEST_CONFIG,
    level: createLevel(enemy),
    heroDefinitions: new Map([[TEST_HERO.id, TEST_HERO]]),
    enemyDefinitions: new Map([
      [enemy.id, enemy],
      [FUTURE_BOSS.id, FUTURE_BOSS],
    ]),
    seed: 'render-seed',
  });
}

function driveOneSecond(
  battle: BattleSimulation,
  framePattern: readonly number[],
): void {
  const patternDuration = framePattern.reduce((sum, delta) => sum + delta, 0);
  if (1_000 % patternDuration !== 0) {
    throw new Error('测试帧模式必须整除 1 秒');
  }
  for (let repeat = 0; repeat < 1_000 / patternDuration; repeat += 1) {
    for (const delta of framePattern) battle.update(delta);
  }
}

function logicState(battle: BattleSimulation): object {
  const snapshot = battle.getSnapshot();
  return {
    state: snapshot.state,
    elapsedMs: snapshot.elapsedMs,
    coreHealth: snapshot.coreHealth,
    pendingSpawnCount: snapshot.pendingSpawnCount,
    enemies: snapshot.enemies.map((enemy) => ({
      id: enemy.id,
      pathProgress: enemy.pathProgress,
      laneIndex: enemy.laneIndex,
      laneOffset: enemy.laneOffset,
      health: enemy.health,
    })),
    projectiles: snapshot.projectiles.map((projectile) => ({
      id: projectile.id,
      x: projectile.x,
      y: projectile.y,
    })),
  };
}

function expectRenderedProgressMonotonic(
  battle: BattleSimulation,
  frameDeltas: readonly number[],
): void {
  let lastRenderedProgress = -Infinity;
  for (const delta of frameDeltas) {
    battle.update(delta);
    const enemy = battle.getSnapshot().enemies[0];
    if (enemy === undefined) continue;
    expect(enemy.pathProgress).toBeGreaterThanOrEqual(
      enemy.previousPathProgress - 1e-6,
    );
    expect(enemy.renderPathProgress).toBeGreaterThanOrEqual(
      lastRenderedProgress - 1e-6,
    );
    lastRenderedProgress = enemy.renderPathProgress;
  }
}

describe('固定步长渲染插值', () => {
  it('30Hz、60Hz、120Hz 驱动在相同真实时间得到相同逻辑状态', () => {
    const thirty = createBattle();
    const sixty = createBattle();
    const oneTwenty = createBattle();
    for (const battle of [thirty, sixty, oneTwenty]) battle.start();

    for (let second = 0; second < 6; second += 1) {
      driveOneSecond(thirty, [33, 33, 34]);
      driveOneSecond(sixty, [16, 17, 17]);
      driveOneSecond(oneTwenty, [8, 8, 9]);
    }

    expect(logicState(sixty)).toEqual(logicState(thirty));
    expect(logicState(oneTwenty)).toEqual(logicState(thirty));
  });

  it('30Hz、60Hz、100Hz、120Hz 渲染节奏下显示进度均单调不减', () => {
    for (const pattern of [
      [33, 33, 34],
      [16, 17, 17],
      [10],
      [8, 8, 9],
    ]) {
      const battle = createBattle();
      battle.start();
      expectRenderedProgressMonotonic(
        battle,
        Array.from({ length: 40 }, (_, index) =>
          pattern[index % pattern.length] ?? 10,
        ),
      );
    }
  });

  it('混合短帧与长帧序列不会让同一敌人的显示进度回退', () => {
    const battle = createBattle();
    battle.start();
    expectRenderedProgressMonotonic(
      battle,
      [8, 9, 24, 5, 80, 7, 120, 9],
    );
  });

  it('alpha 始终位于 0～1，数值插值位于前后状态之间', () => {
    expect(getInterpolationAlpha(0, 20)).toBe(0);
    expect(getInterpolationAlpha(5, 20)).toBe(0.25);
    expect(getInterpolationAlpha(25, 20)).toBe(1);
    expect(interpolateNumber(10, 30, 0.25)).toBe(15);
    expect(() => interpolateNumber(0, 1, 1.1)).toThrow('alpha 位于 0～1');
  });

  it('敌人沿曲线路径使用 previous/current progress 插值且不改变权威进度', () => {
    const battle = createBattle();
    battle.start();
    battle.update(25);
    const enemy = battle.getSnapshot().enemies[0];
    expect(enemy).toBeDefined();
    if (enemy === undefined) return;

    expect(enemy.previousPathProgress).toBe(0);
    expect(enemy.renderPathProgress).toBeGreaterThanOrEqual(
      enemy.previousPathProgress,
    );
    expect(enemy.renderPathProgress).toBeLessThanOrEqual(enemy.pathProgress);
    expect(enemy.pathProgress).toBeCloseTo(0.002);
    const fullDistance = Math.hypot(
      enemy.x - enemy.previousX,
      enemy.y - enemy.previousY,
    );
    expect(Math.hypot(
      enemy.renderX - enemy.previousX,
      enemy.renderY - enemy.previousY,
    )).toBeLessThanOrEqual(fullDistance + 1e-9);
    expect(Math.hypot(
      enemy.x - enemy.renderX,
      enemy.y - enemy.renderY,
    )).toBeLessThanOrEqual(fullDistance + 1e-9);
  });

  it('新生成敌人从入口附近开始插值，不使用画面外旧位置', () => {
    const battle = createBattle();
    battle.start();
    battle.update(25);
    const enemy = battle.getSnapshot().enemies[0];
    expect(enemy?.previousPathProgress).toBe(0);
    expect(enemy?.renderPathProgress).toBeGreaterThanOrEqual(0);
    expect(enemy?.renderPathProgress).toBeLessThanOrEqual(
      enemy?.pathProgress ?? -1,
    );
  });

  it('追踪弹道保存前后位置并只对显示坐标插值', () => {
    const battle = createBattle();
    battle.addHero('render-hero', TEST_HERO.id, { x: 100, y: 600 });
    battle.start();
    battle.update(20);
    battle.update(10);
    const projectile = battle.getSnapshot().projectiles[0];
    expect(projectile).toBeDefined();
    if (projectile === undefined) return;

    expect(projectile.renderX).toBeCloseTo(
      (projectile.previousX + projectile.x) / 2,
    );
    expect(projectile.renderY).toBeCloseTo(
      (projectile.previousY + projectile.y) / 2,
    );
  });

  it('敌人死亡或抵达后立即从快照移除，不残留插值对象', () => {
    const arrivingBoss: EnemyDefinition = {
      ...FUTURE_BOSS,
      id: 'arriving-boss',
      traversalTimeSeconds: 0.04,
    };
    const battle = createBattle(arrivingBoss);
    battle.start();
    battle.update(40);
    expect(battle.getSnapshot().enemies).toHaveLength(0);
  });

  it('暂停期间逻辑位置和显示位置都不继续推进', () => {
    const battle = createBattle();
    battle.start();
    battle.update(25);
    const before = battle.getSnapshot().enemies[0];
    battle.pause();
    battle.update(1_000);
    const paused = battle.getSnapshot().enemies[0];
    expect(paused?.pathProgress).toBe(before?.pathProgress);
    expect(paused?.renderX).toBe(before?.renderX);
    expect(paused?.renderY).toBe(before?.renderY);
  });

  it('2 倍速保持固定步长并产生正确逻辑时间', () => {
    const battle = createBattle();
    battle.setTimeScale(2);
    battle.start();
    for (let frame = 0; frame < 50; frame += 1) battle.update(20);
    expect(battle.getSnapshot().elapsedMs).toBe(2_000);
    expect(battle.getSnapshot().enemies[0]?.pathProgress).toBeCloseTo(0.2);
  });

  it('visibility 恢复后忽略首帧 delta，不追赶后台停留时间', () => {
    const battle = createBattle();
    battle.start();
    battle.update(20);
    const beforeSuspend = battle.getSnapshot().elapsedMs;
    const beforeRendered = battle.getSnapshot().enemies[0]?.renderPathProgress;
    battle.setFrameInputSuspended(true);
    battle.update(5_000);
    battle.setFrameInputSuspended(false);
    battle.update(5_000);
    expect(battle.getSnapshot().elapsedMs).toBe(beforeSuspend);

    battle.update(20);
    const resumed = battle.getSnapshot();
    expect(resumed.elapsedMs).toBe(beforeSuspend + 20);
    expect(resumed.frameDiagnostics.visibilityResyncCount).toBe(1);
    expect(resumed.enemies[0]?.renderPathProgress).toBeGreaterThanOrEqual(
      beforeRendered ?? 0,
    );
  });

  it('长帧最多执行固定步数并记录丢弃的追赶时间', () => {
    const battle = createBattle();
    battle.start();
    battle.update(1_000);
    const snapshot = battle.getSnapshot();
    expect(snapshot.elapsedMs).toBe(
      TEST_CONFIG.fixedStepMs * MAX_SIMULATION_STEPS_PER_FRAME,
    );
    expect(snapshot.frameDiagnostics).toMatchObject({
      maxSimulationStepsPerFrame: 5,
      maxAccumulatedTimeMs: 100,
      simulationStepsLastFrame: 5,
      interpolationAlpha: 0,
      droppedSimulationTimeLastFrameMs: 900,
      droppedSimulationTimeMs: 900,
      longFramesOver33Ms: 1,
      longFramesOver50Ms: 1,
      longFramesOver100Ms: 1,
    });
    const enemy = snapshot.enemies[0];
    expect(enemy?.previousPathProgress).toBe(enemy?.pathProgress);
    expect(enemy?.renderPathProgress).toBe(enemy?.pathProgress);
  });

  it('暂停恢复和 1×/2×切换都不会让显示进度回退', () => {
    const battle = createBattle();
    battle.start();
    expectRenderedProgressMonotonic(battle, [20, 9, 11]);
    const beforePause = battle.getSnapshot().enemies[0]?.renderPathProgress ?? 0;
    battle.pause();
    battle.update(200);
    expect(battle.getSnapshot().enemies[0]?.renderPathProgress).toBe(beforePause);
    battle.resume();
    battle.setTimeScale(2);
    expectRenderedProgressMonotonic(battle, [7, 13, 25, 5]);
    battle.setTimeScale(1);
    expectRenderedProgressMonotonic(battle, [19, 1, 16]);
  });

  it('相同 run seed 和输入仍然完整复现逻辑与渲染快照', () => {
    const first = createBattle();
    const replay = createBattle();
    first.start();
    replay.start();
    for (const delta of [8, 8, 9, 16, 17, 17, 33, 33, 34]) {
      first.update(delta);
      replay.update(delta);
    }
    expect(first.getSnapshot()).toEqual(replay.getSnapshot());
  });

  it('插值与长帧保护不改变状态机结果', () => {
    const battle = createBattle();
    battle.start();
    expect(battle.state).toBe(BattleState.Running);
  });
});

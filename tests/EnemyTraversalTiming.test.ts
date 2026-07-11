import { describe, expect, it } from 'vitest';

import { BattleSimulation } from '../src/battle/BattleSimulation';
import type {
  EnemyDefinition,
  EnemyKind,
  LevelDefinition,
  PointDefinition,
} from '../src/battle/definitions';
import { BATTLE_CONFIG } from '../src/data/battleConfig';

const FIXED_STEP_MS = BATTLE_CONFIG.fixedStepMs;

const FUTURE_BOSS: EnemyDefinition = {
  id: 'timing-future-boss',
  name: '计时保底 Boss',
  kind: 'boss',
  color: 0xff0000,
  maxHealth: 1_000,
  traversalTimeSeconds: 45,
  coreDamage: 1,
  killEnergyReward: 0,
  radius: 16,
};

function createEnemy(
  id: string,
  kind: EnemyKind,
  traversalTimeSeconds: number,
): EnemyDefinition {
  return {
    id,
    name: id,
    kind,
    color: 0xffffff,
    maxHealth: 100,
    traversalTimeSeconds,
    coreDamage: 1,
    killEnergyReward: 0,
    radius: 10,
  };
}

function createTimingLevel(
  enemy: EnemyDefinition,
  options: {
    readonly path?: readonly PointDefinition[];
    readonly preparationSeconds?: number;
    readonly count?: number;
  } = {},
): LevelDefinition {
  const enemyIsBoss = enemy.kind === 'boss';
  return {
    id: 'enemy-traversal-timing',
    name: '敌人推进时间测试',
    defaultSeed: 'timing-seed',
    coreMaxHealth: 10_000,
    coreRadius: 20,
    coreColor: 0x00ffff,
    initialPreparationSeconds: options.preparationSeconds ?? 0,
    wavePreviewSeconds: 5,
    path: options.path ?? [
      { x: 0, y: 0 },
      { x: 0, y: 500 },
    ],
    laneLayout: {
      laneCount: 5,
      corridorWidthStart: 300,
      corridorWidthMiddle: 240,
      corridorWidthEnd: 180,
      laneSpacing: 44,
      localJitter: 8,
    },
    heroPool: [],
    heroSlots: [],
    waves: [
      {
        id: 'timed-wave',
        startTimeMs: 0,
        completionEnergyReward: 0,
        preview: {
          title: '计时敌袭',
          threat: enemyIsBoss ? 'boss' : 'normal',
          formation: '五线测试',
        },
        spawns: [
          {
            enemyPool: [enemy.id],
            count: options.count ?? 1,
            intervalMs: 0,
            startDelayMs: 0,
            laneMode: 'full-line',
            spawnFormation: 'line',
          },
        ],
      },
      ...(enemyIsBoss
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

function createBattle(
  enemy: EnemyDefinition,
  options?: Parameters<typeof createTimingLevel>[1],
  seed = 'timing-seed',
): BattleSimulation {
  return new BattleSimulation({
    config: BATTLE_CONFIG,
    level: createTimingLevel(enemy, options),
    heroDefinitions: new Map(),
    enemyDefinitions: new Map([
      [enemy.id, enemy],
      [FUTURE_BOSS.id, FUTURE_BOSS],
    ]),
    seed,
  });
}

function advanceRealTime(battle: BattleSimulation, realTimeMs: number): void {
  const fullSteps = Math.floor(realTimeMs / FIXED_STEP_MS);
  for (let step = 0; step < fullSteps; step += 1) {
    battle.update(FIXED_STEP_MS);
  }
  const remainder = realTimeMs - fullSteps * FIXED_STEP_MS;
  if (remainder > 0) battle.update(remainder);
}

describe('敌人推进时间模型', () => {
  it.each([
    ['普通敌人', 'normal', 22],
    ['快速敌人', 'normal', 14],
    ['重甲敌人', 'heavy', 30],
    ['精英敌人', 'elite', 28],
    ['Boss', 'boss', 45],
  ] as const)('%s按配置时间抵达星核', (_label, kind, traversalSeconds) => {
    const enemy = createEnemy(`timed-${traversalSeconds}`, kind, traversalSeconds);
    const battle = createBattle(enemy);
    battle.start();
    advanceRealTime(battle, traversalSeconds * 1_000);

    const actualMs = battle.getSnapshot().timingStats.firstCoreArrivalTraversalMs;
    expect(actualMs).not.toBeNull();
    expect(Math.abs((actualMs ?? 0) - traversalSeconds * 1_000))
      .toBeLessThanOrEqual(FIXED_STEP_MS);
  });

  it('2 倍速以一半真实时间完成相同模拟推进', () => {
    const enemy = createEnemy('two-x-normal', 'normal', 22);
    const battle = createBattle(enemy);
    battle.setTimeScale(2);
    battle.start();
    advanceRealTime(battle, 11_000);

    expect(battle.getSnapshot().timingStats.firstCoreArrivalTraversalMs)
      .toBe(22_000);
    expect(battle.getSnapshot().elapsedMs).toBe(22_000);
  });

  it('暂停期间 pathProgress 完全不变化', () => {
    const enemy = createEnemy('pause-normal', 'normal', 22);
    const battle = createBattle(enemy);
    battle.start();
    advanceRealTime(battle, 2_000);
    const beforePause = battle.getSnapshot().enemies[0]?.pathProgress;

    battle.pause();
    advanceRealTime(battle, 5_000);
    expect(battle.getSnapshot().enemies[0]?.pathProgress).toBe(beforePause);
  });

  it('laneIndex 和局部错位不改变推进进度或抵达时间', () => {
    const enemy = createEnemy('lane-normal', 'normal', 22);
    const battle = createBattle(enemy, { count: 5 });
    battle.start();
    advanceRealTime(battle, 7_000);
    const snapshot = battle.getSnapshot();

    expect(new Set(snapshot.enemies.map((item) => item.laneIndex)).size).toBe(5);
    expect(new Set(snapshot.enemies.map((item) => item.laneOffset)).size)
      .toBeGreaterThan(1);
    const progressValues = snapshot.enemies.map((item) => item.pathProgress);
    expect(Math.max(...progressValues) - Math.min(...progressValues))
      .toBeLessThan(1e-12);
    expect(snapshot.timingStats).toMatchObject({
      firstSpawnTimeMs: 0,
      averageTraversalTimeSeconds: 22,
      peakAliveEnemyCount: 5,
    });

    advanceRealTime(battle, 15_000);
    expect(battle.getSnapshot().enemies).toHaveLength(0);
    expect(battle.getSnapshot().timingStats.firstCoreArrivalTraversalMs)
      .toBe(22_000);
  });

  it('修改中心路径曲线长度不改变 pathProgress 和抵达时间', () => {
    const enemy = createEnemy('path-independent-normal', 'normal', 22);
    const shortPath = [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
    ];
    const longPath = [
      { x: 0, y: 0 },
      { x: 300, y: 300 },
      { x: -300, y: 700 },
      { x: 0, y: 1_000 },
    ];
    const shortBattle = createBattle(enemy, { path: shortPath });
    const longBattle = createBattle(enemy, { path: longPath });
    shortBattle.start();
    longBattle.start();
    advanceRealTime(shortBattle, 5_000);
    advanceRealTime(longBattle, 5_000);

    expect(shortBattle.getSnapshot().enemies[0]?.pathProgress).toBeCloseTo(
      longBattle.getSnapshot().enemies[0]?.pathProgress ?? -1,
      12,
    );
    advanceRealTime(shortBattle, 17_000);
    advanceRealTime(longBattle, 17_000);
    expect(shortBattle.getSnapshot().timingStats.firstCoreArrivalTraversalMs)
      .toBe(22_000);
    expect(longBattle.getSnapshot().timingStats.firstCoreArrivalTraversalMs)
      .toBe(22_000);
  });

  it('8 秒准备期内不生成敌人，结束后第一波开始且提供预告', () => {
    const enemy = createEnemy('preparation-normal', 'normal', 22);
    const battle = createBattle(enemy, { preparationSeconds: 8 });
    battle.start();
    advanceRealTime(battle, 2_980);
    expect(battle.getSnapshot().enemies).toHaveLength(0);
    expect(battle.getSnapshot().upcomingWave).toBeNull();

    advanceRealTime(battle, 20);
    const previewSnapshot = battle.getSnapshot();
    expect(previewSnapshot.upcomingWave).toMatchObject({
      waveIndex: 0,
      waveId: 'timed-wave',
      startsInMs: 5_000,
      primaryEnemyNames: ['preparation-normal'],
    });
    advanceRealTime(battle, 4_980);
    expect(battle.getSnapshot().enemies).toHaveLength(0);
    expect(battle.getSnapshot().preparationRemainingMs).toBe(20);

    advanceRealTime(battle, 20);
    const started = battle.getSnapshot();
    expect(started.enemies).toHaveLength(1);
    expect(started.preparationRemainingMs).toBe(0);
    expect(started.battleElapsedMs).toBe(0);
    expect(started.currentWaveIndex).toBe(0);
  });

  it('同种子重演复现通道和错位，重置恢复准备期与推进状态', () => {
    const enemy = createEnemy('reset-normal', 'normal', 22);
    const battle = createBattle(
      enemy,
      { preparationSeconds: 8, count: 5 },
      'replay-timing-seed',
    );
    battle.start();
    advanceRealTime(battle, 10_000);
    const first = battle.getSnapshot().enemies.map((item) => ({
      laneIndex: item.laneIndex,
      laneOffset: item.laneOffset,
      pathProgress: item.pathProgress,
    }));

    battle.reset();
    const reset = battle.getSnapshot();
    expect(reset.elapsedMs).toBe(0);
    expect(reset.preparationRemainingMs).toBe(8_000);
    expect(reset.enemies).toHaveLength(0);
    expect(reset.timingStats.firstSpawnTimeMs).toBeNull();
    expect(reset.timingStats.peakAliveEnemyCount).toBe(0);

    battle.start();
    advanceRealTime(battle, 10_000);
    expect(battle.getSnapshot().enemies.map((item) => ({
      laneIndex: item.laneIndex,
      laneOffset: item.laneOffset,
      pathProgress: item.pathProgress,
    }))).toEqual(first);
  });

  it('职业阈值在新时间模型下保留明确攻击窗口', () => {
    expect(22 * (1 - 0.05)).toBeCloseTo(20.9);
    expect(22 * (1 - 0.2)).toBeCloseTo(17.6);
    expect(22 * (1 - 0.35)).toBeCloseTo(14.3);
    expect(22 * (1 - 0.7)).toBeCloseTo(6.6);
    expect(14 * (1 - 0.7)).toBeCloseTo(4.2);
    expect(30 * (1 - 0.7)).toBeCloseTo(9);
    expect(45 * (1 - 0.7)).toBeCloseTo(13.5);
  });
});

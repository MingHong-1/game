import { describe, expect, it } from 'vitest';

import { BattleSimulation } from '../src/battle/BattleSimulation';
import { LaneSpawnPlanner } from '../src/battle/LaneSpawnPlanner';
import { WaveRandomStreams } from '../src/battle/WaveRandomStreams';
import type {
  EnemyDefinition,
  LevelDefinition,
  WaveSpawnDefinition,
} from '../src/battle/definitions';
import { BATTLE_CONFIG } from '../src/data/battleConfig';

const RANDOM_LANE_SPAWN: WaveSpawnDefinition = {
  enemyPool: ['enemy-a', 'enemy-b'],
  count: 12,
  intervalMs: 0,
  startDelayMs: 0,
  laneMode: 'random',
  laneWeights: [1, 2, 4, 2, 1],
};

function drawComposition(streams: WaveRandomStreams, waveId: string): string[] {
  const random = streams.create(waveId, 'composition');
  return Array.from({ length: 16 }, () =>
    random.pick(RANDOM_LANE_SPAWN.enemyPool),
  );
}

function drawLanes(streams: WaveRandomStreams, waveId: string): number[] {
  const planner = new LaneSpawnPlanner(5, streams.create(waveId, 'lanes'));
  return Array.from({ length: 16 }, (_, spawnIndex) =>
    planner.selectLane({
      spawn: RANDOM_LANE_SPAWN,
      spawnIndex,
      enemyKind: 'normal',
    }),
  );
}

function drawJitter(streams: WaveRandomStreams, waveId: string): number[] {
  const random = streams.create(waveId, 'jitter');
  return Array.from({ length: 16 }, () => random.nextFloat());
}

const ENEMIES = [
  {
    id: 'earlier-a',
    name: '前波甲',
    kind: 'normal',
    color: 0xffffff,
    maxHealth: 100,
    traversalTimeSeconds: 100,
    coreDamage: 1,
    killEnergyReward: 1,
    radius: 8,
  },
  {
    id: 'earlier-b',
    name: '前波乙',
    kind: 'normal',
    color: 0xffffff,
    maxHealth: 100,
    traversalTimeSeconds: 100,
    coreDamage: 1,
    killEnergyReward: 1,
    radius: 8,
  },
  {
    id: 'later-a',
    name: '后波甲',
    kind: 'normal',
    color: 0xffffff,
    maxHealth: 100,
    traversalTimeSeconds: 100,
    coreDamage: 1,
    killEnergyReward: 1,
    radius: 8,
  },
  {
    id: 'later-b',
    name: '后波乙',
    kind: 'normal',
    color: 0xffffff,
    maxHealth: 100,
    traversalTimeSeconds: 100,
    coreDamage: 1,
    killEnergyReward: 1,
    radius: 8,
  },
  {
    id: 'future-boss',
    name: '未来 Boss',
    kind: 'boss',
    color: 0xff0000,
    maxHealth: 100,
    traversalTimeSeconds: 100,
    coreDamage: 1,
    killEnergyReward: 0,
    radius: 16,
  },
] as const satisfies readonly EnemyDefinition[];

const ENEMY_DEFINITIONS = new Map(
  ENEMIES.map((definition) => [definition.id, definition]),
);

function createIndependentWaveLevel(earlierCount: number): LevelDefinition {
  return {
    id: 'wave-independent-level',
    name: '波次独立性测试',
    defaultSeed: 'wave-independent-seed',
    coreMaxHealth: 10_000,
    coreRadius: 20,
    coreColor: 0x00ffff,
    initialPreparationSeconds: 0,
    wavePreviewSeconds: 0,
    path: [
      { x: 0, y: 0 },
      { x: 0, y: 1_000 },
    ],
    laneLayout: {
      laneCount: 5,
      corridorWidthStart: 240,
      corridorWidthMiddle: 200,
      corridorWidthEnd: 120,
      laneSpacing: 40,
      localJitter: 8,
    },
    heroPool: [],
    heroSlots: [],
    waves: [
      {
        id: 'earlier-wave',
        startTimeMs: 0,
        completionEnergyReward: 0,
        preview: { title: '前波', threat: 'normal', formation: '随机' },
        spawns: [
          {
            ...RANDOM_LANE_SPAWN,
            enemyPool: ['earlier-a', 'earlier-b'],
            count: earlierCount,
          },
        ],
      },
      {
        id: 'later-wave',
        startTimeMs: 1_000,
        completionEnergyReward: 0,
        preview: { title: '后波', threat: 'normal', formation: '随机' },
        spawns: [
          {
            ...RANDOM_LANE_SPAWN,
            enemyPool: ['later-a', 'later-b'],
          },
        ],
      },
      {
        id: 'future-boss-wave',
        startTimeMs: 100_000,
        completionEnergyReward: 0,
        preview: { title: 'Boss 波', threat: 'boss', formation: '中央' },
        spawns: [
          {
            enemyPool: ['future-boss'],
            count: 1,
            intervalMs: 0,
            startDelayMs: 0,
            laneMode: 'boss-center-wings',
          },
        ],
      },
    ],
  };
}

function getLaterWaveResult(earlierCount: number): readonly object[] {
  const battle = new BattleSimulation({
    config: BATTLE_CONFIG,
    level: createIndependentWaveLevel(earlierCount),
    heroDefinitions: new Map(),
    enemyDefinitions: ENEMY_DEFINITIONS,
    seed: 'same-run-seed',
  });
  battle.start();
  battle.update(1_000);
  return battle.getSnapshot().enemies
    .filter((enemy) => enemy.definitionId.startsWith('later-'))
    .map((enemy) => ({
      definitionId: enemy.definitionId,
      laneIndex: enemy.laneIndex,
      laneOffset: enemy.laneOffset,
      x: enemy.x,
      y: enemy.y,
    }));
}

describe('WaveRandomStreams', () => {
  it('按 run seed、关卡 id、波次 id 和用途派生明确种子', () => {
    const streams = new WaveRandomStreams('run-alpha', 'level-one');
    expect(streams.getSeed('wave-one', 'composition')).toBe(
      'run-alpha:level:level-one:wave:wave-one:composition',
    );
    expect(streams.getSeed('wave-one', 'lanes')).toBe(
      'run-alpha:level:level-one:wave:wave-one:lanes',
    );
    expect(streams.getSeed('wave-one', 'jitter')).toBe(
      'run-alpha:level:level-one:wave:wave-one:jitter',
    );
  });

  it('增加 jitter 消费次数不改变敌人组成和通道序列', () => {
    const changed = new WaveRandomStreams('isolated-run', 'level-one');
    const control = new WaveRandomStreams('isolated-run', 'level-one');
    const changedJitter = changed.create('wave-one', 'jitter');
    Array.from({ length: 100 }, () => changedJitter.nextFloat());

    expect(drawComposition(changed, 'wave-one')).toEqual(
      drawComposition(control, 'wave-one'),
    );
    expect(drawLanes(changed, 'wave-one')).toEqual(
      drawLanes(control, 'wave-one'),
    );
  });

  it('增加通道随机消费次数不改变敌人组成', () => {
    const changed = new WaveRandomStreams('isolated-run', 'level-one');
    const control = new WaveRandomStreams('isolated-run', 'level-one');
    const laneRandom = changed.create('wave-one', 'lanes');
    Array.from({ length: 100 }, () => laneRandom.nextFloat());

    expect(drawComposition(changed, 'wave-one')).toEqual(
      drawComposition(control, 'wave-one'),
    );
  });

  it('相同 run seed 和配置复现组成、通道与 jitter', () => {
    const first = new WaveRandomStreams('replay-run', 'level-one');
    const second = new WaveRandomStreams('replay-run', 'level-one');
    expect(drawComposition(first, 'wave-one')).toEqual(
      drawComposition(second, 'wave-one'),
    );
    expect(drawLanes(first, 'wave-one')).toEqual(
      drawLanes(second, 'wave-one'),
    );
    expect(drawJitter(first, 'wave-one')).toEqual(
      drawJitter(second, 'wave-one'),
    );
  });

  it('修改前一波敌人数不影响后一波组成、通道和 jitter', () => {
    expect(getLaterWaveResult(3)).toEqual(getLaterWaveResult(23));
  });
});

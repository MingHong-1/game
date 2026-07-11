import { describe, expect, it } from 'vitest';

import { LaneSpawnPlanner } from '../src/battle/LaneSpawnPlanner';
import { SeededRandom } from '../src/battle/SeededRandom';
import type { EnemyKind, WaveSpawnDefinition } from '../src/battle/definitions';

function createSpawn(
  overrides: Partial<WaveSpawnDefinition>,
): WaveSpawnDefinition {
  return {
    enemyPool: ['enemy'],
    count: 1,
    intervalMs: 100,
    startDelayMs: 0,
    ...overrides,
  };
}

function sequence(
  seed: string,
  spawn: WaveSpawnDefinition,
  count: number,
  laneCount = 5,
  kind: EnemyKind = 'normal',
): number[] {
  const planner = new LaneSpawnPlanner(laneCount, new SeededRandom(seed));
  return Array.from({ length: count }, (_, spawnIndex) =>
    planner.selectLane({ spawn, spawnIndex, enemyKind: kind }),
  );
}

describe('LaneSpawnPlanner', () => {
  it('均匀和全线模式轮流覆盖 5 条与 7 条通道', () => {
    expect(sequence('uniform', createSpawn({ laneMode: 'uniform' }), 10))
      .toEqual([0, 1, 2, 3, 4, 0, 1, 2, 3, 4]);
    expect(sequence('full-7', createSpawn({ laneMode: 'full-line' }), 7, 7))
      .toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('两翼模式只使用最左与最右通道', () => {
    expect(new Set(sequence('wings', createSpawn({ laneMode: 'wings' }), 20)))
      .toEqual(new Set([0, 4]));
  });

  it('中央突袭的大部分敌人使用中央通道', () => {
    const lanes = sequence(
      'center-assault',
      createSpawn({ laneMode: 'center-assault' }),
      100,
    );
    expect(lanes.filter((lane) => lane === 2).length).toBeGreaterThan(60);
  });

  it('Boss 中央、小怪两翼模式按敌人类型分配', () => {
    const spawn = createSpawn({ laneMode: 'boss-center-wings' });
    expect(sequence('boss', spawn, 1, 5, 'boss')).toEqual([2]);
    expect(sequence('minions', spawn, 6, 5, 'normal')).toEqual([0, 4, 0, 4, 0, 4]);
  });

  it('随机权重、同 seed 复现与不同 seed 分布均生效', () => {
    const spawn = createSpawn({
      laneMode: 'random',
      laneIndices: [0, 2, 4],
      laneWeights: [1, 6, 1],
    });
    const first = sequence('lane-seed', spawn, 40);
    const replay = sequence('lane-seed', spawn, 40);
    const different = sequence('other-lane-seed', spawn, 40);
    expect(replay).toEqual(first);
    expect(different).not.toEqual(first);
    expect(first.every((lane) => [0, 2, 4].includes(lane))).toBe(true);
    expect(first.filter((lane) => lane === 2).length).toBeGreaterThan(20);
  });
});

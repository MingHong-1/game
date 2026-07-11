import { describe, expect, it } from 'vitest';

import { LanePathGeometry } from '../src/battle/LanePathGeometry';
import { isEnemyInHeroAttackArea } from '../src/battle/HeroTargeting';
import type { HeroDefinition, LaneLayoutDefinition } from '../src/battle/definitions';
import { PROTOTYPE_LEVEL } from '../src/data/levelDefinitions';

function createLayout(laneCount: number): LaneLayoutDefinition {
  return {
    ...PROTOTYPE_LEVEL.laneLayout,
    laneCount,
  };
}

describe('LanePathGeometry', () => {
  it('默认关卡使用 5 条通道，并支持配置为 3～7 条', () => {
    expect(new LanePathGeometry(PROTOTYPE_LEVEL.path, createLayout(5)).laneCount).toBe(5);
    expect(new LanePathGeometry(PROTOTYPE_LEVEL.path, createLayout(3)).laneCount).toBe(3);
    expect(new LanePathGeometry(PROTOTYPE_LEVEL.path, createLayout(7)).laneCount).toBe(7);
    expect(() => new LanePathGeometry(PROTOTYPE_LEVEL.path, createLayout(2)))
      .toThrow('通道数量必须是 3～7');
    expect(() => new LanePathGeometry(PROTOTYPE_LEVEL.path, createLayout(8)))
      .toThrow('通道数量必须是 3～7');
  });

  it('同一 pathProgress 的不同通道具有不同世界坐标且都位于走廊内', () => {
    const geometry = new LanePathGeometry(
      PROTOTYPE_LEVEL.path,
      PROTOTYPE_LEVEL.laneLayout,
    );
    const distance = geometry.totalDistance * 0.45;
    const positions = geometry.getLaneIndices().map((laneIndex) =>
      geometry.positionAt(distance, laneIndex, 10),
    );
    expect(new Set(positions.map((position) => position.x.toFixed(3))).size)
      .toBe(5);
    for (const position of positions) {
      expect(position.pathProgress).toBeCloseTo(0.45);
      expect(Math.abs(position.laneOffset)).toBeLessThanOrEqual(
        geometry.getCorridorWidth(0.45) / 2,
      );
    }
    const clamped = geometry.positionAt(distance, 0, -10_000);
    expect(Math.abs(clamped.laneOffset)).toBeLessThanOrEqual(
      geometry.getCorridorWidth(0.45) / 2,
    );
  });

  it('接近星核时通道适度收束且所有通道保持统一终点进度', () => {
    const geometry = new LanePathGeometry(
      PROTOTYPE_LEVEL.path,
      PROTOTYPE_LEVEL.laneLayout,
    );
    const startSpread =
      geometry.getLaneCenterOffset(4, 0) - geometry.getLaneCenterOffset(0, 0);
    const endSpread =
      geometry.getLaneCenterOffset(4, 1) - geometry.getLaneCenterOffset(0, 1);
    expect(endSpread).toBeGreaterThan(0);
    expect(endSpread).toBeLessThan(startSpread);
    for (const laneIndex of geometry.getLaneIndices()) {
      expect(geometry.positionAt(geometry.totalDistance, laneIndex).pathProgress)
        .toBe(1);
    }
  });

  it('职业攻击阈值只读取 pathProgress，不受通道影响', () => {
    const hero: HeroDefinition = {
      id: 'lane-threshold-hero',
      name: '阈值英雄',
      role: 'warrior',
      color: 0xffffff,
      radius: 10,
      attackDamage: 1,
      attackIntervalMs: 100,
      minimumAttackPathProgress: 0.7,
      projectileSpeed: 100,
      projectileColor: 0xffffff,
      targeting: 'closest-to-core',
    };
    expect([0, 1, 2, 3, 4].map(() => isEnemyInHeroAttackArea(hero, 0.69)))
      .toEqual([false, false, false, false, false]);
    expect([0, 1, 2, 3, 4].map(() => isEnemyInHeroAttackArea(hero, 0.7)))
      .toEqual([true, true, true, true, true]);
  });

  it('路径节点两侧使用连续法线，外侧通道不会在节点处跳回', () => {
    const geometry = new LanePathGeometry(
      PROTOTYPE_LEVEL.path,
      PROTOTYPE_LEVEL.laneLayout,
    );
    let cumulativeDistance = 0;
    for (let index = 1; index < PROTOTYPE_LEVEL.path.length - 1; index += 1) {
      const previous = PROTOTYPE_LEVEL.path[index - 1];
      const current = PROTOTYPE_LEVEL.path[index];
      if (previous === undefined || current === undefined) continue;
      cumulativeDistance += Math.hypot(
        current.x - previous.x,
        current.y - previous.y,
      );
      const nodeProgress = cumulativeDistance / geometry.totalDistance;
      for (const laneIndex of geometry.getLaneIndices()) {
        const before = geometry.positionAtProgress(
          nodeProgress - 1e-6,
          laneIndex,
        );
        const after = geometry.positionAtProgress(
          nodeProgress + 1e-6,
          laneIndex,
        );
        expect(Math.hypot(after.x - before.x, after.y - before.y))
          .toBeLessThan(0.1);
      }
    }
  });

  it('沿所有通道细分采样时不出现单帧级世界坐标突跳', () => {
    const geometry = new LanePathGeometry(
      PROTOTYPE_LEVEL.path,
      PROTOTYPE_LEVEL.laneLayout,
    );
    for (const laneIndex of geometry.getLaneIndices()) {
      let previous = geometry.positionAtProgress(0, laneIndex);
      for (let sample = 1; sample <= 10_000; sample += 1) {
        const current = geometry.positionAtProgress(
          sample / 10_000,
          laneIndex,
        );
        expect(Math.hypot(
          current.x - previous.x,
          current.y - previous.y,
        )).toBeLessThan(1);
        previous = current;
      }
    }
  });
});

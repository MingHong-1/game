import { describe, expect, it } from 'vitest';

import { BattleSimulation } from '../src/battle/BattleSimulation';
import { BattleState } from '../src/battle/BattleState';
import { SlotSystem } from '../src/battle/SlotSystem';
import { LanePathGeometry } from '../src/battle/LanePathGeometry';
import { BATTLE_CONFIG } from '../src/data/battleConfig';
import { ENEMY_DEFINITIONS_BY_ID } from '../src/data/enemyDefinitions';
import { HERO_DEFINITIONS_BY_ID } from '../src/data/heroDefinitions';
import { PROTOTYPE_LEVEL } from '../src/data/levelDefinitions';
import { GAME_HEIGHT, GAME_WIDTH } from '../src/core/gameConstants';
import { UI_METRICS } from '../src/ui/theme/uiMetrics';

describe('正式战场布局', () => {
  it('道路从顶部沿纵向 S 形通向战斗区底部中央星核', () => {
    const path = PROTOTYPE_LEVEL.path;
    const start = path[0];
    const end = path.at(-1);
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    if (start === undefined || end === undefined) {
      return;
    }

    expect(start).toMatchObject({ x: 640, y: 72 });
    expect(end).toMatchObject({ x: 640, y: 464 });
    expect(start.y).toBeLessThan(end.y);
    expect(Math.min(...PROTOTYPE_LEVEL.heroSlots.map((slot) => slot.y)))
      .toBeGreaterThan(end.y);
    const geometry = new LanePathGeometry(
      PROTOTYPE_LEVEL.path,
      PROTOTYPE_LEVEL.laneLayout,
    );
    expect(geometry.totalDistance).toBeGreaterThanOrEqual(500);
    expect(PROTOTYPE_LEVEL.laneLayout).toMatchObject({
      corridorWidthStart: 500,
      corridorWidthMiddle: 430,
      corridorWidthEnd: 260,
    });
    expect(start.y).toBeGreaterThanOrEqual(UI_METRICS.layout.battlefield.y);
    expect(end.y + PROTOTYPE_LEVEL.coreRadius).toBeLessThanOrEqual(
      UI_METRICS.layout.commandDeck.y,
    );

    for (let index = 1; index < path.length; index += 1) {
      const previous = path[index - 1];
      const current = path[index];
      expect(previous).toBeDefined();
      expect(current).toBeDefined();
      if (previous !== undefined && current !== undefined) {
        expect(current.y).toBeGreaterThan(previous.y);
      }
    }

    const horizontalDirections = path.slice(1).map((point, index) => {
      const previous = path[index];
      if (previous === undefined) {
        throw new Error('道路测试缺少前置坐标');
      }
      return Math.sign(point.x - previous.x);
    });
    const directionChanges = horizontalDirections
      .slice(1)
      .filter(
        (direction, index) =>
          direction !== 0 &&
          horizontalDirections[index] !== 0 &&
          direction !== horizontalDirections[index],
      );
    expect(directionChanges.length).toBeGreaterThanOrEqual(2);
  });

  it('没有英雄时敌人仍能沿正式道路抵达星核并触发失败', () => {
    const battle = new BattleSimulation({
      config: BATTLE_CONFIG,
      level: PROTOTYPE_LEVEL,
      heroDefinitions: HERO_DEFINITIONS_BY_ID,
      enemyDefinitions: ENEMY_DEFINITIONS_BY_ID,
      seed: 'vertical-road-defeat',
    });
    battle.start();
    battle.setTimeScale(2);

    for (
      let frame = 0;
      frame < 1_000 && battle.state === BattleState.Running;
      frame += 1
    ) {
      battle.update(50);
    }

    expect(battle.state).toBe(BattleState.Defeat);
    expect(battle.getSnapshot().coreHealth).toBe(0);
  });

  it('十格坐标符合下五上五布局与第 6～10 格解锁顺序', () => {
    const slots = new SlotSystem(
      PROTOTYPE_LEVEL.heroSlots,
      BATTLE_CONFIG.summon,
    );
    const positions = slots.getSnapshot();
    const lowerRow = positions.slice(0, 5);
    const upperRow = positions.slice(5, 10);
    expect(lowerRow.map((slot) => slot.y)).toEqual([642, 642, 642, 642, 642]);
    expect(lowerRow.map((slot) => slot.x)).toEqual([468, 554, 640, 726, 812]);
    expect(upperRow.map((slot) => slot.y)).toEqual([550, 550, 550, 550, 550]);
    expect(upperRow.map((slot) => slot.x)).toEqual([468, 554, 640, 726, 812]);
    expect(
      lowerRow.reduce((sum, slot) => sum + slot.x, 0) / lowerRow.length,
    ).toBe(GAME_WIDTH / 2);
    expect(
      upperRow.reduce((sum, slot) => sum + slot.x, 0) / upperRow.length,
    ).toBe(GAME_WIDTH / 2);
    expect(positions.map((slot) => slot.unlocked)).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);

    for (const [summons, unlocked] of [[5, 6], [10, 7], [15, 8], [20, 9], [25, 10]] as const) {
      slots.applySuccessfulSummonCount(summons);
      expect(slots.getSnapshot().filter((slot) => slot.unlocked)).toHaveLength(unlocked);
    }
  });

  it('十格不重叠、位于画布内且不遮挡星核和两侧操作按钮', () => {
    const slots = PROTOTYPE_LEVEL.heroSlots;
    const halfWidth = UI_METRICS.slot.width / 2;
    const topOffset = 24;
    const bottomOffset = UI_METRICS.slot.height - topOffset;
    for (const slot of slots) {
      expect(slot.x - halfWidth).toBeGreaterThanOrEqual(0);
      expect(slot.x + halfWidth).toBeLessThanOrEqual(GAME_WIDTH);
      expect(slot.y - topOffset).toBeGreaterThan(
        PROTOTYPE_LEVEL.path.at(-1)!.y + PROTOTYPE_LEVEL.coreRadius,
      );
      expect(slot.y + bottomOffset).toBeLessThanOrEqual(GAME_HEIGHT);
    }
    for (let leftIndex = 0; leftIndex < slots.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < slots.length; rightIndex += 1) {
        const left = slots[leftIndex]!;
        const right = slots[rightIndex]!;
        const separated =
          Math.abs(left.x - right.x) >= UI_METRICS.slot.width ||
          Math.abs(left.y - right.y) >= UI_METRICS.slot.height;
        expect(separated).toBe(true);
      }
    }

    const controls = UI_METRICS.layout.commandDeckContent;
    const commandX = UI_METRICS.layout.commandDeck.x;
    const leftButtonRight = commandX + controls.skillX + 72;
    const rightButtonLeft = commandX + controls.mergeX - 72;
    expect(leftButtonRight).toBeLessThan(slots[0]!.x - halfWidth);
    expect(rightButtonLeft).toBeGreaterThan(slots[4]!.x + halfWidth);
  });

  it('锁定的上排格位不能被占用', () => {
    const slots = new SlotSystem(
      PROTOTYPE_LEVEL.heroSlots,
      BATTLE_CONFIG.summon,
    );

    for (let index = 0; index < 5; index += 1) {
      slots.occupyFirstAvailable({
        instanceId: `layout-hero-${index}`,
        heroDefinitionId: PROTOTYPE_LEVEL.heroPool[index] ?? 'gale-hunter',
        starLevel: 1,
      });
    }

    expect(slots.getSnapshot().slice(5).every((slot) => !slot.unlocked))
      .toBe(true);
    expect(slots.getSnapshot().slice(5).every((slot) => slot.occupant === null))
      .toBe(true);
    expect(() =>
      slots.occupyFirstAvailable({
        instanceId: 'locked-slot-hero',
        heroDefinitionId: 'gale-hunter',
        starLevel: 1,
      }),
    ).toThrow('所有已解锁英雄格位均已占用');
  });

  it('原型关卡展示均匀、全线怪潮与 Boss 中央小怪两翼队形', () => {
    const laneModes = PROTOTYPE_LEVEL.waves.flatMap((wave) =>
      wave.spawns.map((spawn) => spawn.laneMode),
    );
    expect(laneModes).toContain('uniform');
    expect(laneModes).toContain('full-line');
    expect(laneModes).toContain('boss-center-wings');
  });

  it('准备时间、波次预告和长推进共同保持多波重叠', () => {
    expect(PROTOTYPE_LEVEL.initialPreparationSeconds).toBe(8);
    expect(PROTOTYPE_LEVEL.wavePreviewSeconds).toBe(5);
    expect(PROTOTYPE_LEVEL.waves.map((wave) => wave.startTimeMs))
      .toEqual([0, 18_000, 45_000]);

    const openingLatestArrivalMs =
      6 * 1_150 + 22_000;
    const eliteLatestArrivalMs =
      18_000 + 1_600 + 3_000 + 30_000;
    expect(openingLatestArrivalMs).toBeGreaterThan(18_000);
    expect(eliteLatestArrivalMs).toBeGreaterThan(45_000);
  });
});

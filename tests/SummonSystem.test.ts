import { describe, expect, it } from 'vitest';

import { EnergySystem } from '../src/battle/EnergySystem';
import { SeededRandom } from '../src/battle/SeededRandom';
import { SlotSystem } from '../src/battle/SlotSystem';
import {
  FULL_SLOTS_MESSAGE,
  SummonSystem,
} from '../src/battle/SummonSystem';
import type { PointDefinition } from '../src/battle/definitions';
import { BATTLE_CONFIG } from '../src/data/battleConfig';
import { PROTOTYPE_LEVEL } from '../src/data/levelDefinitions';

const SLOT_POSITIONS: readonly PointDefinition[] = Array.from(
  { length: 10 },
  (_, index) => ({ x: index * 10, y: 0 }),
);

interface SummonHarness {
  readonly energy: EnergySystem;
  readonly slots: SlotSystem;
  readonly summoning: SummonSystem;
}

function createHarness(seed: string, initialEnergy = 1_000): SummonHarness {
  const energy = new EnergySystem({ initialEnergy });
  const slots = new SlotSystem(SLOT_POSITIONS, BATTLE_CONFIG.summon);
  const summoning = new SummonSystem(
    BATTLE_CONFIG.summon,
    energy,
    slots,
    PROTOTYPE_LEVEL.heroPool,
    new SeededRandom(seed),
  );
  return { energy, slots, summoning };
}

function vacateFirstOccupied(slots: SlotSystem): void {
  const occupied = slots
    .getSnapshot()
    .find((slot) => slot.unlocked && slot.occupant !== null);
  if (occupied === undefined) {
    throw new Error('测试没有可释放的已占用格位');
  }
  slots.vacate(occupied.index);
}

function expectedCost(successfulSummons: number): number {
  if (successfulSummons >= 20) return 9;
  if (successfulSummons >= 15) return 8;
  if (successfulSummons >= 10) return 7;
  if (successfulSummons >= 5) return 6;
  return 5;
}

describe('SummonSystem', () => {
  it('严格应用 0/5/10/15/20 次召唤费用档位', () => {
    const { slots, summoning } = createHarness('cost-tiers');

    for (let count = 0; count <= 20; count += 1) {
      expect(summoning.currentCost).toBe(expectedCost(count));
      if (count === 20) break;
      if (slots.isFull) vacateFirstOccupied(slots);
      expect(summoning.attemptSummon().success).toBe(true);
    }
  });

  it('只在第 5、10、15、20、25 次成功召唤后扩格且最大为 10', () => {
    const { slots, summoning } = createHarness('slot-unlocks');

    for (let count = 1; count <= 30; count += 1) {
      if (slots.isFull) vacateFirstOccupied(slots);
      expect(summoning.attemptSummon().success).toBe(true);

      const expectedSlots =
        count >= 25
          ? 10
          : count >= 20
            ? 9
            : count >= 15
              ? 8
              : count >= 10
                ? 7
                : count >= 5
                  ? 6
                  : 5;
      expect(slots.unlockedCount).toBe(expectedSlots);
    }
    expect(slots.maximumCount).toBe(10);
  });

  it('6/6、7/7、8/8、9/9 满格时原子完成第 10、15、20、25 次扩格召唤', () => {
    const first = createHarness('expansion-summon-seed');
    const second = createHarness('expansion-summon-seed');
    const expansionSlots = new Map([
      [10, 6],
      [15, 7],
      [20, 8],
      [25, 9],
    ]);

    for (let nextCount = 1; nextCount <= 25; nextCount += 1) {
      const isExpansionSummon = expansionSlots.has(nextCount);
      for (const harness of [first, second]) {
        if (harness.slots.isFull && !isExpansionSummon) {
          vacateFirstOccupied(harness.slots);
        }
      }

      const before = {
        energy: first.energy.energy,
        cost: first.summoning.currentCost,
        bagRemaining: first.summoning.bagRemainingCount,
        unlockedSlots: first.slots.unlockedCount,
        heroCount: first.slots.heroCount,
      };
      if (isExpansionSummon) {
        expect(before.heroCount).toBe(before.unlockedSlots);
        expect(first.summoning.canSummonIntoSlot).toBe(true);
      }

      const firstResult = first.summoning.attemptSummon();
      const secondResult = second.summoning.attemptSummon();
      expect(firstResult.success).toBe(true);
      expect(secondResult.success).toBe(true);
      if (!firstResult.success || !secondResult.success) {
        continue;
      }

      expect(firstResult.heroDefinitionId).toBe(
        secondResult.heroDefinitionId,
      );
      if (isExpansionSummon) {
        const expectedSlotIndex = expansionSlots.get(nextCount);
        expect(firstResult.slot.index).toBe(expectedSlotIndex);
        expect(first.slots.unlockedCount).toBe(expectedSlotIndex! + 1);
        expect(first.slots.heroCount).toBe(expectedSlotIndex! + 1);
        expect(first.energy.energy).toBe(before.energy - before.cost);
        expect(first.summoning.bagRemainingCount).toBe(
          before.bagRemaining === 0 ? 7 : before.bagRemaining - 1,
        );
        expect(first.summoning.successfulSummons).toBe(nextCount);
      }
    }
  });

  it('非扩格满格拒绝不改变能量、次数、费用、进度、袋或下一抽结果', () => {
    const rejectedPath = createHarness('full-slots-seed');
    const controlPath = createHarness('full-slots-seed');

    for (let count = 0; count < 6; count += 1) {
      expect(rejectedPath.summoning.attemptSummon().success).toBe(true);
      expect(controlPath.summoning.attemptSummon().success).toBe(true);
    }

    expect(rejectedPath.slots.unlockedCount).toBe(6);
    expect(rejectedPath.slots.heroCount).toBe(6);
    expect(rejectedPath.summoning.canSummonIntoSlot).toBe(false);

    const before = {
      energy: rejectedPath.energy.energy,
      successfulSummons: rejectedPath.summoning.successfulSummons,
      cost: rejectedPath.summoning.currentCost,
      unlockedSlots: rejectedPath.slots.unlockedCount,
      heroCount: rejectedPath.slots.heroCount,
      bagRemaining: rejectedPath.summoning.bagRemainingCount,
      nextUnlockAt: rejectedPath.summoning.nextSlotUnlockAt,
      slots: rejectedPath.slots.getSnapshot(),
    };

    const rejected = rejectedPath.summoning.attemptSummon();
    expect(rejected).toMatchObject({
      success: false,
      reason: 'slots-full',
      message: FULL_SLOTS_MESSAGE,
    });
    expect({
      energy: rejectedPath.energy.energy,
      successfulSummons: rejectedPath.summoning.successfulSummons,
      cost: rejectedPath.summoning.currentCost,
      unlockedSlots: rejectedPath.slots.unlockedCount,
      heroCount: rejectedPath.slots.heroCount,
      bagRemaining: rejectedPath.summoning.bagRemainingCount,
      nextUnlockAt: rejectedPath.summoning.nextSlotUnlockAt,
      slots: rejectedPath.slots.getSnapshot(),
    }).toEqual(before);

    rejectedPath.slots.vacate(0);
    controlPath.slots.vacate(0);
    const afterRejectedAttempt = rejectedPath.summoning.attemptSummon();
    const controlResult = controlPath.summoning.attemptSummon();
    expect(afterRejectedAttempt).toMatchObject({ success: true });
    expect(controlResult).toMatchObject({ success: true });
    if (afterRejectedAttempt.success && controlResult.success) {
      expect(afterRejectedAttempt.heroDefinitionId).toBe(
        controlResult.heroDefinitionId,
      );
    }
  });

  it('扩格召唤能量不足时不提前解锁、扣费或抽袋', () => {
    const { energy, slots, summoning } = createHarness(
      'expansion-no-energy',
      49,
    );
    for (let count = 0; count < 9; count += 1) {
      if (slots.isFull) vacateFirstOccupied(slots);
      expect(summoning.attemptSummon().success).toBe(true);
    }
    expect(energy.energy).toBe(0);
    expect(summoning.canSummonIntoSlot).toBe(true);

    const before = {
      energy: energy.energy,
      successfulSummons: summoning.successfulSummons,
      bagRemaining: summoning.bagRemainingCount,
      slots: slots.getSnapshot(),
    };
    expect(summoning.attemptSummon()).toMatchObject({
      success: false,
      reason: 'insufficient-energy',
    });
    expect({
      energy: energy.energy,
      successfulSummons: summoning.successfulSummons,
      bagRemaining: summoning.bagRemainingCount,
      slots: slots.getSnapshot(),
    }).toEqual(before);
    expect(slots.unlockedCount).toBe(6);
  });

  it('10/10 格且无后续扩格时零副作用拒绝召唤', () => {
    const { energy, slots, summoning } = createHarness('maximum-slots');
    for (let count = 1; count <= 25; count += 1) {
      const isExpansion = [5, 10, 15, 20, 25].includes(count);
      if (slots.isFull && !isExpansion) vacateFirstOccupied(slots);
      expect(summoning.attemptSummon().success).toBe(true);
    }

    expect(slots.unlockedCount).toBe(10);
    expect(slots.heroCount).toBe(10);
    const before = {
      energy: energy.energy,
      successfulSummons: summoning.successfulSummons,
      bagRemaining: summoning.bagRemainingCount,
      slots: slots.getSnapshot(),
    };
    expect(summoning.attemptSummon()).toMatchObject({
      success: false,
      reason: 'slots-full',
    });
    expect({
      energy: energy.energy,
      successfulSummons: summoning.successfulSummons,
      bagRemaining: summoning.bagRemainingCount,
      slots: slots.getSnapshot(),
    }).toEqual(before);
  });

  it('能量不足时不抽袋、不占格、不增加次数', () => {
    const { energy, slots, summoning } = createHarness('no-energy', 4);

    expect(summoning.attemptSummon()).toMatchObject({
      success: false,
      reason: 'insufficient-energy',
    });
    expect(energy.energy).toBe(4);
    expect(slots.heroCount).toBe(0);
    expect(summoning.successfulSummons).toBe(0);
    expect(summoning.currentCost).toBe(5);
    expect(summoning.bagRemainingCount).toBe(0);
  });
});

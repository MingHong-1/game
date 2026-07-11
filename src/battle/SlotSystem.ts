import type {
  PointDefinition,
  SlotUnlockTier,
  SummonConfig,
} from './definitions';
import { assertHeroStar, type HeroStar } from './HeroStar';

export interface SlotOccupant {
  readonly instanceId: string;
  readonly heroDefinitionId: string;
  readonly starLevel: HeroStar;
}

interface RuntimeSlot extends PointDefinition {
  readonly index: number;
  occupant: SlotOccupant | null;
}

export interface HeroSlotSnapshot extends PointDefinition {
  readonly index: number;
  readonly unlocked: boolean;
  readonly occupant: SlotOccupant | null;
}

function validateUnlockTiers(
  tiers: readonly SlotUnlockTier[],
  slotCount: number,
): void {
  if (tiers.length === 0) {
    throw new RangeError('格位解锁配置不能为空');
  }

  let previousSummons = -1;
  let previousSlots = 0;
  for (const tier of tiers) {
    if (
      !Number.isSafeInteger(tier.successfulSummons) ||
      tier.successfulSummons < 0 ||
      tier.successfulSummons <= previousSummons
    ) {
      throw new RangeError('格位解锁召唤次数必须严格递增');
    }
    if (
      !Number.isSafeInteger(tier.unlockedSlots) ||
      tier.unlockedSlots <= previousSlots ||
      tier.unlockedSlots > slotCount
    ) {
      throw new RangeError('已解锁格位必须递增且不能超过格位配置数量');
    }
    previousSummons = tier.successfulSummons;
    previousSlots = tier.unlockedSlots;
  }

  if (tiers[0]?.successfulSummons !== 0) {
    throw new RangeError('格位解锁配置必须从 0 次召唤开始');
  }
}

export class SlotSystem {
  private readonly slots: RuntimeSlot[];
  private readonly unlockTiers: readonly SlotUnlockTier[];
  private unlockedSlots: number;

  public constructor(
    slotPositions: readonly PointDefinition[],
    config: SummonConfig,
  ) {
    validateUnlockTiers(config.slotUnlockTiers, slotPositions.length);
    this.unlockTiers = config.slotUnlockTiers;
    this.slots = slotPositions.map((position, index) => {
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
        throw new RangeError(`英雄格位 ${index} 必须使用有限坐标`);
      }
      return { index, x: position.x, y: position.y, occupant: null };
    });
    this.unlockedSlots = this.getUnlockedCountFor(0);
  }

  public get unlockedCount(): number {
    return this.unlockedSlots;
  }

  public get maximumCount(): number {
    return this.slots.length;
  }

  public get heroCount(): number {
    let count = 0;
    for (let index = 0; index < this.unlockedSlots; index += 1) {
      const slot = this.slots[index];
      if (slot !== undefined && slot.occupant !== null) {
        count += 1;
      }
    }
    return count;
  }

  public get isFull(): boolean {
    return this.findFirstAvailableSlot() === undefined;
  }

  public hasAvailableSlotAtSuccessfulSummonCount(
    successfulSummons: number,
  ): boolean {
    if (!Number.isSafeInteger(successfulSummons) || successfulSummons < 0) {
      throw new RangeError('累计召唤次数必须是非负整数');
    }
    const unlockedCount = this.getUnlockedCountFor(successfulSummons);
    for (let index = 0; index < unlockedCount; index += 1) {
      if (this.slots[index]?.occupant === null) {
        return true;
      }
    }
    return false;
  }

  public occupyFirstAvailable(occupant: SlotOccupant): HeroSlotSnapshot {
    assertHeroStar(occupant.starLevel, '格位英雄星级');
    const slot = this.findFirstAvailableSlot();
    if (slot === undefined) {
      throw new Error('所有已解锁英雄格位均已占用');
    }
    slot.occupant = occupant;
    return this.toSnapshot(slot);
  }

  public vacate(slotIndex: number): SlotOccupant | null {
    if (!Number.isSafeInteger(slotIndex) || slotIndex < 0) {
      throw new RangeError('格位索引必须是非负整数');
    }
    const slot = this.slots[slotIndex];
    if (slot === undefined || slotIndex >= this.unlockedSlots) {
      throw new RangeError(`不能释放未解锁或不存在的格位：${slotIndex}`);
    }
    const occupant = slot.occupant;
    slot.occupant = null;
    return occupant;
  }

  public applySuccessfulSummonCount(successfulSummons: number): void {
    if (!Number.isSafeInteger(successfulSummons) || successfulSummons < 0) {
      throw new RangeError('累计召唤次数必须是非负整数');
    }
    this.unlockedSlots = this.getUnlockedCountFor(successfulSummons);
  }

  public getNextUnlockAt(successfulSummons: number): number | null {
    for (const tier of this.unlockTiers) {
      if (tier.successfulSummons > successfulSummons) {
        return tier.successfulSummons;
      }
    }
    return null;
  }

  public getSnapshot(): readonly HeroSlotSnapshot[] {
    return this.slots.map((slot) => this.toSnapshot(slot));
  }

  public reset(): void {
    for (const slot of this.slots) {
      slot.occupant = null;
    }
    this.unlockedSlots = this.getUnlockedCountFor(0);
  }

  private findFirstAvailableSlot(): RuntimeSlot | undefined {
    for (let index = 0; index < this.unlockedSlots; index += 1) {
      const slot = this.slots[index];
      if (slot !== undefined && slot.occupant === null) {
        return slot;
      }
    }
    return undefined;
  }

  private getUnlockedCountFor(successfulSummons: number): number {
    let unlockedCount = 0;
    for (const tier of this.unlockTiers) {
      if (tier.successfulSummons > successfulSummons) {
        break;
      }
      unlockedCount = tier.unlockedSlots;
    }
    return unlockedCount;
  }

  private toSnapshot(slot: RuntimeSlot): HeroSlotSnapshot {
    return {
      index: slot.index,
      x: slot.x,
      y: slot.y,
      unlocked: slot.index < this.unlockedSlots,
      occupant: slot.occupant,
    };
  }
}

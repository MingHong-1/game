import { EnergySystem } from './EnergySystem';
import type { SummonConfig, SummonCostTier } from './definitions';
import { HeroBag } from './HeroBag';
import { assertHeroStar, type HeroStar } from './HeroStar';
import { SeededRandom } from './SeededRandom';
import { SlotSystem, type HeroSlotSnapshot } from './SlotSystem';

export const FULL_SLOTS_MESSAGE = '请先合成或重构英雄';

export type SummonRejectionReason =
  | 'battle-not-running'
  | 'slots-full'
  | 'insufficient-energy';

export interface SuccessfulSummonResult {
  readonly success: true;
  readonly heroDefinitionId: string;
  readonly heroInstanceId: string;
  readonly starLevel: HeroStar;
  readonly slot: HeroSlotSnapshot;
  readonly cost: number;
  readonly successfulSummons: number;
}

export interface RejectedSummonResult {
  readonly success: false;
  readonly reason: SummonRejectionReason;
  readonly message: string;
  readonly cost: number;
  readonly successfulSummons: number;
}

export type SummonResult = SuccessfulSummonResult | RejectedSummonResult;

function validateCostTiers(tiers: readonly SummonCostTier[]): void {
  if (tiers.length === 0 || tiers[0]?.minSuccessfulSummons !== 0) {
    throw new RangeError('召唤费用配置必须从 0 次成功召唤开始');
  }
  let previousThreshold = -1;
  for (const tier of tiers) {
    if (
      !Number.isSafeInteger(tier.minSuccessfulSummons) ||
      tier.minSuccessfulSummons <= previousThreshold ||
      !Number.isSafeInteger(tier.cost) ||
      tier.cost <= 0
    ) {
      throw new RangeError('召唤费用档位必须按次数递增并使用正整数费用');
    }
    previousThreshold = tier.minSuccessfulSummons;
  }
}

export class SummonSystem {
  private readonly config: SummonConfig;
  private readonly energy: EnergySystem;
  private readonly slots: SlotSystem;
  private readonly bag: HeroBag;
  private successfulSummonCount = 0;

  public constructor(
    config: SummonConfig,
    energy: EnergySystem,
    slots: SlotSystem,
    heroPool: readonly string[],
    random: SeededRandom,
  ) {
    validateCostTiers(config.costTiers);
    assertHeroStar(config.initialStarLevel, '召唤初始星级');
    this.config = config;
    this.energy = energy;
    this.slots = slots;
    this.bag = new HeroBag(heroPool, config.heroCopiesPerBag, random);
  }

  public get successfulSummons(): number {
    return this.successfulSummonCount;
  }

  public get currentCost(): number {
    let cost = this.config.costTiers[0]?.cost;
    if (cost === undefined) {
      throw new Error('召唤费用配置为空');
    }
    for (const tier of this.config.costTiers) {
      if (tier.minSuccessfulSummons > this.successfulSummonCount) {
        break;
      }
      cost = tier.cost;
    }
    return cost;
  }

  public get bagRemainingCount(): number {
    return this.bag.remainingCount;
  }

  public get nextSlotUnlockAt(): number | null {
    return this.slots.getNextUnlockAt(this.successfulSummonCount);
  }

  public get canSummonIntoSlot(): boolean {
    return this.slots.hasAvailableSlotAtSuccessfulSummonCount(
      this.successfulSummonCount + 1,
    );
  }

  public attemptSummon(): SummonResult {
    const cost = this.currentCost;
    const nextSummonCount = this.successfulSummonCount + 1;

    // 先按成功后的次数预检容量；仅扩格边界可越过当前满格状态。
    if (!this.canSummonIntoSlot) {
      return {
        success: false,
        reason: 'slots-full',
        message: FULL_SLOTS_MESSAGE,
        cost,
        successfulSummons: this.successfulSummonCount,
      };
    }

    if (!this.energy.canSpend(cost)) {
      return {
        success: false,
        reason: 'insufficient-energy',
        message: '能量不足',
        cost,
        successfulSummons: this.successfulSummonCount,
      };
    }

    // 同步事务中先扩格，再提交能量、英雄袋和占位；后续步骤均已预检。
    this.slots.applySuccessfulSummonCount(nextSummonCount);
    if (!this.energy.spend(cost)) {
      this.slots.applySuccessfulSummonCount(this.successfulSummonCount);
      throw new Error('召唤提交时能量状态与预校验不一致');
    }
    const heroDefinitionId = this.bag.draw();
    const heroInstanceId = `summoned-hero-${nextSummonCount}`;
    const slot = this.slots.occupyFirstAvailable({
      instanceId: heroInstanceId,
      heroDefinitionId,
      starLevel: this.config.initialStarLevel,
    });
    this.successfulSummonCount = nextSummonCount;

    return {
      success: true,
      heroDefinitionId,
      heroInstanceId,
      starLevel: this.config.initialStarLevel,
      slot,
      cost,
      successfulSummons: this.successfulSummonCount,
    };
  }

  public reset(random: SeededRandom): void {
    this.successfulSummonCount = 0;
    this.bag.reset(random);
  }
}

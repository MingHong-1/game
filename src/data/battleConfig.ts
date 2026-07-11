import type { BattleConfig } from '../battle/definitions';
import { MIN_HERO_STAR } from '../battle/HeroStar';

export const BATTLE_CONFIG: BattleConfig = Object.freeze({
  fixedStepMs: 20,
  maxFrameDeltaMs: 250,
  defaultTimeScale: 1,
  supportedTimeScales: [1, 2] as const,
  projectileRadius: 5,
  energy: {
    initialEnergy: 15,
  },
  summon: {
    heroCopiesPerBag: 2,
    initialStarLevel: MIN_HERO_STAR,
    costTiers: [
      { minSuccessfulSummons: 0, cost: 5 },
      { minSuccessfulSummons: 5, cost: 6 },
      { minSuccessfulSummons: 10, cost: 7 },
      { minSuccessfulSummons: 15, cost: 8 },
      { minSuccessfulSummons: 20, cost: 9 },
    ],
    slotUnlockTiers: [
      { successfulSummons: 0, unlockedSlots: 5 },
      { successfulSummons: 5, unlockedSlots: 6 },
      { successfulSummons: 10, unlockedSlots: 7 },
      { successfulSummons: 15, unlockedSlots: 8 },
      { successfulSummons: 20, unlockedSlots: 9 },
      { successfulSummons: 25, unlockedSlots: 10 },
    ],
  },
});

import { BattleState } from '../../battle/BattleState';

export interface BattleUiInput {
  readonly state: BattleState;
  readonly energy: number;
  readonly currentSummonCost: number;
  readonly successfulSummons: number;
  readonly unlockedSlots: number;
  readonly maximumSlots: number;
  readonly nextSlotUnlockAt: number | null;
  readonly canSummonIntoSlot: boolean;
}

export type SummonDisabledReason =
  | 'battle-not-running'
  | 'slots-full'
  | 'insufficient-energy'
  | null;

export interface BattleUiState {
  readonly energy: number;
  readonly summonCost: number;
  readonly summonEnabled: boolean;
  readonly summonDisabledReason: SummonDisabledReason;
  readonly expansionReady: boolean;
  readonly summonProgress: string;
  readonly result: 'victory' | 'defeat' | null;
}

export function deriveBattleUiState(input: BattleUiInput): BattleUiState {
  const battleRunning = input.state === BattleState.Running;
  const hasEnergy = input.energy >= input.currentSummonCost;
  let summonDisabledReason: SummonDisabledReason = null;
  if (!input.canSummonIntoSlot) summonDisabledReason = 'slots-full';
  else if (!battleRunning) summonDisabledReason = 'battle-not-running';
  else if (!hasEnergy) summonDisabledReason = 'insufficient-energy';

  const expansionReady =
    input.canSummonIntoSlot &&
    input.unlockedSlots < input.maximumSlots &&
    input.nextSlotUnlockAt === input.successfulSummons + 1;
  const summonProgress =
    input.nextSlotUnlockAt === null
      ? `${input.successfulSummons} · 格位已满级`
      : `${input.successfulSummons}/${input.nextSlotUnlockAt}`;

  return {
    energy: input.energy,
    summonCost: input.currentSummonCost,
    summonEnabled: summonDisabledReason === null,
    summonDisabledReason,
    expansionReady,
    summonProgress,
    result:
      input.state === BattleState.Victory
        ? 'victory'
        : input.state === BattleState.Defeat
          ? 'defeat'
          : null,
  };
}

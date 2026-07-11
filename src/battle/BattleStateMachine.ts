import { BattleState } from './BattleState';

const ALLOWED_TRANSITIONS: Readonly<Record<BattleState, readonly BattleState[]>> =
  Object.freeze({
    [BattleState.Ready]: [BattleState.Running],
    [BattleState.Running]: [
      BattleState.Paused,
      BattleState.SkillSelection,
      BattleState.Victory,
      BattleState.Defeat,
    ],
    [BattleState.Paused]: [BattleState.Running],
    [BattleState.SkillSelection]: [BattleState.Running],
    [BattleState.Victory]: [],
    [BattleState.Defeat]: [],
  });

export class BattleStateMachine {
  private currentState = BattleState.Ready;

  public get state(): BattleState {
    return this.currentState;
  }

  public canTransition(nextState: BattleState): boolean {
    return ALLOWED_TRANSITIONS[this.currentState].includes(nextState);
  }

  public transition(nextState: BattleState): void {
    if (!this.canTransition(nextState)) {
      throw new Error(
        `非法战斗状态切换：${this.currentState} -> ${nextState}`,
      );
    }

    this.currentState = nextState;
  }

  public reset(): void {
    this.currentState = BattleState.Ready;
  }
}

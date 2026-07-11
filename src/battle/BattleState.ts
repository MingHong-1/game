export enum BattleState {
  Ready = 'ready',
  Running = 'running',
  Paused = 'paused',
  SkillSelection = 'skill-selection',
  Victory = 'victory',
  Defeat = 'defeat',
}

export const BATTLE_STATE_LABELS: Readonly<Record<BattleState, string>> =
  Object.freeze({
    [BattleState.Ready]: '准备',
    [BattleState.Running]: '战斗中',
    [BattleState.Paused]: '暂停',
    [BattleState.SkillSelection]: '技能选择',
    [BattleState.Victory]: '胜利',
    [BattleState.Defeat]: '失败',
  });

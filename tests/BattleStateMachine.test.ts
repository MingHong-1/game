import { describe, expect, it } from 'vitest';

import { BattleState } from '../src/battle/BattleState';
import { BattleStateMachine } from '../src/battle/BattleStateMachine';

describe('BattleStateMachine', () => {
  it('按准备、战斗、暂停、技能选择和结果状态明确切换', () => {
    const stateMachine = new BattleStateMachine();

    expect(stateMachine.state).toBe(BattleState.Ready);
    stateMachine.transition(BattleState.Running);
    stateMachine.transition(BattleState.Paused);
    stateMachine.transition(BattleState.Running);
    stateMachine.transition(BattleState.SkillSelection);
    stateMachine.transition(BattleState.Running);
    stateMachine.transition(BattleState.Victory);

    expect(stateMachine.state).toBe(BattleState.Victory);
    stateMachine.reset();
    expect(stateMachine.state).toBe(BattleState.Ready);
  });

  it('拒绝未定义的状态跳转', () => {
    const stateMachine = new BattleStateMachine();

    expect(() => stateMachine.transition(BattleState.Victory)).toThrow(
      '非法战斗状态切换',
    );
  });
});

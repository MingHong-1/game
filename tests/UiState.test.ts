import { describe, expect, it } from 'vitest';

import { BattleSession } from '../src/battle/BattleSession';
import { BattleState } from '../src/battle/BattleState';
import { BATTLE_CONFIG } from '../src/data/battleConfig';
import { ENEMY_DEFINITIONS_BY_ID } from '../src/data/enemyDefinitions';
import { HERO_DEFINITIONS_BY_ID } from '../src/data/heroDefinitions';
import { PROTOTYPE_LEVEL } from '../src/data/levelDefinitions';
import {
  deriveBattleUiState,
  type BattleUiInput,
} from '../src/ui/state/BattleUiState';

function createInput(overrides: Partial<BattleUiInput> = {}): BattleUiInput {
  return {
    state: BattleState.Running,
    energy: 15,
    currentSummonCost: 5,
    successfulSummons: 0,
    unlockedSlots: 5,
    maximumSlots: 10,
    nextSlotUnlockAt: 5,
    canSummonIntoSlot: true,
    ...overrides,
  };
}

describe('BattleUiState', () => {
  it('满格扩格边界保持召唤可用并显示即将扩格', () => {
    const state = deriveBattleUiState(
      createInput({
        energy: 5,
        successfulSummons: 9,
        unlockedSlots: 6,
        nextSlotUnlockAt: 10,
        canSummonIntoSlot: true,
      }),
    );

    expect(state.summonEnabled).toBe(true);
    expect(state.expansionReady).toBe(true);
    expect(state.summonDisabledReason).toBeNull();
  });

  it('普通满格状态禁用召唤并保留明确原因', () => {
    const state = deriveBattleUiState(
      createInput({
        successfulSummons: 6,
        unlockedSlots: 6,
        nextSlotUnlockAt: 10,
        canSummonIntoSlot: false,
      }),
    );

    expect(state.summonEnabled).toBe(false);
    expect(state.expansionReady).toBe(false);
    expect(state.summonDisabledReason).toBe('slots-full');
  });

  it('资源显示值直接来自 BattleSession 输入快照', () => {
    const state = deriveBattleUiState(
      createInput({ energy: 37, currentSummonCost: 7 }),
    );

    expect(state.energy).toBe(37);
    expect(state.summonCost).toBe(7);
  });

  it('显示 5 个初始开放格、10 格上限和正确扩格进度', () => {
    const session = new BattleSession({
      config: BATTLE_CONFIG,
      level: PROTOTYPE_LEVEL,
      heroDefinitions: HERO_DEFINITIONS_BY_ID,
      enemyDefinitions: ENEMY_DEFINITIONS_BY_ID,
      seed: 'ui-slot-capacity',
    });
    const snapshot = session.getSnapshot();
    const state = deriveBattleUiState(snapshot);

    expect(snapshot.slots).toHaveLength(10);
    expect(snapshot.slots.filter((slot) => slot.unlocked)).toHaveLength(5);
    expect(snapshot.maximumSlots).toBe(10);
    expect(state.summonProgress).toBe('0/5');
  });

  it('最大 10 格满格后召唤按钮禁用', () => {
    const state = deriveBattleUiState(createInput({
      energy: 100,
      successfulSummons: 25,
      unlockedSlots: 10,
      maximumSlots: 10,
      nextSlotUnlockAt: null,
      canSummonIntoSlot: false,
    }));

    expect(state.summonEnabled).toBe(false);
    expect(state.expansionReady).toBe(false);
    expect(state.summonDisabledReason).toBe('slots-full');
    expect(state.summonProgress).toBe('25 · 格位已满级');
  });

  it('重置战斗后 UI 派生状态恢复初始值', () => {
    const session = new BattleSession({
      config: BATTLE_CONFIG,
      level: PROTOTYPE_LEVEL,
      heroDefinitions: HERO_DEFINITIONS_BY_ID,
      enemyDefinitions: ENEMY_DEFINITIONS_BY_ID,
      seed: 'ui-reset',
    });
    const initial = deriveBattleUiState(session.getSnapshot());
    session.start();
    session.attemptSummon();
    session.reset();

    expect(deriveBattleUiState(session.getSnapshot())).toEqual(initial);
  });

  it('胜利和失败结果互斥', () => {
    expect(
      deriveBattleUiState(createInput({ state: BattleState.Victory })).result,
    ).toBe('victory');
    expect(
      deriveBattleUiState(createInput({ state: BattleState.Defeat })).result,
    ).toBe('defeat');
    expect(
      deriveBattleUiState(createInput({ state: BattleState.Running })).result,
    ).toBeNull();
  });
});

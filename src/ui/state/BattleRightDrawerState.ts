export type BattleRightDrawerTab =
  | 'enemy-intel'
  | 'damage-statistics'
  | 'simulation-debug';

export interface BattleRightDrawerStateSnapshot {
  readonly activeTab: BattleRightDrawerTab | null;
  readonly expanded: boolean;
}

export function getAvailableDrawerTabs(
  debugEnabled: boolean,
): readonly BattleRightDrawerTab[] {
  return Object.freeze([
    'enemy-intel',
    'damage-statistics',
    ...(debugEnabled ? ['simulation-debug' as const] : []),
  ]);
}

export class BattleRightDrawerState {
  private active: BattleRightDrawerTab | null = null;

  public constructor(private readonly debugEnabled: boolean) {}

  public get snapshot(): BattleRightDrawerStateSnapshot {
    return Object.freeze({
      activeTab: this.active,
      expanded: this.active !== null,
    });
  }

  public toggle(tab: BattleRightDrawerTab): BattleRightDrawerStateSnapshot {
    if (!getAvailableDrawerTabs(this.debugEnabled).includes(tab)) {
      throw new Error(`当前模式不可用的抽屉标签：${tab}`);
    }
    this.active = this.active === tab ? null : tab;
    return this.snapshot;
  }

  public close(): BattleRightDrawerStateSnapshot {
    this.active = null;
    return this.snapshot;
  }

  public reset(): BattleRightDrawerStateSnapshot {
    return this.close();
  }
}

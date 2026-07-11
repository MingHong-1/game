import type { DamageResult } from './DamageResult';

export interface MutableDamageTarget {
  readonly id: string;
  health: number;
}

const HP_EPSILON = 1e-9;

export class DamageApplicationLedger {
  private readonly appliedRequestIds = new Set<string>();

  public apply(result: DamageResult, target: MutableDamageTarget): boolean {
    if (this.appliedRequestIds.has(result.requestId)) {
      throw new Error(`伤害结果不能重复应用：${result.requestId}`);
    }
    if (target.id !== result.target.instanceId) {
      throw new Error('伤害结果目标与运行时目标不一致');
    }
    if (target.health <= 0) return false;
    if (Math.abs(target.health - result.targetHpBefore) > HP_EPSILON) {
      throw new Error(`伤害结果已过期：${result.requestId}`);
    }
    this.appliedRequestIds.add(result.requestId);
    target.health = result.targetHpAfter;
    return true;
  }

  public reset(): void {
    this.appliedRequestIds.clear();
  }

  public get appliedCount(): number {
    return this.appliedRequestIds.size;
  }
}

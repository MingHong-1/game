import type { DamageEntityReference } from './DamageRequest';
import type { DamageTag, DamageType } from './DamageTypes';

export interface DamageResult {
  readonly requestId: string;
  readonly requestSequence: number;
  readonly source: DamageEntityReference;
  readonly target: DamageEntityReference;
  readonly damageType: DamageType;
  readonly tags: readonly DamageTag[];
  readonly simulationTimeMs: number;
  readonly baseDamage: number;
  readonly starDamageMultiplier: number;
  readonly damageBeforeCritical: number;
  readonly isCritical: boolean;
  readonly criticalMultiplier: number;
  readonly damageAfterCritical: number;
  readonly defenseBeforePenetration: number;
  readonly effectiveDefense: number;
  readonly damageReduction: number;
  readonly mitigatedDamage: number;
  readonly damageTakenMultiplier: number;
  readonly calculatedDamage: number;
  readonly appliedDamage: number;
  readonly overkillDamage: number;
  readonly targetHpBefore: number;
  readonly targetHpAfter: number;
  readonly isLethal: boolean;
}

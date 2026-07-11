import type { HeroStar } from '../HeroStar';
import type { CombatStats } from './CombatStats';
import type { DamageTag, DamageType } from './DamageTypes';

export type CombatEntityKind = 'hero' | 'enemy' | 'summon' | 'core';

export interface DamageEntityReference {
  readonly kind: CombatEntityKind;
  readonly instanceId: string;
  readonly definitionId: string;
}

export interface DamageRequest {
  readonly requestId: string;
  readonly requestSequence: number;
  readonly source: DamageEntityReference;
  readonly target: DamageEntityReference;
  readonly baseAmount: number;
  readonly damageType: DamageType;
  readonly tags: readonly DamageTag[];
  readonly canCrit: boolean;
  /** 真实伤害只有显式允许时才能暴击。 */
  readonly allowTrueDamageCritical?: boolean;
  readonly simulationTimeMs: number;
  readonly sourceStar: HeroStar;
  readonly sourceStats: CombatStats;
  readonly targetStats: CombatStats;
  readonly targetIsBoss: boolean;
  readonly targetHpBefore: number;
}

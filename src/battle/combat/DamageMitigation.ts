import type { CombatStats } from './CombatStats';
import type { DamageType } from './DamageTypes';

export const DEFENSE_FORMULA_CONSTANT = 100;
export const MAX_DAMAGE_REDUCTION = 0.7;

export interface DamageMitigationResult {
  readonly defenseBeforePenetration: number;
  readonly effectiveDefense: number;
  readonly damageReduction: number;
}

export function calculateEffectiveDefense(
  defense: number,
  penetrationPercent: number,
  penetrationFlat: number,
): number {
  if (!Number.isFinite(defense) || defense < 0) {
    throw new RangeError('防御必须是非负有限数字');
  }
  if (
    !Number.isFinite(penetrationPercent) ||
    penetrationPercent < 0 ||
    penetrationPercent > 1
  ) {
    throw new RangeError('百分比穿透必须在0～1之间');
  }
  if (!Number.isFinite(penetrationFlat) || penetrationFlat < 0) {
    throw new RangeError('固定穿透必须是非负有限数字');
  }
  return Math.max(
    0,
    defense * (1 - penetrationPercent) - penetrationFlat,
  );
}

export function calculateDamageReduction(effectiveDefense: number): number {
  if (!Number.isFinite(effectiveDefense) || effectiveDefense < 0) {
    throw new RangeError('有效防御必须是非负有限数字');
  }
  const reduction =
    effectiveDefense / (effectiveDefense + DEFENSE_FORMULA_CONSTANT);
  return Math.min(MAX_DAMAGE_REDUCTION, Math.max(0, reduction));
}

export function resolveDamageMitigation(
  damageType: DamageType,
  sourceStats: CombatStats,
  targetStats: CombatStats,
): DamageMitigationResult {
  if (damageType === 'true') {
    return {
      defenseBeforePenetration: 0,
      effectiveDefense: 0,
      damageReduction: 0,
    };
  }

  const physical = damageType === 'physical';
  const defense = physical ? targetStats.armor : targetStats.resistance;
  const penetrationPercent = physical
    ? sourceStats.armorPenetrationPercent
    : sourceStats.resistancePenetrationPercent;
  const penetrationFlat = physical
    ? sourceStats.armorPenetrationFlat
    : sourceStats.resistancePenetrationFlat;
  const effectiveDefense = calculateEffectiveDefense(
    defense,
    penetrationPercent,
    penetrationFlat,
  );
  return {
    defenseBeforePenetration: defense,
    effectiveDefense,
    damageReduction: calculateDamageReduction(effectiveDefense),
  };
}

export interface CombatStats {
  readonly attackPower: number;
  readonly attackSpeedMultiplier: number;
  readonly critChance: number;
  readonly critDamageMultiplier: number;
  readonly skillDamageMultiplier: number;
  readonly bossDamageMultiplier: number;
  readonly summonDamageMultiplier: number;
  readonly outgoingDamageMultiplier: number;
  readonly armorPenetrationFlat: number;
  readonly armorPenetrationPercent: number;
  readonly resistancePenetrationFlat: number;
  readonly resistancePenetrationPercent: number;
  readonly armor: number;
  readonly resistance: number;
  readonly damageTakenMultiplier: number;
  readonly statusStrengthMultiplier: number;
  readonly controlDurationMultiplier: number;
}

export type CombatStatName = keyof CombatStats;
export type CombatStatsInput = Readonly<Partial<CombatStats>>;

export const COMBAT_STAT_NAMES: readonly CombatStatName[] = Object.freeze([
  'attackPower',
  'attackSpeedMultiplier',
  'critChance',
  'critDamageMultiplier',
  'skillDamageMultiplier',
  'bossDamageMultiplier',
  'summonDamageMultiplier',
  'outgoingDamageMultiplier',
  'armorPenetrationFlat',
  'armorPenetrationPercent',
  'resistancePenetrationFlat',
  'resistancePenetrationPercent',
  'armor',
  'resistance',
  'damageTakenMultiplier',
  'statusStrengthMultiplier',
  'controlDurationMultiplier',
]);

export const DEFAULT_COMBAT_STATS: CombatStats = Object.freeze({
  attackPower: 0,
  attackSpeedMultiplier: 1,
  critChance: 0,
  critDamageMultiplier: 1.8,
  skillDamageMultiplier: 1,
  bossDamageMultiplier: 1,
  summonDamageMultiplier: 1,
  outgoingDamageMultiplier: 1,
  armorPenetrationFlat: 0,
  armorPenetrationPercent: 0,
  resistancePenetrationFlat: 0,
  resistancePenetrationPercent: 0,
  armor: 0,
  resistance: 0,
  damageTakenMultiplier: 1,
  statusStrengthMultiplier: 1,
  controlDurationMultiplier: 1,
});

export const MAX_CRIT_CHANCE = 0.8;
export const MIN_CRIT_DAMAGE_MULTIPLIER = 1;
export const MAX_CRIT_DAMAGE_MULTIPLIER = 3;

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name}必须是有限数字`);
}

function assertNonNegative(value: number, name: string): void {
  assertFinite(value, name);
  if (value < 0) throw new RangeError(`${name}不能为负数`);
}

function assertPositive(value: number, name: string): void {
  assertFinite(value, name);
  if (value <= 0) throw new RangeError(`${name}必须大于0`);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function createCombatStats(input: CombatStatsInput = {}): CombatStats {
  const raw: CombatStats = { ...DEFAULT_COMBAT_STATS, ...input };

  assertNonNegative(raw.attackPower, 'attackPower');
  assertPositive(raw.attackSpeedMultiplier, 'attackSpeedMultiplier');
  assertNonNegative(raw.critChance, 'critChance');
  assertNonNegative(raw.critDamageMultiplier, 'critDamageMultiplier');
  assertNonNegative(raw.skillDamageMultiplier, 'skillDamageMultiplier');
  assertNonNegative(raw.bossDamageMultiplier, 'bossDamageMultiplier');
  assertNonNegative(raw.summonDamageMultiplier, 'summonDamageMultiplier');
  assertNonNegative(raw.outgoingDamageMultiplier, 'outgoingDamageMultiplier');
  assertNonNegative(raw.armorPenetrationFlat, 'armorPenetrationFlat');
  assertNonNegative(raw.armorPenetrationPercent, 'armorPenetrationPercent');
  assertNonNegative(
    raw.resistancePenetrationFlat,
    'resistancePenetrationFlat',
  );
  assertNonNegative(
    raw.resistancePenetrationPercent,
    'resistancePenetrationPercent',
  );
  assertNonNegative(raw.armor, 'armor');
  assertNonNegative(raw.resistance, 'resistance');
  assertNonNegative(raw.damageTakenMultiplier, 'damageTakenMultiplier');
  assertNonNegative(raw.statusStrengthMultiplier, 'statusStrengthMultiplier');
  assertNonNegative(raw.controlDurationMultiplier, 'controlDurationMultiplier');

  return Object.freeze({
    ...raw,
    critChance: clamp(raw.critChance, 0, MAX_CRIT_CHANCE),
    critDamageMultiplier: clamp(
      raw.critDamageMultiplier,
      MIN_CRIT_DAMAGE_MULTIPLIER,
      MAX_CRIT_DAMAGE_MULTIPLIER,
    ),
    armorPenetrationPercent: clamp(raw.armorPenetrationPercent, 0, 1),
    resistancePenetrationPercent: clamp(
      raw.resistancePenetrationPercent,
      0,
      1,
    ),
  });
}

export function assertCombatStats(stats: CombatStats): void {
  const normalized = createCombatStats(stats);
  for (const stat of COMBAT_STAT_NAMES) {
    if (normalized[stat] !== stats[stat]) {
      throw new RangeError(`${stat}超出合法运行时范围`);
    }
  }
}

export function getEffectiveAttackIntervalMs(
  baseAttackIntervalMs: number,
  attackSpeedMultiplier: number,
): number {
  assertPositive(baseAttackIntervalMs, '基础攻击间隔');
  assertPositive(attackSpeedMultiplier, 'attackSpeedMultiplier');
  return baseAttackIntervalMs / attackSpeedMultiplier;
}

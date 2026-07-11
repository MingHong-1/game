import {
  COMBAT_STAT_NAMES,
  type CombatStatName,
  type CombatStats,
  createCombatStats,
} from './CombatStats';

export type CombatModifierOperation = 'add' | 'multiply' | 'override';

export interface CombatModifier {
  readonly sourceId: string;
  readonly stat: CombatStatName;
  readonly operation: CombatModifierOperation;
  readonly value: number;
  readonly priority: number;
}

export interface CombatStatAggregationDetail {
  readonly stat: CombatStatName;
  readonly baseValue: number;
  readonly addModifiers: readonly CombatModifier[];
  readonly multiplyModifiers: readonly CombatModifier[];
  readonly overrideModifier: CombatModifier | null;
  readonly valueBeforeRules: number;
  readonly finalValue: number;
}

export interface CombatStatsAggregationResult {
  readonly stats: CombatStats;
  readonly details: Readonly<Record<CombatStatName, CombatStatAggregationDetail>>;
}

const OPERATIONS: readonly CombatModifierOperation[] = [
  'add',
  'multiply',
  'override',
];

function compareModifiers(left: CombatModifier, right: CombatModifier): number {
  const sourceOrder = left.sourceId < right.sourceId
    ? -1
    : left.sourceId > right.sourceId
      ? 1
      : 0;
  return (
    right.priority - left.priority ||
    sourceOrder ||
    left.value - right.value
  );
}

function validateModifiers(modifiers: readonly CombatModifier[]): void {
  const identities = new Set<string>();
  for (const modifier of modifiers) {
    if (modifier.sourceId.trim().length === 0) {
      throw new RangeError('属性修改器sourceId不能为空');
    }
    if (!COMBAT_STAT_NAMES.includes(modifier.stat)) {
      throw new RangeError(`属性修改器stat无效：${String(modifier.stat)}`);
    }
    if (!OPERATIONS.includes(modifier.operation)) {
      throw new RangeError(`属性修改器operation无效：${String(modifier.operation)}`);
    }
    if (!Number.isFinite(modifier.value)) {
      throw new RangeError('属性修改器value必须是有限数字');
    }
    if (modifier.operation === 'multiply' && modifier.value < 0) {
      throw new RangeError('multiply修改器不能使用负数');
    }
    if (!Number.isSafeInteger(modifier.priority)) {
      throw new RangeError('属性修改器priority必须是安全整数');
    }
    const identity = `${modifier.sourceId}:${modifier.stat}:${modifier.operation}`;
    if (identities.has(identity)) {
      throw new Error(`存在重复属性修改器：${identity}`);
    }
    identities.add(identity);
  }
}

export function aggregateCombatStats(
  baseStats: CombatStats,
  modifiers: readonly CombatModifier[],
): CombatStatsAggregationResult {
  validateModifiers(modifiers);
  const raw = { ...baseStats } as Record<CombatStatName, number>;
  const pendingDetails = {} as Record<
    CombatStatName,
    Omit<CombatStatAggregationDetail, 'finalValue'>
  >;

  for (const stat of COMBAT_STAT_NAMES) {
    const matching = modifiers
      .filter((modifier) => modifier.stat === stat)
      .sort(compareModifiers);
    const addModifiers = matching.filter(
      (modifier) => modifier.operation === 'add',
    );
    const multiplyModifiers = matching.filter(
      (modifier) => modifier.operation === 'multiply',
    );
    const overrideModifier = matching.find(
      (modifier) => modifier.operation === 'override',
    ) ?? null;

    let value = baseStats[stat];
    for (const modifier of addModifiers) value += modifier.value;
    for (const modifier of multiplyModifiers) value *= modifier.value;
    if (overrideModifier !== null) value = overrideModifier.value;
    raw[stat] = value;
    pendingDetails[stat] = {
      stat,
      baseValue: baseStats[stat],
      addModifiers: Object.freeze([...addModifiers]),
      multiplyModifiers: Object.freeze([...multiplyModifiers]),
      overrideModifier,
      valueBeforeRules: value,
    };
  }

  const stats = createCombatStats(raw);
  const details = {} as Record<CombatStatName, CombatStatAggregationDetail>;
  for (const stat of COMBAT_STAT_NAMES) {
    details[stat] = Object.freeze({
      ...pendingDetails[stat],
      finalValue: stats[stat],
    });
  }
  return { stats, details: Object.freeze(details) };
}

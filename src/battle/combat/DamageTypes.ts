export const DAMAGE_TYPES = [
  'physical',
  'fire',
  'ice',
  'lightning',
  'nature',
  'true',
] as const;

export type DamageType = (typeof DAMAGE_TYPES)[number];

export const DAMAGE_TAGS = [
  'basicAttack',
  'skill',
  'projectile',
  'dot',
  'summon',
  'aoe',
] as const;

export type DamageTag = (typeof DAMAGE_TAGS)[number];

const DAMAGE_TYPE_SET = new Set<string>(DAMAGE_TYPES);
const DAMAGE_TAG_ORDER = new Map<string, number>(
  DAMAGE_TAGS.map((tag, index) => [tag, index]),
);

export function isDamageType(value: unknown): value is DamageType {
  return typeof value === 'string' && DAMAGE_TYPE_SET.has(value);
}

export function assertDamageType(
  value: unknown,
  label = '伤害类型',
): asserts value is DamageType {
  if (!isDamageType(value)) {
    throw new RangeError(`${label}无效：${String(value)}`);
  }
}

export function createDamageTags(
  ...tags: readonly DamageTag[]
): readonly DamageTag[] {
  const unique = new Set<DamageTag>();
  for (const tag of tags) {
    if (!DAMAGE_TAG_ORDER.has(tag)) {
      throw new RangeError(`伤害标签无效：${String(tag)}`);
    }
    unique.add(tag);
  }
  return Object.freeze(
    [...unique].sort(
      (left, right) =>
        (DAMAGE_TAG_ORDER.get(left) ?? 0) -
        (DAMAGE_TAG_ORDER.get(right) ?? 0),
    ),
  );
}

export function assertDamageTags(
  tags: readonly DamageTag[],
): void {
  if (!Array.isArray(tags)) throw new TypeError('伤害标签必须是数组');
  for (const tag of tags) {
    if (!DAMAGE_TAG_ORDER.has(tag)) {
      throw new RangeError(`伤害标签无效：${String(tag)}`);
    }
  }
}

export function hasDamageTag(
  tags: readonly DamageTag[],
  tag: DamageTag,
): boolean {
  return tags.includes(tag);
}

export function getConfiguredDamageType(
  damageType: DamageType | undefined,
): DamageType {
  if (damageType === undefined) return 'physical';
  assertDamageType(damageType);
  return damageType;
}

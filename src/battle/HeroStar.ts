/** 局内英雄星级的唯一权威范围。 */
export const HERO_STARS = [1, 2, 3, 4] as const;

export type HeroStar = (typeof HERO_STARS)[number];

export const MIN_HERO_STAR: HeroStar = 1;
export const MAX_HERO_STAR: HeroStar = 4;

export function isHeroStar(value: unknown): value is HeroStar {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= MIN_HERO_STAR &&
    value <= MAX_HERO_STAR
  );
}

export function assertHeroStar(
  value: unknown,
  label = '英雄星级',
): asserts value is HeroStar {
  if (!isHeroStar(value)) {
    throw new RangeError(
      `${label}必须是 ${MIN_HERO_STAR}～${MAX_HERO_STAR} 的整数`,
    );
  }
}

export function toHeroStar(value: unknown, label = '英雄星级'): HeroStar {
  assertHeroStar(value, label);
  return value;
}

export function isMaximumHeroStar(star: HeroStar): boolean {
  assertHeroStar(star);
  return star === MAX_HERO_STAR;
}

export function canUpgradeHeroStar(star: HeroStar): boolean {
  assertHeroStar(star);
  return star < MAX_HERO_STAR;
}

export function getNextHeroStar(star: HeroStar): HeroStar | null {
  if (!canUpgradeHeroStar(star)) return null;
  return toHeroStar(star + 1, '升星结果');
}

/** 一个该星级英雄等价消耗的 1 星基础单位数量。 */
export function getHeroStarUnitValue(star: HeroStar): 1 | 2 | 4 | 8 {
  assertHeroStar(star);
  return (2 ** (star - MIN_HERO_STAR)) as 1 | 2 | 4 | 8;
}

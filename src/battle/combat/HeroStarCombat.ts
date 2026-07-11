import { assertHeroStar, type HeroStar } from '../HeroStar';

const HERO_STAR_DAMAGE_MULTIPLIERS: Readonly<Record<HeroStar, number>> =
  Object.freeze({
    1: 1,
    2: 1.65,
    3: 2.65,
    4: 4.1,
  });

export function getHeroStarDamageMultiplier(star: HeroStar): number {
  assertHeroStar(star);
  return HERO_STAR_DAMAGE_MULTIPLIERS[star];
}

import {
  canUpgradeHeroStar,
  isMaximumHeroStar,
  type HeroStar,
} from '../../battle/HeroStar';

export interface HeroStarUiState {
  readonly star: HeroStar;
  readonly icons: string;
  readonly shortLabel: string;
  readonly detailLabel: string;
  readonly maximum: boolean;
  readonly canUpgrade: boolean;
}

export function deriveHeroStarUiState(star: HeroStar): HeroStarUiState {
  const icons = '★'.repeat(star);
  const maximum = isMaximumHeroStar(star);
  return {
    star,
    icons,
    shortLabel: maximum ? `${icons} · 满星` : icons,
    detailLabel: maximum ? `${icons}  ${star} 星 · 满星` : `${icons}  ${star} 星`,
    maximum,
    canUpgrade: canUpgradeHeroStar(star),
  };
}

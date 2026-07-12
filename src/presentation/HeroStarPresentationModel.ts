import type { HeroStar } from '../battle/HeroStar';

export interface HeroVisualEcho {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly sizeScale: number;
  readonly alpha: number;
}

export interface HeroStarPresentationModel {
  readonly starLevel: HeroStar;
  readonly mainSizeScale: number;
  readonly echoes: readonly HeroVisualEcho[];
  readonly showMaximumStarAura: boolean;
}

export function deriveHeroStarPresentation(
  starLevel: HeroStar,
): HeroStarPresentationModel {
  if (starLevel === 1) {
    return frozen(starLevel, 1, [], false);
  }
  if (starLevel === 2) {
    return frozen(
      starLevel,
      1,
      [{ offsetX: -13, offsetY: 3, sizeScale: 0.52, alpha: 0.52 }],
      false,
    );
  }
  if (starLevel === 3) {
    return frozen(
      starLevel,
      1,
      [
        { offsetX: -15, offsetY: 5, sizeScale: 0.48, alpha: 0.46 },
        { offsetX: 15, offsetY: 5, sizeScale: 0.48, alpha: 0.46 },
      ],
      false,
    );
  }
  return frozen(starLevel, 1.1, [], true);
}

function frozen(
  starLevel: HeroStar,
  mainSizeScale: number,
  echoes: readonly HeroVisualEcho[],
  showMaximumStarAura: boolean,
): HeroStarPresentationModel {
  return Object.freeze({
    starLevel,
    mainSizeScale,
    echoes: Object.freeze(echoes.map((echo) => Object.freeze({ ...echo }))),
    showMaximumStarAura,
  });
}

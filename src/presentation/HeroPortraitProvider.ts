import type { AssetRegistry } from '../assets/AssetRegistry';
import type { HeroVisualRegistry } from './VisualDefinitions';

export type HeroPortrait =
  | {
      readonly kind: 'texture';
      readonly textureKey: string;
      readonly assetId: string;
    }
  | {
      readonly kind: 'programmatic';
      readonly color: number;
      readonly shape: string;
    };

export class HeroPortraitProvider {
  public constructor(
    private readonly assets: AssetRegistry,
    private readonly visuals: HeroVisualRegistry,
  ) {}

  public getPortrait(heroId: string): HeroPortrait {
    const definition = this.visuals.get(heroId);
    const textureKey = this.assets.getAvailablePhaserKey(
      definition.portraitAssetId,
    );
    if (definition.portraitAssetId !== undefined && textureKey !== null) {
      return {
        kind: 'texture',
        textureKey,
        assetId: definition.portraitAssetId,
      };
    }
    return {
      kind: 'programmatic',
      color: definition.fallbackColor,
      shape: definition.fallbackShape,
    };
  }
}

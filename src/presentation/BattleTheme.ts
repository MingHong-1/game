import type { AssetRegistry } from '../assets/AssetRegistry';

export interface BattleThemeDefinition {
  readonly themeId: string;
  readonly backgroundAssetId?: string;
  readonly foregroundAssetId?: string;
  readonly roadVisualStyle: string;
  readonly coreVisualStyle: string;
  readonly ambientEffectStyle: string;
  readonly battleMusicAssetId?: string;
  readonly bossMusicAssetId?: string;
  readonly ambienceAssetId?: string;
  readonly uiThemeOverrideId?: string;
  readonly background: {
    readonly fit: 'cover' | 'contain' | 'stretch';
    readonly alignX: number;
    readonly alignY: number;
    readonly depth: number;
  };
  readonly foregroundDepth: number;
}

export interface ResolvedBattleTheme {
  readonly definition: BattleThemeDefinition;
  readonly backgroundTextureKey: string | null;
  readonly foregroundTextureKey: string | null;
  readonly battleMusicKey: string | null;
  readonly bossMusicKey: string | null;
  readonly ambienceKey: string | null;
  readonly usesProgrammaticBackground: boolean;
}

export class BattleThemeRegistry {
  private readonly definitions = new Map<string, BattleThemeDefinition>();

  public constructor(definitions: readonly BattleThemeDefinition[]) {
    for (const definition of definitions) {
      if (this.definitions.has(definition.themeId)) {
        throw new Error(`战斗主题存在重复 id：${definition.themeId}`);
      }
      this.definitions.set(definition.themeId, definition);
    }
  }

  public get(themeId: string): BattleThemeDefinition {
    const definition = this.definitions.get(themeId);
    if (definition === undefined) throw new Error(`未知战斗主题：${themeId}`);
    return definition;
  }

  public resolve(themeId: string, assets: AssetRegistry): ResolvedBattleTheme {
    const definition = this.get(themeId);
    const backgroundTextureKey = assets.getAvailablePhaserKey(
      definition.backgroundAssetId,
    );
    return {
      definition,
      backgroundTextureKey,
      foregroundTextureKey: assets.getAvailablePhaserKey(
        definition.foregroundAssetId,
      ),
      battleMusicKey: assets.getAvailablePhaserKey(
        definition.battleMusicAssetId,
      ),
      bossMusicKey: assets.getAvailablePhaserKey(
        definition.bossMusicAssetId,
      ),
      ambienceKey: assets.getAvailablePhaserKey(definition.ambienceAssetId),
      usesProgrammaticBackground: backgroundTextureKey === null,
    };
  }
}

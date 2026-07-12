import type { AssetRegistry } from '../assets/AssetRegistry';
import type { HeroRole } from '../battle/definitions';
import { assertHeroStar, type HeroStar } from '../battle/HeroStar';
import type {
  EntityAnimationSet,
  EntityVisualState,
} from './AnimationDefinitions';

export type FallbackShape =
  | 'circle'
  | 'triangle'
  | 'star'
  | 'octagram'
  | 'diamond'
  | 'hexagon';
export type VisualFacing = 'left' | 'right' | 'forward';

export interface VisualAnchor {
  readonly x: number;
  readonly y: number;
}

export interface VisualOffset {
  readonly x: number;
  readonly y: number;
}

export interface HeroVisualDefinition {
  readonly heroId: string;
  readonly role: HeroRole;
  readonly portraitAssetId?: string;
  readonly battle1StarAssetId?: string;
  readonly battle3StarAssetId?: string;
  readonly battle4StarAssetId?: string;
  readonly spriteSheetAssetId?: string;
  readonly fallbackColor: number;
  readonly fallbackShape: FallbackShape;
  readonly defaultScale: number;
  readonly footAnchor: VisualAnchor;
  readonly portraitAnchor: VisualAnchor;
  readonly slotOffset: VisualOffset;
  readonly defaultFacing: VisualFacing;
  readonly depth: number;
  readonly showName: boolean;
  readonly idle: {
    readonly scaleAmount: number;
    readonly durationMs: number;
  };
  readonly statusAttachPoints: Readonly<Record<string, VisualOffset>>;
  readonly animations?: EntityAnimationSet;
}

export type EnemyBodySize = 'small' | 'medium' | 'large' | 'boss';

export interface EnemyVisualDefinition {
  readonly enemyId: string;
  readonly iconAssetId?: string;
  readonly battleImageAssetId?: string;
  readonly spriteSheetAssetId?: string;
  readonly fallbackShape: FallbackShape;
  readonly fallbackColor: number;
  readonly displayScale: number;
  readonly footAnchor: VisualAnchor;
  readonly healthBarOffsetY: number;
  readonly bodySize: EnemyBodySize;
  readonly elite: boolean;
  readonly boss: boolean;
  readonly depth: number;
  readonly statusAttachPoints: Readonly<Record<string, VisualOffset>>;
  readonly animations?: EntityAnimationSet;
}

export interface ProgrammaticVisualSelection {
  readonly kind: 'programmatic';
  readonly color: number;
  readonly shape: FallbackShape;
}

export interface TextureVisualSelection {
  readonly kind: 'texture';
  readonly assetId: string;
  readonly textureKey: string;
  readonly sourceTier?: 1 | 3 | 4;
}

export type VisualSelection =
  | ProgrammaticVisualSelection
  | TextureVisualSelection;

export function resolveHeroBodyScale(
  sourceKind: VisualSelection['kind'],
  configuredTextureScale: number,
  sourceWidth: number,
  sourceHeight: number,
  maximumDisplaySize: number,
): number {
  for (const [label, value] of [
    ['configuredTextureScale', configuredTextureScale],
    ['sourceWidth', sourceWidth],
    ['sourceHeight', sourceHeight],
    ['maximumDisplaySize', maximumDisplaySize],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`${label}必须是正有限数字`);
    }
  }
  const largestDimension = Math.max(sourceWidth, sourceHeight);
  const preferredScale = sourceKind === 'texture' ? configuredTextureScale : 1;
  return Math.min(preferredScale, maximumDisplaySize / largestDimension);
}

function createRegistry<TDefinition>(
  definitions: readonly TDefinition[],
  getId: (definition: TDefinition) => string,
  label: string,
): ReadonlyMap<string, TDefinition> {
  const registry = new Map<string, TDefinition>();
  for (const definition of definitions) {
    const id = getId(definition);
    if (registry.has(id)) throw new Error(`${label}存在重复 id：${id}`);
    registry.set(id, definition);
  }
  return registry;
}

export class HeroVisualRegistry {
  private readonly definitions: ReadonlyMap<string, HeroVisualDefinition>;

  public constructor(definitions: readonly HeroVisualDefinition[]) {
    this.definitions = createRegistry(
      definitions,
      (definition) => definition.heroId,
      '英雄视觉定义',
    );
  }

  public get(heroId: string): HeroVisualDefinition {
    const definition = this.definitions.get(heroId);
    if (definition === undefined) throw new Error(`缺少英雄视觉定义：${heroId}`);
    return definition;
  }
}

export class EnemyVisualRegistry {
  private readonly definitions: ReadonlyMap<string, EnemyVisualDefinition>;

  public constructor(definitions: readonly EnemyVisualDefinition[]) {
    this.definitions = createRegistry(
      definitions,
      (definition) => definition.enemyId,
      '敌人视觉定义',
    );
  }

  public get(enemyId: string): EnemyVisualDefinition {
    const definition = this.definitions.get(enemyId);
    if (definition === undefined) throw new Error(`缺少敌人视觉定义：${enemyId}`);
    return definition;
  }
}

export function selectHeroBattleVisual(
  definition: HeroVisualDefinition,
  starLevel: HeroStar,
  assets: AssetRegistry,
): VisualSelection {
  assertHeroStar(starLevel);
  const tiers: ReadonlyArray<readonly [1 | 3 | 4, string | undefined]> =
    starLevel === 4
      ? [
          [4, definition.battle4StarAssetId],
          [3, definition.battle3StarAssetId],
          [1, definition.battle1StarAssetId],
        ]
      : starLevel === 3
        ? [
            [3, definition.battle3StarAssetId],
            [1, definition.battle1StarAssetId],
          ]
        : [[1, definition.battle1StarAssetId]];
  for (const [tier, assetId] of tiers) {
    const textureKey = assets.getAvailablePhaserKey(assetId);
    if (assetId !== undefined && textureKey !== null) {
      return { kind: 'texture', assetId, textureKey, sourceTier: tier };
    }
  }
  return {
    kind: 'programmatic',
    color: definition.fallbackColor,
    shape: definition.fallbackShape,
  };
}

export function selectEnemyBattleVisual(
  definition: EnemyVisualDefinition,
  assets: AssetRegistry,
): VisualSelection {
  for (const assetId of [
    definition.spriteSheetAssetId,
    definition.battleImageAssetId,
  ]) {
    const textureKey = assets.getAvailablePhaserKey(assetId);
    if (assetId !== undefined && textureKey !== null) {
      return { kind: 'texture', assetId, textureKey };
    }
  }
  return {
    kind: 'programmatic',
    color: definition.fallbackColor,
    shape: definition.fallbackShape,
  };
}

export interface VisualStateRequest {
  readonly state: EntityVisualState;
  readonly force?: boolean;
}

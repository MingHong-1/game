export const ASSET_TYPES = [
  'heroPortrait',
  'heroBattleImage',
  'heroSpriteSheet',
  'enemyBattleImage',
  'enemySpriteSheet',
  'textureAtlas',
  'background',
  'foreground',
  'projectileTexture',
  'impactTexture',
  'statusTexture',
  'ambientTexture',
  'music',
  'ambience',
  'soundEffect',
  'bitmapFont',
  'webFont',
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];
export type AssetAvailability =
  | 'disabled'
  | 'registered'
  | 'queued'
  | 'available'
  | 'failed';
export type AssetFallbackStrategy =
  | 'programmatic'
  | 'static-image'
  | 'silent'
  | 'system-font';

export interface AssetOwner {
  readonly kind: 'hero' | 'enemy' | 'theme' | 'effect' | 'audio' | 'font';
  readonly id: string;
}

export interface SpriteSheetLoadOptions {
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly startFrame?: number;
  readonly endFrame?: number;
  readonly margin?: number;
  readonly spacing?: number;
}

export interface BitmapFontLoadOptions {
  readonly dataPath: string;
}

export interface TextureAtlasLoadOptions {
  readonly dataPath: string;
}

export interface AssetManifestEntry {
  readonly assetId: string;
  readonly assetType: AssetType;
  /** 相对于 public/ 的路径，必须以 assets/ 开头。 */
  readonly filePath: string;
  readonly phaserKey: string;
  readonly enabled: boolean;
  readonly preloadGroup: string;
  readonly owner: AssetOwner;
  readonly required: boolean;
  readonly fallback: AssetFallbackStrategy;
  readonly spriteSheet?: SpriteSheetLoadOptions;
  readonly textureAtlas?: TextureAtlasLoadOptions;
  readonly bitmapFont?: BitmapFontLoadOptions;
}

export interface AssetManifest {
  readonly version: 1;
  readonly entries: readonly AssetManifestEntry[];
}

function isSafeLocalAssetPath(filePath: string): boolean {
  return (
    filePath.startsWith('assets/') &&
    !filePath.includes('..') &&
    !filePath.includes('\\') &&
    !filePath.includes('://')
  );
}

export function validateAssetManifest(manifest: AssetManifest): void {
  const assetIds = new Set<string>();
  const phaserKeys = new Set<string>();
  const validTypes = new Set<string>(ASSET_TYPES);

  for (const entry of manifest.entries) {
    if (entry.assetId.trim().length === 0) {
      throw new Error('资源清单中的 assetId 不能为空');
    }
    if (assetIds.has(entry.assetId)) {
      throw new Error(`资源清单存在重复 assetId：${entry.assetId}`);
    }
    assetIds.add(entry.assetId);

    if (entry.phaserKey.trim().length === 0) {
      throw new Error(`资源 ${entry.assetId} 的 Phaser key 不能为空`);
    }
    if (phaserKeys.has(entry.phaserKey)) {
      throw new Error(`资源清单存在重复 Phaser key：${entry.phaserKey}`);
    }
    phaserKeys.add(entry.phaserKey);

    if (!validTypes.has(entry.assetType)) {
      throw new Error(`资源 ${entry.assetId} 使用了非法类型：${entry.assetType}`);
    }
    if (!isSafeLocalAssetPath(entry.filePath)) {
      throw new Error(`资源 ${entry.assetId} 必须使用 assets/ 下的安全本地路径`);
    }
    if (entry.preloadGroup.trim().length === 0) {
      throw new Error(`资源 ${entry.assetId} 的 preloadGroup 不能为空`);
    }
    if (
      (entry.assetType === 'heroSpriteSheet' ||
        entry.assetType === 'enemySpriteSheet') &&
      (entry.spriteSheet === undefined ||
        !Number.isFinite(entry.spriteSheet.frameWidth) ||
        entry.spriteSheet.frameWidth <= 0 ||
        !Number.isFinite(entry.spriteSheet.frameHeight) ||
        entry.spriteSheet.frameHeight <= 0)
    ) {
      throw new Error(`Sprite Sheet ${entry.assetId} 缺少有效帧尺寸`);
    }
    if (
      entry.assetType === 'textureAtlas' &&
      (entry.textureAtlas === undefined ||
        !isSafeLocalAssetPath(entry.textureAtlas.dataPath))
    ) {
      throw new Error(`Texture Atlas ${entry.assetId} 缺少有效数据路径`);
    }
    if (
      entry.assetType === 'bitmapFont' &&
      (entry.bitmapFont === undefined ||
        !isSafeLocalAssetPath(entry.bitmapFont.dataPath))
    ) {
      throw new Error(`Bitmap Font ${entry.assetId} 缺少有效数据路径`);
    }
  }
}

export const HERO_BATTLE_1_STAR_ASSET_IDS = Object.freeze({
  galeHunter: 'hero.gale-hunter.battle.1star',
  emberMage: 'hero.ember-mage.battle.1star',
  stoneVanguard: 'hero.stone-vanguard.battle.1star',
  starlightPriest: 'hero.starlight-priest.battle.1star',
});

function heroBattleImageEntry(
  assetId: string,
  heroId: string,
  filePath: string,
): AssetManifestEntry {
  const entry: AssetManifestEntry = {
    assetId,
    assetType: 'heroBattleImage',
    filePath,
    phaserKey: `hero:${heroId}:battle:1star`,
    enabled: true,
    preloadGroup: 'battle-core',
    owner: { kind: 'hero', id: heroId },
    required: false,
    fallback: 'programmatic',
  };
  return Object.freeze(entry);
}

/** 只登记已经实际存在、完成规格核对并明确启用的本地资源。 */
export const GAME_ASSET_MANIFEST: AssetManifest = Object.freeze({
  version: 1,
  entries: Object.freeze([
    heroBattleImageEntry(
      HERO_BATTLE_1_STAR_ASSET_IDS.galeHunter,
      'gale-hunter',
      'assets/heroes/wind-hunter/runtime/battle-1star.png',
    ),
    heroBattleImageEntry(
      HERO_BATTLE_1_STAR_ASSET_IDS.emberMage,
      'ember-mage',
      'assets/heroes/ember-mage/runtime/battle-1star.png',
    ),
    heroBattleImageEntry(
      HERO_BATTLE_1_STAR_ASSET_IDS.stoneVanguard,
      'stone-vanguard',
      'assets/heroes/stone-vanguard/runtime/battle-1star.png',
    ),
    heroBattleImageEntry(
      HERO_BATTLE_1_STAR_ASSET_IDS.starlightPriest,
      'starlight-priest',
      'assets/heroes/starlight-priest/runtime/battle-1star.png',
    ),
  ]),
});

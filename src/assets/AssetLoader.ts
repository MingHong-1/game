import type { AssetManifestEntry } from './AssetManifest';
import { AssetRegistry } from './AssetRegistry';

export interface PhaserLoadQueue {
  image(key: string, url: string): unknown;
  spritesheet(
    key: string,
    url: string,
    config: {
      frameWidth: number;
      frameHeight: number;
      startFrame?: number;
      endFrame?: number;
      margin?: number;
      spacing?: number;
    },
  ): unknown;
  audio(key: string, urls: string | string[]): unknown;
  atlas(key: string, textureURL: string, atlasURL: string): unknown;
  bitmapFont(key: string, textureURL: string, fontDataURL: string): unknown;
}

const IMAGE_TYPES = new Set<AssetManifestEntry['assetType']>([
  'heroPortrait',
  'heroBattleImage',
  'enemyBattleImage',
  'background',
  'foreground',
  'projectileTexture',
  'impactTexture',
  'statusTexture',
  'ambientTexture',
]);

const AUDIO_TYPES = new Set<AssetManifestEntry['assetType']>([
  'music',
  'ambience',
  'soundEffect',
]);

export class AssetLoader {
  public constructor(private readonly registry: AssetRegistry) {}

  public queueEnabled(
    load: PhaserLoadQueue,
    preloadGroup?: string,
  ): readonly AssetManifestEntry[] {
    const queued: AssetManifestEntry[] = [];
    for (const entry of this.registry.getEnabledEntries(preloadGroup)) {
      this.queueEntry(load, entry);
      this.registry.markQueued(entry.assetId);
      queued.push(entry);
    }
    return queued;
  }

  private queueEntry(load: PhaserLoadQueue, entry: AssetManifestEntry): void {
    if (IMAGE_TYPES.has(entry.assetType)) {
      load.image(entry.phaserKey, entry.filePath);
      return;
    }
    if (
      entry.assetType === 'heroSpriteSheet' ||
      entry.assetType === 'enemySpriteSheet'
    ) {
      if (entry.spriteSheet === undefined) {
        throw new Error(`Sprite Sheet ${entry.assetId} 缺少加载参数`);
      }
      load.spritesheet(entry.phaserKey, entry.filePath, entry.spriteSheet);
      return;
    }
    if (AUDIO_TYPES.has(entry.assetType)) {
      load.audio(entry.phaserKey, entry.filePath);
      return;
    }
    if (entry.assetType === 'textureAtlas') {
      if (entry.textureAtlas === undefined) {
        throw new Error(`Texture Atlas ${entry.assetId} 缺少数据路径`);
      }
      load.atlas(
        entry.phaserKey,
        entry.filePath,
        entry.textureAtlas.dataPath,
      );
      return;
    }
    if (entry.assetType === 'bitmapFont') {
      if (entry.bitmapFont === undefined) {
        throw new Error(`Bitmap Font ${entry.assetId} 缺少数据路径`);
      }
      load.bitmapFont(
        entry.phaserKey,
        entry.filePath,
        entry.bitmapFont.dataPath,
      );
      return;
    }
    // webFont 由未来字体加载适配器处理；启用前必须先实现适配器。
    if (entry.assetType === 'webFont') {
      throw new Error(`Web Font ${entry.assetId} 尚无加载适配器`);
    }
    throw new Error(`未支持资源类型：${entry.assetType}`);
  }
}

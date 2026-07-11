import { describe, expect, it } from 'vitest';

import { AssetLoader, type PhaserLoadQueue } from '../src/assets/AssetLoader';
import {
  type AssetManifest,
  type AssetManifestEntry,
  type AssetType,
  validateAssetManifest,
  GAME_ASSET_MANIFEST,
} from '../src/assets/AssetManifest';
import { AssetRegistry } from '../src/assets/AssetRegistry';

function entry(
  assetId: string,
  overrides: Partial<AssetManifestEntry> = {},
): AssetManifestEntry {
  return {
    assetId,
    assetType: 'heroBattleImage',
    filePath: `assets/test/${assetId}.png`,
    phaserKey: `test:${assetId}`,
    enabled: true,
    preloadGroup: 'battle',
    owner: { kind: 'hero', id: 'test-hero' },
    required: false,
    fallback: 'programmatic',
    ...overrides,
  };
}

function manifest(entries: readonly AssetManifestEntry[]): AssetManifest {
  return { version: 1, entries };
}

describe('AssetManifest 与 AssetRegistry', () => {
  it('当前正式清单为空，因此默认启动不会请求不存在的资源', () => {
    const registry = new AssetRegistry(GAME_ASSET_MANIFEST);
    expect(registry.getEnabledEntries()).toEqual([]);
  });

  it('未启用资源不进入加载队列且保持 disabled', () => {
    const disabled = entry('disabled', { enabled: false });
    const registry = new AssetRegistry(manifest([disabled]));
    const calls: string[] = [];
    const load = createLoadQueue(calls);
    expect(new AssetLoader(registry).queueEnabled(load)).toEqual([]);
    expect(calls).toEqual([]);
    expect(registry.getStatus('disabled')?.availability).toBe('disabled');
  });

  it('重复 assetId 和 Phaser key 均 fail-close', () => {
    expect(() => validateAssetManifest(manifest([
      entry('same'),
      entry('same', { phaserKey: 'other' }),
    ]))).toThrow('重复 assetId');
    expect(() => validateAssetManifest(manifest([
      entry('first', { phaserKey: 'same-key' }),
      entry('second', { phaserKey: 'same-key' }),
    ]))).toThrow('重复 Phaser key');
  });

  it('非法类型、空路径和远程路径均被拒绝', () => {
    expect(() => validateAssetManifest(manifest([
      entry('bad-type', { assetType: 'video' as AssetType }),
    ]))).toThrow('非法类型');
    expect(() => validateAssetManifest(manifest([
      entry('empty-path', { filePath: '' }),
    ]))).toThrow('安全本地路径');
    expect(() => validateAssetManifest(manifest([
      entry('remote', { filePath: 'https://example.com/a.png' }),
    ]))).toThrow('安全本地路径');
  });

  it('只按启用项和分组加入正确 Phaser 队列', () => {
    const entries = [
      entry('image'),
      entry('sheet', {
        assetType: 'enemySpriteSheet',
        filePath: 'assets/test/sheet.png',
        phaserKey: 'sheet',
        owner: { kind: 'enemy', id: 'enemy' },
        spriteSheet: { frameWidth: 64, frameHeight: 64 },
      }),
      entry('sound', {
        assetType: 'soundEffect',
        filePath: 'assets/test/sound.ogg',
        phaserKey: 'sound',
        owner: { kind: 'audio', id: 'ui.click' },
        fallback: 'silent',
      }),
      entry('atlas', {
        assetType: 'textureAtlas',
        filePath: 'assets/test/entities.png',
        phaserKey: 'entities-atlas',
        owner: { kind: 'effect', id: 'entities' },
        textureAtlas: { dataPath: 'assets/test/entities.json' },
      }),
      entry('later', { preloadGroup: 'chapter-2' }),
    ];
    const registry = new AssetRegistry(manifest(entries));
    const calls: string[] = [];
    const queued = new AssetLoader(registry).queueEnabled(
      createLoadQueue(calls),
      'battle',
    );
    expect(queued.map((item) => item.assetId)).toEqual([
      'image',
      'sheet',
      'sound',
      'atlas',
    ]);
    expect(calls).toEqual([
      'image:image',
      'sheet:sheet',
      'audio:sound',
      'atlas:entities-atlas',
    ]);
  });

  it('可选资源失败只记录一次并保持 fallback 可用', () => {
    const registry = new AssetRegistry(manifest([entry('optional')]));
    registry.markQueued('optional');
    registry.markFailedByPhaserKey('test:optional', 'missing');
    const reports: string[] = [];
    registry.reportFailureOnce('optional', (status) => reports.push(status.entry.assetId));
    registry.reportFailureOnce('optional', (status) => reports.push(status.entry.assetId));
    expect(reports).toEqual(['optional']);
    expect(registry.isAvailable('optional')).toBe(false);
    expect(registry.getRequiredFailures()).toEqual([]);
  });
});

function createLoadQueue(calls: string[]): PhaserLoadQueue {
  return {
    image: (_key, url) => calls.push(`image:${url.replace('assets/test/', '').replace('.png', '')}`),
    spritesheet: (key) => calls.push(`sheet:${key}`),
    audio: (key) => calls.push(`audio:${key}`),
    atlas: (key) => calls.push(`atlas:${key}`),
    bitmapFont: (key) => calls.push(`font:${key}`),
  };
}

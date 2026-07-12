import { describe, expect, it } from 'vitest';

import { AssetLoader, type PhaserLoadQueue } from '../src/assets/AssetLoader';
import {
  type AssetManifest,
  type AssetManifestEntry,
  type AssetType,
  validateAssetManifest,
  GAME_ASSET_MANIFEST,
  HERO_BATTLE_1_STAR_ASSET_IDS,
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
  it('最终只登记并加载四名运行时英雄的1星真实资源', () => {
    const registry = new AssetRegistry(GAME_ASSET_MANIFEST);
    expect(registry.getEnabledEntries()).toEqual([
      expect.objectContaining({
        assetId: HERO_BATTLE_1_STAR_ASSET_IDS.galeHunter,
        filePath: 'assets/heroes/wind-hunter/battle-1star.png',
        phaserKey: 'hero:gale-hunter:battle:1star',
      }),
      expect.objectContaining({
        assetId: HERO_BATTLE_1_STAR_ASSET_IDS.emberMage,
        filePath: 'assets/heroes/ember-mage/battle-1star.png',
        phaserKey: 'hero:ember-mage:battle:1star',
      }),
      expect.objectContaining({
        assetId: HERO_BATTLE_1_STAR_ASSET_IDS.stoneVanguard,
        filePath: 'assets/heroes/stone-vanguard/battle-1star.png',
        phaserKey: 'hero:stone-vanguard:battle:1star',
      }),
      expect.objectContaining({
        assetId: HERO_BATTLE_1_STAR_ASSET_IDS.starlightPriest,
        filePath: 'assets/heroes/starlight-priest/battle-1star.png',
        phaserKey: 'hero:starlight-priest:battle:1star',
      }),
    ]);
    for (const item of registry.getEnabledEntries()) {
      expect(item).toMatchObject({
        assetType: 'heroBattleImage',
        enabled: true,
        preloadGroup: 'battle-core',
        required: false,
        fallback: 'programmatic',
      });
      expect(item.filePath.startsWith('assets/heroes/')).toBe(true);
    }
    expect(new Set(GAME_ASSET_MANIFEST.entries.map((item) => item.assetId)).size)
      .toBe(4);
    expect(new Set(GAME_ASSET_MANIFEST.entries.map((item) => item.phaserKey)).size)
      .toBe(4);
    expect(
      GAME_ASSET_MANIFEST.entries.some(
        (item) => item.owner.id === 'forest-summoner',
      ),
    ).toBe(false);
    expect(
      GAME_ASSET_MANIFEST.entries.some((item) => /battle[.-](3|4)star/.test(item.assetId)),
    ).toBe(false);
  });

  it('四张启用PNG进入图片加载队列且没有其他资源请求', () => {
    const registry = new AssetRegistry(GAME_ASSET_MANIFEST);
    const calls: string[] = [];
    const queued = new AssetLoader(registry).queueEnabled(createLoadQueue(calls));
    expect(queued.map((item) => item.assetId)).toEqual([
      HERO_BATTLE_1_STAR_ASSET_IDS.galeHunter,
      HERO_BATTLE_1_STAR_ASSET_IDS.emberMage,
      HERO_BATTLE_1_STAR_ASSET_IDS.stoneVanguard,
      HERO_BATTLE_1_STAR_ASSET_IDS.starlightPriest,
    ]);
    expect(calls).toEqual([
      'image:assets/heroes/wind-hunter/battle-1star',
      'image:assets/heroes/ember-mage/battle-1star',
      'image:assets/heroes/stone-vanguard/battle-1star',
      'image:assets/heroes/starlight-priest/battle-1star',
    ]);
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

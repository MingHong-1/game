import { describe, expect, it } from 'vitest';

import type { AssetManifest, AssetManifestEntry } from '../src/assets/AssetManifest';
import { AssetRegistry } from '../src/assets/AssetRegistry';
import { HeroPortraitProvider } from '../src/presentation/HeroPortraitProvider';
import {
  EnemyVisualRegistry,
  type HeroVisualDefinition,
  HeroVisualRegistry,
  resolveHeroBodyScale,
  selectEnemyBattleVisual,
  selectHeroBattleVisual,
} from '../src/presentation/VisualDefinitions';
import {
  ENEMY_VISUAL_DEFINITIONS,
  HERO_VISUAL_DEFINITIONS,
  HERO_VISUAL_REGISTRY,
} from '../src/data/visualDefinitions';
import {
  GAME_ASSET_MANIFEST,
  HERO_BATTLE_1_STAR_ASSET_IDS,
} from '../src/assets/AssetManifest';
import { HERO_DEFINITIONS_BY_ID } from '../src/data/heroDefinitions';
import { UI_METRICS } from '../src/ui/theme/uiMetrics';

const TEST_HERO: HeroVisualDefinition = {
  heroId: 'hero-a',
  role: 'marksman',
  portraitAssetId: 'hero-a.portrait',
  battle1StarAssetId: 'hero-a.1',
  battle3StarAssetId: 'hero-a.3',
  battle4StarAssetId: 'hero-a.4',
  fallbackColor: 0x123456,
  fallbackShape: 'star',
  displaySize: 80,
  footAnchor: { x: 0.5, y: 1 },
  portraitAnchor: { x: 0.5, y: 0.5 },
  slotOffset: { x: 0, y: 0 },
  defaultFacing: 'right',
  depth: 1,
  showName: true,
  idle: { scaleAmount: 0.02, durationMs: 1_000 },
  statusAttachPoints: {},
};

function asset(assetId: string, enabled = true): AssetManifestEntry {
  return {
    assetId,
    assetType: assetId.endsWith('portrait') ? 'heroPortrait' : 'heroBattleImage',
    filePath: `assets/test/${assetId}.png`,
    phaserKey: `key:${assetId}`,
    enabled,
    preloadGroup: 'battle',
    owner: { kind: 'hero', id: 'hero-a' },
    required: false,
    fallback: 'programmatic',
  };
}

function availableRegistry(assetIds: readonly string[]): AssetRegistry {
  const manifest: AssetManifest = {
    version: 1,
    entries: assetIds.map((id) => asset(id)),
  };
  const registry = new AssetRegistry(manifest);
  for (const assetId of assetIds) {
    registry.markQueued(assetId);
    registry.markAvailable(assetId);
  }
  return registry;
}

describe('英雄视觉选择', () => {
  it('正式纹理使用独立scale，程序fallback保持原有可读尺寸', () => {
    const maximumDisplaySize = UI_METRICS.slot.heroMaximumDisplaySize;
    expect(maximumDisplaySize).toBe(84);
    expect(resolveHeroBodyScale('texture', 80, 256, 256, maximumDisplaySize))
      .toBeCloseTo(0.3125);
    expect(resolveHeroBodyScale('programmatic', 80, 28, 28, maximumDisplaySize))
      .toBe(1);
    expect(resolveHeroBodyScale('texture', 100, 2_000, 1_000, maximumDisplaySize))
      .toBe(0.042);
  });

  it('四名运行时英雄在1～4星均选择已加载的1星资源作为当前回退节点', () => {
    const assets = new AssetRegistry(GAME_ASSET_MANIFEST);
    for (const entry of GAME_ASSET_MANIFEST.entries) {
      assets.markQueued(entry.assetId);
      assets.markAvailable(entry.assetId);
    }

    const expectedAssets = new Map([
      ['gale-hunter', HERO_BATTLE_1_STAR_ASSET_IDS.galeHunter],
      ['ember-mage', HERO_BATTLE_1_STAR_ASSET_IDS.emberMage],
      ['stone-vanguard', HERO_BATTLE_1_STAR_ASSET_IDS.stoneVanguard],
      ['starlight-priest', HERO_BATTLE_1_STAR_ASSET_IDS.starlightPriest],
    ]);
    for (const [heroId, assetId] of expectedAssets) {
      const definition = HERO_VISUAL_REGISTRY.get(heroId);
      expect(definition.battle3StarAssetId).toBeUndefined();
      expect(definition.battle4StarAssetId).toBeUndefined();
      for (const star of [1, 2, 3, 4] as const) {
        expect(
          selectHeroBattleVisual(definition, star, assets),
        ).toMatchObject({ kind: 'texture', assetId, sourceTier: 1 });
      }
    }
  });

  it('四名英雄的scale、脚底锚点和格位偏移完全来自独立视觉定义', () => {
    expect(HERO_VISUAL_REGISTRY.get('gale-hunter')).toMatchObject({
      displaySize: 80,
      footAnchor: { x: 0.5, y: 0.93 },
      slotOffset: { x: 0, y: 39 },
    });
    expect(HERO_VISUAL_REGISTRY.get('ember-mage')).toMatchObject({
      displaySize: 78,
      footAnchor: { x: 0.5, y: 0.9 },
      slotOffset: { x: 0, y: 36 },
    });
    expect(HERO_VISUAL_REGISTRY.get('stone-vanguard')).toMatchObject({
      displaySize: 78,
      footAnchor: { x: 0.5, y: 0.89 },
      slotOffset: { x: 1, y: 35 },
    });
    expect(HERO_VISUAL_REGISTRY.get('starlight-priest')).toMatchObject({
      displaySize: 78,
      footAnchor: { x: 0.5, y: 0.89 },
      slotOffset: { x: 1, y: 35 },
    });
  });

  it('启用资源失败或不可用时四名英雄均安全回退程序图形', () => {
    const unavailable = new AssetRegistry(GAME_ASSET_MANIFEST);
    for (const heroId of HERO_DEFINITIONS_BY_ID.keys()) {
      expect(
        selectHeroBattleVisual(HERO_VISUAL_REGISTRY.get(heroId), 1, unavailable).kind,
      ).toBe('programmatic');
    }
  });

  it('视觉选择不会修改英雄玩法定义、星级或攻击配置', () => {
    const before = JSON.stringify([...HERO_DEFINITIONS_BY_ID.values()]);
    const assets = new AssetRegistry(GAME_ASSET_MANIFEST);
    for (const entry of GAME_ASSET_MANIFEST.entries) {
      assets.markQueued(entry.assetId);
      assets.markAvailable(entry.assetId);
    }
    for (const heroId of HERO_DEFINITIONS_BY_ID.keys()) {
      selectHeroBattleVisual(HERO_VISUAL_REGISTRY.get(heroId), 1, assets);
    }
    expect(JSON.stringify([...HERO_DEFINITIONS_BY_ID.values()])).toBe(before);
  });

  it('所有资源禁用时使用程序 fallback', () => {
    const assets = new AssetRegistry({
      version: 1,
      entries: [asset('hero-a.1', false)],
    });
    expect(selectHeroBattleVisual(TEST_HERO, 1, assets)).toEqual({
      kind: 'programmatic',
      color: TEST_HERO.fallbackColor,
      shape: TEST_HERO.fallbackShape,
    });
  });

  it('1～2星、3星和4星选择对应资源', () => {
    const assets = availableRegistry(['hero-a.1', 'hero-a.3', 'hero-a.4']);
    expect(selectHeroBattleVisual(TEST_HERO, 1, assets)).toMatchObject({ sourceTier: 1 });
    expect(selectHeroBattleVisual(TEST_HERO, 2, assets)).toMatchObject({ sourceTier: 1 });
    expect(selectHeroBattleVisual(TEST_HERO, 3, assets)).toMatchObject({ sourceTier: 3 });
    expect(selectHeroBattleVisual(TEST_HERO, 4, assets)).toMatchObject({ sourceTier: 4 });
  });

  it('3星资源缺失时回退到1星资源', () => {
    const assets = availableRegistry(['hero-a.1']);
    expect(selectHeroBattleVisual(TEST_HERO, 3, assets)).toMatchObject({
      sourceTier: 1,
    });
  });

  it('4星资源缺失时依次回退到3星和1星资源', () => {
    expect(
      selectHeroBattleVisual(
        TEST_HERO,
        4,
        availableRegistry(['hero-a.1', 'hero-a.3']),
      ),
    ).toMatchObject({ sourceTier: 3 });
    expect(
      selectHeroBattleVisual(
        TEST_HERO,
        4,
        availableRegistry(['hero-a.1']),
      ),
    ).toMatchObject({ sourceTier: 1 });
  });

  it('非法5星输入在视觉边界明确失败而不是被截断', () => {
    expect(() =>
      selectHeroBattleVisual(TEST_HERO, 5 as never, availableRegistry([])),
    ).toThrow('英雄星级必须是 1～4 的整数');
  });

  it('只启用一个英雄资源时不会替换其他英雄', () => {
    const other: HeroVisualDefinition = {
      ...TEST_HERO,
      heroId: 'hero-b',
      battle1StarAssetId: 'hero-b.1',
    };
    const assets = availableRegistry(['hero-a.1']);
    expect(selectHeroBattleVisual(TEST_HERO, 1, assets).kind).toBe('texture');
    expect(selectHeroBattleVisual(other, 1, assets).kind).toBe('programmatic');
  });

  it('头像缺失时返回程序职业色占位', () => {
    const visuals = new HeroVisualRegistry([TEST_HERO]);
    const provider = new HeroPortraitProvider(
      new AssetRegistry({ version: 1, entries: [] }),
      visuals,
    );
    expect(provider.getPortrait('hero-a')).toEqual({
      kind: 'programmatic',
      color: TEST_HERO.fallbackColor,
      shape: TEST_HERO.fallbackShape,
    });
  });
});

describe('怪物视觉定义', () => {
  it('当前所有真实 enemyId 都有视觉定义且Boss可区分', () => {
    const registry = new EnemyVisualRegistry(ENEMY_VISUAL_DEFINITIONS);
    expect(registry.get('void-scout').boss).toBe(false);
    expect(registry.get('rift-overseer')).toMatchObject({
      boss: true,
      bodySize: 'boss',
    });
    expect(selectEnemyBattleVisual(
      registry.get('rift-overseer'),
      new AssetRegistry({ version: 1, entries: [] }),
    ).kind).toBe('programmatic');
  });

  it('森灵唤师只有视觉扩展位，不进入当前四英雄逻辑定义', () => {
    const registry = new HeroVisualRegistry(HERO_VISUAL_DEFINITIONS);
    expect(registry.get('forest-summoner').role).toBe('summoner');
    expect(registry.get('forest-summoner').battle1StarAssetId).toBeUndefined();
    expect(HERO_DEFINITIONS_BY_ID.has('forest-summoner')).toBe(false);
  });
});

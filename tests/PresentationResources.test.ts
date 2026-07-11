import { describe, expect, it } from 'vitest';

import type { AssetManifestEntry } from '../src/assets/AssetManifest';
import { AssetRegistry } from '../src/assets/AssetRegistry';
import { BattlePresentationEventBridge } from '../src/presentation/BattlePresentationEventBridge';
import { createCombatStats } from '../src/battle/combat/CombatStats';
import { createDamageTags } from '../src/battle/combat/DamageTypes';
import { resolveDamage } from '../src/battle/combat/DamageResolver';
import {
  canInterruptAnimation,
  resolveAnimationClip,
  type EntityAnimationSet,
} from '../src/presentation/AnimationDefinitions';
import {
  type BattleThemeDefinition,
  BattleThemeRegistry,
} from '../src/presentation/BattleTheme';
import { PROTOTYPE_LEVEL } from '../src/data/levelDefinitions';

function enabledSheet(): AssetManifestEntry {
  return {
    assetId: 'sheet',
    assetType: 'enemySpriteSheet',
    filePath: 'assets/test/sheet.png',
    phaserKey: 'sheet-key',
    enabled: true,
    preloadGroup: 'battle',
    owner: { kind: 'enemy', id: 'enemy' },
    required: false,
    fallback: 'programmatic',
    spriteSheet: { frameWidth: 64, frameHeight: 64 },
  };
}

describe('动画与表现事件', () => {
  it('动画资源缺失时回退静态/程序视觉，不重复启动同状态', () => {
    const animations: EntityAnimationSet = {
      clips: {
        walk: {
          clipId: 'walk',
          spriteSheetAssetId: 'sheet',
          animationKey: 'enemy:walk',
          frames: { start: 0, end: 3 },
          frameRate: 8,
          repeat: -1,
          yoyo: false,
          fallbackState: 'idle',
          interruptibleByHigherPriority: true,
        },
      },
    };
    expect(resolveAnimationClip(
      animations,
      'walk',
      new AssetRegistry({ version: 1, entries: [] }),
    )).toBeNull();
    expect(canInterruptAnimation('walk', 'walk')).toBe(false);
    expect(canInterruptAnimation('walk', 'death')).toBe(true);
    expect(canInterruptAnimation('death', 'hit')).toBe(false);
  });

  it('已加载Sprite Sheet时解析动画映射', () => {
    const registry = new AssetRegistry({ version: 1, entries: [enabledSheet()] });
    registry.markQueued('sheet');
    registry.markAvailable('sheet');
    const animations: EntityAnimationSet = {
      clips: {
        walk: {
          clipId: 'walk',
          spriteSheetAssetId: 'sheet',
          animationKey: 'enemy:walk',
          frames: { start: 0, end: 3 },
          frameRate: 8,
          repeat: -1,
          yoyo: false,
          interruptibleByHigherPriority: true,
        },
      },
    };
    expect(resolveAnimationClip(animations, 'walk', registry)).toMatchObject({
      state: 'walk',
      textureKey: 'sheet-key',
    });
  });

  it('表现桥接只翻译事件，不生成额外战斗结算', () => {
    const damage = resolveDamage({
      requestId: 'damage-1',
      requestSequence: 1,
      source: { kind: 'hero', instanceId: 'hero-1', definitionId: 'hero' },
      target: { kind: 'enemy', instanceId: 'enemy-1', definitionId: 'void-scout' },
      baseAmount: 20,
      damageType: 'physical',
      tags: createDamageTags('basicAttack', 'projectile'),
      canCrit: false,
      simulationTimeMs: 100,
      sourceStar: 1,
      sourceStats: createCombatStats(),
      targetStats: createCombatStats(),
      targetIsBoss: false,
      targetHpBefore: 100,
    }, { nextFloat: () => { throw new Error('不应消费RNG'); } });
    const events = new BattlePresentationEventBridge().translate([
      {
        type: 'hero-attacked',
        heroInstanceId: 'hero-1',
        targetEnemyInstanceId: 'enemy-1',
        projectileInstanceId: 'projectile-1',
      },
      {
        type: 'damage-applied',
        result: damage,
      },
      {
        type: 'enemy-killed',
        enemyInstanceId: 'enemy-1',
        enemyDefinitionId: 'void-scout',
        enemyKind: 'normal',
        energyReward: 1,
      },
    ]);
    expect(events).toEqual([
      {
        type: 'hero-attack',
        heroInstanceId: 'hero-1',
        projectileInstanceId: 'projectile-1',
        audioEvent: 'hero.attack',
      },
      {
        type: 'enemy-hit',
        enemyInstanceId: 'enemy-1',
        damageType: 'physical',
        appliedDamage: 20,
        isCritical: false,
        isLethal: false,
        tags: ['basicAttack', 'projectile'],
        simulationTimeMs: 100,
        audioEvent: 'enemy.hit',
      },
      {
        type: 'enemy-death',
        enemyInstanceId: 'enemy-1',
        audioEvent: 'enemy.death',
      },
    ]);
  });
});

describe('战斗主题', () => {
  it('背景资源未启用时使用程序雾林且不改变道路配置', () => {
    const theme: BattleThemeDefinition = {
      themeId: 'test-theme',
      backgroundAssetId: 'background',
      roadVisualStyle: 'road',
      coreVisualStyle: 'core',
      ambientEffectStyle: 'mist',
      background: { fit: 'cover', alignX: 0.5, alignY: 0.5, depth: 0 },
      foregroundDepth: 7,
    };
    const registry = new BattleThemeRegistry([theme]);
    const pathBefore = JSON.stringify(PROTOTYPE_LEVEL.path);
    const resolved = registry.resolve(
      'test-theme',
      new AssetRegistry({ version: 1, entries: [] }),
    );
    expect(resolved.usesProgrammaticBackground).toBe(true);
    expect(JSON.stringify(PROTOTYPE_LEVEL.path)).toBe(pathBefore);
    expect(resolved.definition.background.depth).toBeLessThan(12);
  });

  it('启用正式背景后返回纹理且背景层仍低于道路和单位', () => {
    const background: AssetManifestEntry = {
      assetId: 'background',
      assetType: 'background',
      filePath: 'assets/backgrounds/test.png',
      phaserKey: 'background-key',
      enabled: true,
      preloadGroup: 'theme:test',
      owner: { kind: 'theme', id: 'test-theme' },
      required: false,
      fallback: 'programmatic',
    };
    const assets = new AssetRegistry({ version: 1, entries: [background] });
    assets.markQueued('background');
    assets.markAvailable('background');
    const theme: BattleThemeDefinition = {
      themeId: 'test-theme',
      backgroundAssetId: 'background',
      roadVisualStyle: 'road',
      coreVisualStyle: 'core',
      ambientEffectStyle: 'mist',
      background: { fit: 'cover', alignX: 0.5, alignY: 0.5, depth: 0 },
      foregroundDepth: 7,
    };
    const resolved = new BattleThemeRegistry([theme]).resolve(
      'test-theme',
      assets,
    );
    expect(resolved).toMatchObject({
      backgroundTextureKey: 'background-key',
      usesProgrammaticBackground: false,
    });
    expect(resolved.definition.background.depth).toBeLessThan(4);
  });
});

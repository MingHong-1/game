import Phaser from 'phaser';

import type { AssetRegistry } from '../assets/AssetRegistry';
import { UiCleanupBag } from '../ui/state/UiCleanupBag';
import { UI_COLORS } from '../ui/theme/uiTheme';

export type VfxType =
  | 'projectile'
  | 'impact'
  | 'circleArea'
  | 'cone'
  | 'line'
  | 'chain'
  | 'persistentArea'
  | 'aura'
  | 'status'
  | 'summon'
  | 'screenEffect';

export interface VfxDefinition {
  readonly vfxId: string;
  readonly type: VfxType;
  readonly assetId?: string;
  readonly fallbackColor: number;
  readonly fallbackRadius: number;
  readonly durationMs: number;
  readonly depth: number;
}

export class VfxRegistry {
  private readonly definitions = new Map<string, VfxDefinition>();

  public constructor(definitions: readonly VfxDefinition[]) {
    for (const definition of definitions) {
      if (this.definitions.has(definition.vfxId)) {
        throw new Error(`VFX 定义存在重复 id：${definition.vfxId}`);
      }
      this.definitions.set(definition.vfxId, definition);
    }
  }

  public get(vfxId: string): VfxDefinition {
    const definition = this.definitions.get(vfxId);
    if (definition === undefined) throw new Error(`未知 VFX：${vfxId}`);
    return definition;
  }
}

export interface VfxInstance {
  readonly container: Phaser.GameObjects.Container;
  destroy(): void;
}

export interface VfxOverrides {
  readonly color?: number;
  readonly radius?: number;
  readonly depth?: number;
}

export class VfxManager {
  private readonly active = new Set<VfxInstance>();

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly assets: AssetRegistry,
    private readonly registry: VfxRegistry,
  ) {}

  public create(
    vfxId: string,
    x: number,
    y: number,
    overrides: VfxOverrides = {},
  ): VfxInstance {
    const definition = this.registry.get(vfxId);
    const textureKey = this.assets.getAvailablePhaserKey(definition.assetId);
    const radius = overrides.radius ?? definition.fallbackRadius;
    const color = overrides.color ?? definition.fallbackColor;
    const visual: Phaser.GameObjects.GameObject = textureKey !== null
      ? this.scene.add.image(0, 0, textureKey)
      : definition.type === 'projectile'
        ? this.scene.add.container(0, 0, [
            this.scene.add.circle(0, 0, radius + 4, color, 0.18),
            this.scene.add
              .circle(0, 0, radius, color, 1)
              .setStrokeStyle(2, UI_COLORS.white, 0.82),
          ])
        : this.scene.add
            .circle(0, 0, radius, color)
            .setStrokeStyle(2, UI_COLORS.white, 0.8);
    const container = this.scene.add
      .container(x, y, [visual])
      .setDepth(overrides.depth ?? definition.depth);
    const cleanup = new UiCleanupBag();
    let destroyed = false;
    const instance: VfxInstance = {
      container,
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        cleanup.destroy();
        this.scene.tweens.killTweensOf([container, visual]);
        container.destroy(true);
        this.active.delete(instance);
      },
    };
    this.active.add(instance);
    if (definition.type !== 'projectile' && definition.durationMs > 0) {
      const tween = this.scene.tweens.add({
        targets: visual,
        alpha: 0,
        scale: 1.35,
        duration: definition.durationMs,
        onComplete: () => instance.destroy(),
      });
      cleanup.set('lifetime', () => tween.stop());
    }
    return instance;
  }

  public destroy(): void {
    for (const instance of [...this.active]) instance.destroy();
    this.active.clear();
  }
}

export const DEFAULT_VFX_REGISTRY = new VfxRegistry([
  {
    vfxId: 'basic-projectile',
    type: 'projectile',
    fallbackColor: 0xcaf7ff,
    fallbackRadius: 4,
    durationMs: 0,
    depth: 20,
  },
  {
    vfxId: 'basic-impact',
    type: 'impact',
    fallbackColor: 0xffffff,
    fallbackRadius: 7,
    durationMs: 120,
    depth: 22,
  },
]);

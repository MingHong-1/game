import Phaser from 'phaser';

import type {
  BattleSnapshot,
  EnemySnapshot,
} from '../battle/BattleSimulation';
import type { LevelDefinition } from '../battle/definitions';
import { LanePathGeometry } from '../battle/LanePathGeometry';
import type { AssetRegistry } from '../assets/AssetRegistry';
import { GAME_ASSET_REGISTRY } from '../assets/GameAssetRegistry';
import { BATTLE_THEME_REGISTRY } from '../data/battleThemes';
import { ENEMY_VISUAL_REGISTRY } from '../data/visualDefinitions';
import type { BattlePresentationEvent } from '../presentation/BattlePresentationEventBridge';
import type { BattleThemeRegistry } from '../presentation/BattleTheme';
import type { EnemyVisualRegistry } from '../presentation/VisualDefinitions';
import {
  DEFAULT_VFX_REGISTRY,
  type VfxInstance,
  VfxManager,
} from '../presentation/VfxManager';
import {
  EnemyBattleView,
  type EnemyRemovalVisual,
} from '../presentation/views/EnemyBattleView';
import { StableViewRegistry } from './state/StableViewRegistry';
import { UiCleanupBag } from './state/UiCleanupBag';
import { UI_METRICS } from './theme/uiMetrics';
import {
  BATTLE_BACKGROUND_BANDS,
  UI_COLORS,
  toCssColor,
} from './theme/uiTheme';
import { UI_FONT_FAMILY, UI_FONT_SIZES } from './theme/uiTypography';

interface ProjectileView {
  readonly vfx: VfxInstance;
}

const FOREST_SHAPES = [
  [48, 174, 72, 150],
  [112, 224, 92, 184],
  [190, 154, 62, 132],
  [1_232, 178, 82, 158],
  [1_158, 232, 94, 190],
  [1_080, 150, 64, 136],
] as const;

export class BattlefieldView {
  private readonly enemyViews = new StableViewRegistry<EnemyBattleView>();
  private readonly projectileViews = new StableViewRegistry<ProjectileView>();
  private readonly retiringEnemyViews = new Set<EnemyBattleView>();
  private readonly pendingEnemyRemoval = new Map<string, EnemyRemovalVisual>();
  private readonly cleanup = new UiCleanupBag();
  private readonly laneGeometry: LanePathGeometry;
  private readonly coreContainer: Phaser.GameObjects.Container;
  private readonly coreGlow: Phaser.GameObjects.Arc;
  private readonly coreBody: Phaser.GameObjects.Star;
  private readonly edgeFlash: Phaser.GameObjects.Rectangle;
  private previousCoreHealth: number | undefined;
  private readonly vfx: VfxManager;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: LevelDefinition,
    private readonly assets: AssetRegistry = GAME_ASSET_REGISTRY,
    private readonly enemyVisuals: EnemyVisualRegistry = ENEMY_VISUAL_REGISTRY,
    private readonly themes: BattleThemeRegistry = BATTLE_THEME_REGISTRY,
  ) {
    this.laneGeometry = new LanePathGeometry(level.path, level.laneLayout);
    this.vfx = new VfxManager(scene, assets, DEFAULT_VFX_REGISTRY);
    this.drawBattlefield();
    const core = this.getCorePosition();
    this.coreGlow = scene.add.circle(0, 0, level.coreRadius + 24, UI_COLORS.energy, 0.13);
    const outerStructure = scene.add
      .star(0, 0, 6, level.coreRadius * 0.8, level.coreRadius + 13, UI_COLORS.panelStrong)
      .setStrokeStyle(5, UI_COLORS.panelBorder, 0.96);
    this.coreBody = scene.add
      .star(0, 0, 6, level.coreRadius * 0.42, level.coreRadius, level.coreColor)
      .setStrokeStyle(3, UI_COLORS.white, 0.92);
    const inner = scene.add.circle(0, 0, 11, UI_COLORS.white, 0.96);
    const orbit = scene.add
      .circle(0, 0, level.coreRadius + 17, UI_COLORS.shadow, 0)
      .setStrokeStyle(2, UI_COLORS.star, 0.62);
    this.coreContainer = scene.add
      .container(core.x, core.y, [
        this.coreGlow,
        orbit,
        outerStructure,
        this.coreBody,
        inner,
      ])
      .setDepth(UI_METRICS.depth.units + 2);
    const pulse = scene.tweens.add({
      targets: this.coreGlow,
      scale: 1.12,
      alpha: 0.22,
      duration: 1_600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.cleanup.set('core-pulse', () => pulse.stop());
    this.edgeFlash = scene.add
      .rectangle(
        UI_METRICS.layout.battlefield.x + UI_METRICS.layout.battlefield.width / 2,
        UI_METRICS.layout.battlefield.y + UI_METRICS.layout.battlefield.height / 2,
        UI_METRICS.layout.battlefield.width,
        UI_METRICS.layout.battlefield.height,
        UI_COLORS.coreDanger,
        0,
      )
      .setStrokeStyle(8, UI_COLORS.coreDanger, 0)
      .setDepth(UI_METRICS.depth.notice - 1);
  }

  public update(snapshot: BattleSnapshot): void {
    this.enemyViews.beginFrame();
    this.projectileViews.beginFrame();
    this.syncEnemies(snapshot.enemies);
    this.syncProjectiles(snapshot.projectiles);

    if (
      this.previousCoreHealth !== undefined &&
      snapshot.coreHealth < this.previousCoreHealth
    ) {
      this.playCoreDamage();
    }
    this.previousCoreHealth = snapshot.coreHealth;
    const ratio = snapshot.coreHealth / snapshot.coreMaxHealth;
    this.coreBody.setFillStyle(
      ratio <= 0.25
        ? UI_COLORS.coreDanger
        : ratio <= 0.55
          ? UI_COLORS.coreWarning
          : this.level.coreColor,
    );
  }

  public handlePresentationEvents(
    events: readonly BattlePresentationEvent[],
  ): void {
    for (const event of events) {
      if (event.type === 'enemy-death') {
        this.pendingEnemyRemoval.set(event.enemyInstanceId, 'death');
      } else if (event.type === 'enemy-reach-core') {
        this.pendingEnemyRemoval.set(event.enemyInstanceId, 'reachCore');
      }
    }
  }

  public resetFeedback(): void {
    this.previousCoreHealth = undefined;
    this.edgeFlash.setAlpha(0).setStrokeStyle(8, UI_COLORS.coreDanger, 0);
    this.coreContainer.setPosition(
      this.getCorePosition().x,
      this.getCorePosition().y,
    );
  }

  public destroy(): void {
    this.cleanup.destroy();
    this.enemyViews.clear((view) => {
      view.destroy();
    });
    for (const view of this.retiringEnemyViews) view.destroy();
    this.retiringEnemyViews.clear();
    this.pendingEnemyRemoval.clear();
    this.projectileViews.clear((view) => {
      view.vfx.destroy();
    });
    this.vfx.destroy();
    this.scene.tweens.killTweensOf([
      this.coreContainer,
      this.coreGlow,
      this.edgeFlash,
    ]);
  }

  private drawBattlefield(): void {
    const area = UI_METRICS.layout.battlefield;
    const themeId = this.level.themeId ?? 'mistwood-border';
    const theme = this.themes.resolve(themeId, this.assets);
    const backdrop = this.scene.add.graphics().setDepth(UI_METRICS.depth.backdrop);
    backdrop.fillStyle(UI_COLORS.shadow, 0.5);
    backdrop.fillRoundedRect(area.x + 5, area.y + 5, area.width, area.height, 16);
    backdrop.fillStyle(UI_COLORS.battleBackground, 1);
    backdrop.fillRoundedRect(area.x, area.y, area.width, area.height, 16);
    backdrop.lineStyle(2, UI_COLORS.panelBorder, 0.75);
    backdrop.strokeRoundedRect(area.x, area.y, area.width, area.height, 16);

    if (theme.backgroundTextureKey !== null) {
      this.createThemeImage(
        theme.backgroundTextureKey,
        theme.definition.background,
      );
    }

    for (let index = 0; theme.usesProgrammaticBackground && index < BATTLE_BACKGROUND_BANDS.length; index += 1) {
      backdrop.fillStyle(
        BATTLE_BACKGROUND_BANDS[index] ?? UI_COLORS.battleBackground,
        0.3,
      );
      backdrop.fillRect(
        area.x + 3,
        area.y + 3 + index * (area.height / BATTLE_BACKGROUND_BANDS.length),
        area.width - 6,
        area.height / BATTLE_BACKGROUND_BANDS.length,
      );
    }

    for (const [x, y, width, height] of theme.usesProgrammaticBackground ? FOREST_SHAPES : []) {
      const color = x < 640 ? UI_COLORS.forestDark : UI_COLORS.forestMid;
      backdrop.fillStyle(color, 0.74);
      backdrop.fillTriangle(x, y - height / 2, x - width / 2, y + height / 2, x + width / 2, y + height / 2);
      backdrop.fillCircle(x, y - height * 0.18, width * 0.33);
    }
    const rockPositions = [
      [82, 410, 38, 22],
      [178, 356, 26, 17],
      [1_206, 402, 42, 24],
      [1_108, 344, 30, 18],
    ] as const;
    for (const [x, y, width, height] of theme.usesProgrammaticBackground ? rockPositions : []) {
      backdrop.fillStyle(UI_COLORS.road, 0.7);
      backdrop.fillEllipse(x, y, width, height);
    }

    const fogPositions = [
      [260, 170, 300, 72],
      [970, 208, 360, 84],
      [340, 390, 420, 68],
      [965, 410, 390, 64],
    ] as const;
    for (let index = 0; theme.usesProgrammaticBackground && index < fogPositions.length; index += 1) {
      const [x, y, width, height] = fogPositions[index] ?? [0, 0, 0, 0];
      const fog = this.scene.add
        .ellipse(x, y, width, height, UI_COLORS.battleMist, 0.045)
        .setDepth(UI_METRICS.depth.battlefield + 1);
      const tween = this.scene.tweens.add({
        targets: fog,
        x: x + (index % 2 === 0 ? 18 : -18),
        alpha: 0.085,
        duration: 3_800 + index * 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      this.cleanup.set(`fog-${index}`, () => tween.stop());
    }

    const corridor = this.scene.add
      .graphics()
      .setDepth(UI_METRICS.depth.battlefield + 2);
    this.fillCorridor(corridor, 26, UI_COLORS.shadow, 0.58);
    this.fillCorridor(corridor, 0, UI_COLORS.road, 0.96);
    this.strokeCorridorEdges(corridor);
    this.drawCorridorRunes(corridor);

    if (theme.foregroundTextureKey !== null) {
      this.createThemeImage(theme.foregroundTextureKey, {
        ...theme.definition.background,
        depth: theme.definition.foregroundDepth,
      });
    }

    const start = this.level.path[0];
    if (start !== undefined) {
      for (const laneIndex of this.laneGeometry.getLaneIndices()) {
        const gate = this.laneGeometry.positionAt(0, laneIndex);
        this.scene.add
          .ellipse(gate.x, gate.y, 34, 18, UI_COLORS.panelStrong, 0.78)
          .setStrokeStyle(2, UI_COLORS.primary, 0.62)
          .setDepth(UI_METRICS.depth.battlefield + 4);
      }
      this.scene.add
        .text(start.x + 54, start.y, '✦ 雾林入口', {
          color: toCssColor(UI_COLORS.textSecondary),
          fontFamily: UI_FONT_FAMILY,
          fontSize: `${UI_FONT_SIZES.small}px`,
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5)
        .setDepth(UI_METRICS.depth.battlefield + 4);
    }
  }

  private fillCorridor(
    graphics: Phaser.GameObjects.Graphics,
    extraWidth: number,
    color: number,
    alpha: number,
  ): void {
    const sections = Array.from({ length: 25 }, (_, index) =>
      this.laneGeometry.getCorridorSection(index / 24, extraWidth),
    );
    const polygon = [
      ...sections.map((section) => section.left),
      ...[...sections].reverse().map((section) => section.right),
    ].map((point) => new Phaser.Math.Vector2(point.x, point.y));
    graphics.fillStyle(color, alpha);
    graphics.fillPoints(polygon, true);
  }

  private createThemeImage(
    textureKey: string,
    layout: {
      readonly fit: 'cover' | 'contain' | 'stretch';
      readonly alignX: number;
      readonly alignY: number;
      readonly depth: number;
    },
  ): Phaser.GameObjects.Image {
    const area = UI_METRICS.layout.battlefield;
    const image = this.scene.add
      .image(
        area.x + area.width * layout.alignX,
        area.y + area.height * layout.alignY,
        textureKey,
      )
      .setOrigin(layout.alignX, layout.alignY)
      .setDepth(layout.depth);
    if (layout.fit === 'stretch') {
      return image.setDisplaySize(area.width, area.height);
    }
    const scale = layout.fit === 'cover'
      ? Math.max(area.width / image.width, area.height / image.height)
      : Math.min(area.width / image.width, area.height / image.height);
    return image.setScale(scale);
  }

  private strokeCorridorEdges(graphics: Phaser.GameObjects.Graphics): void {
    const sections = Array.from({ length: 25 }, (_, index) =>
      this.laneGeometry.getCorridorSection(index / 24),
    );
    graphics.lineStyle(3, UI_COLORS.roadEdge, 0.9);
    for (const side of ['left', 'right'] as const) {
      const first = sections[0]?.[side];
      if (first === undefined) continue;
      graphics.beginPath();
      graphics.moveTo(first.x, first.y);
      for (const section of sections.slice(1)) {
        graphics.lineTo(section[side].x, section[side].y);
      }
      graphics.strokePath();
    }
  }

  private drawCorridorRunes(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(2, UI_COLORS.roadRune, 0.13);
    for (const laneIndex of this.laneGeometry.getLaneIndices()) {
      const start = this.laneGeometry.positionAt(0, laneIndex);
      graphics.beginPath();
      graphics.moveTo(start.x, start.y);
      for (let sample = 1; sample <= 18; sample += 1) {
        const progress = sample / 18;
        const point = this.laneGeometry.positionAt(
          progress * this.laneGeometry.totalDistance,
          laneIndex,
        );
        graphics.lineTo(point.x, point.y);
      }
      graphics.strokePath();
    }
  }

  private getCorePosition(): { readonly x: number; readonly y: number } {
    const core = this.level.path.at(-1);
    if (core === undefined) throw new Error('关卡缺少星核位置');
    return core;
  }

  private playCoreDamage(): void {
    const core = this.getCorePosition();
    this.scene.tweens.killTweensOf([this.coreContainer, this.edgeFlash]);
    this.coreContainer.setX(core.x - 4);
    const shake = this.scene.tweens.add({
      targets: this.coreContainer,
      x: core.x + 4,
      duration: 45,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.coreContainer.setX(core.x),
    });
    this.edgeFlash.setAlpha(0.16).setStrokeStyle(8, UI_COLORS.coreDanger, 0.7);
    const flash = this.scene.tweens.add({
      targets: this.edgeFlash,
      alpha: 0,
      duration: UI_METRICS.animation.coreDamage,
      onComplete: () => this.edgeFlash.setStrokeStyle(8, UI_COLORS.coreDanger, 0),
    });
    this.cleanup.set('core-shake', () => shake.stop());
    this.cleanup.set('edge-flash', () => flash.stop());
  }

  private syncEnemies(enemies: readonly EnemySnapshot[]): void {
    for (const enemy of enemies) {
      const view = this.enemyViews.getOrCreate(
        enemy.id,
        () => new EnemyBattleView(
          this.scene,
          enemy,
          this.assets,
          this.enemyVisuals,
        ),
      );
      view.update(enemy);
    }
    this.enemyViews.sweep((view, enemyInstanceId) => {
      const reason = this.pendingEnemyRemoval.get(enemyInstanceId) ?? 'immediate';
      this.pendingEnemyRemoval.delete(enemyInstanceId);
      if (reason === 'immediate') {
        view.destroy();
        return;
      }
      this.retiringEnemyViews.add(view);
      view.remove(reason, () => this.retiringEnemyViews.delete(view));
    });
  }

  private syncProjectiles(projectiles: BattleSnapshot['projectiles']): void {
    for (const projectile of projectiles) {
      const view = this.projectileViews.getOrCreate(projectile.id, () => {
        return {
          vfx: this.vfx.create(
            'basic-projectile',
            projectile.renderX,
            projectile.renderY,
            {
              color: projectile.color,
              radius: projectile.radius,
              depth: UI_METRICS.depth.units + 8,
            },
          ),
        };
      });
      view.vfx.container.setPosition(projectile.renderX, projectile.renderY);
    }
    this.projectileViews.sweep((view) => {
      view.vfx.destroy();
    });
  }
}

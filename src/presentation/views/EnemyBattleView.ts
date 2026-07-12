import Phaser from 'phaser';

import type { AssetRegistry } from '../../assets/AssetRegistry';
import type { EnemySnapshot } from '../../battle/BattleSimulation';
import { HealthBar } from '../../ui/components/HealthBar';
import {
  applyEnemyHitPose,
  createEnemyHitTweenConfig,
  writeEnemyMotionPosition,
} from '../../ui/state/EnemyViewTransform';
import { UiCleanupBag } from '../../ui/state/UiCleanupBag';
import { UI_METRICS } from '../../ui/theme/uiMetrics';
import { UI_COLORS, toCssColor } from '../../ui/theme/uiTheme';
import { UI_FONT_FAMILY, UI_FONT_SIZES } from '../../ui/theme/uiTypography';
import type { EnemyVisualRegistry } from '../VisualDefinitions';
import { selectEnemyBattleVisual } from '../VisualDefinitions';
import { resolveAnimationClip } from '../AnimationDefinitions';
import { createProgrammaticBody } from './ProgrammaticVisualFactory';

export type EnemyRemovalVisual = 'death' | 'reachCore' | 'immediate';

export class EnemyBattleView {
  public readonly rootContainer: Phaser.GameObjects.Container;
  public readonly visualContainer: Phaser.GameObjects.Container;
  private readonly healthBar: HealthBar;
  private readonly statusEffectLayer: Phaser.GameObjects.Container;
  private readonly selectionRing: Phaser.GameObjects.Arc;
  private readonly hitArea: Phaser.GameObjects.Arc;
  private readonly cleanup = new UiCleanupBag();
  private previousHealth: number;
  private readonly alwaysShowHealth: boolean;
  private destroyed = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    enemy: EnemySnapshot,
    assets: AssetRegistry,
    visuals: EnemyVisualRegistry,
    onSelect?: (enemyInstanceId: string) => void,
  ) {
    const definition = visuals.get(enemy.definitionId);
    const selection = selectEnemyBattleVisual(definition, assets);
    const walkClip = resolveAnimationClip(definition.animations, 'walk', assets);
    const body = selection.kind === 'texture' &&
        scene.textures.exists(selection.textureKey)
      ? selection.assetId === definition.spriteSheetAssetId
        ? scene.add
            .sprite(0, 0, selection.textureKey)
            .setOrigin(definition.footAnchor.x, definition.footAnchor.y)
        : scene.add
            .image(0, 0, selection.textureKey)
            .setOrigin(definition.footAnchor.x, definition.footAnchor.y)
      : createProgrammaticBody(
          scene,
          definition.fallbackShape,
          definition.fallbackColor,
          enemy.radius,
        );
    body.setScale(definition.displayScale);
    if (
      body instanceof Phaser.GameObjects.Sprite &&
      walkClip !== null &&
      scene.anims.exists(walkClip.clip.animationKey)
    ) {
      body.play(walkClip.clip.animationKey);
    }
    const shadow = scene.add.ellipse(
      0,
      enemy.radius + 7,
      enemy.radius * 2,
      9,
      UI_COLORS.shadow,
      0.45,
    );
    this.healthBar = new HealthBar(
      scene,
      0,
      definition.healthBarOffsetY,
      {
        width: enemy.kind === 'normal'
          ? Math.min(34, Math.max(38, enemy.radius * 2.3))
          : Math.max(38, enemy.radius * 2.3),
        height: enemy.kind === 'boss' ? 9 : enemy.kind === 'normal' ? 4 : 7,
      },
    );
    this.statusEffectLayer = scene.add.container(0, 0);
    this.selectionRing = scene.add
      .circle(0, 0, enemy.radius + 8, UI_COLORS.shadow, 0)
      .setStrokeStyle(2, UI_COLORS.star, 0.92)
      .setVisible(false);
    this.hitArea = scene.add
      .circle(0, 0, enemy.radius + 9, UI_COLORS.white, 0.001)
      .setInteractive({ useHandCursor: true });
    if (onSelect !== undefined) {
      this.hitArea.on('pointerup', () => onSelect(enemy.id));
    }
    const children: Phaser.GameObjects.GameObject[] = [
      shadow,
      this.selectionRing,
      body,
      this.healthBar.container,
      this.statusEffectLayer,
      this.hitArea,
    ];
    if (enemy.kind !== 'normal') {
      children.push(
        scene.add
          .text(
            0,
            enemy.radius + 15,
            enemy.kind === 'boss'
              ? 'BOSS'
              : enemy.kind === 'heavy'
                ? '重甲'
                : '精英',
            {
              color: toCssColor(
                enemy.kind === 'boss'
                  ? UI_COLORS.coreDanger
                  : UI_COLORS.textHint,
              ),
              fontFamily: UI_FONT_FAMILY,
              fontSize: `${enemy.kind === 'boss' ? UI_FONT_SIZES.small : UI_FONT_SIZES.caption}px`,
              fontStyle: 'bold',
            },
          )
          .setOrigin(0.5),
      );
    }
    this.visualContainer = scene.add.container(0, 0, children);
    this.rootContainer = scene.add
      .container(enemy.renderX, enemy.renderY, [this.visualContainer])
      .setDepth(UI_METRICS.depth.units + definition.depth);
    this.previousHealth = enemy.health;
    this.alwaysShowHealth = definition.elite || definition.boss;
    this.playWalk(body);
  }

  public update(enemy: EnemySnapshot): void {
    if (this.destroyed) return;
    writeEnemyMotionPosition(
      this.rootContainer,
      enemy.renderX,
      enemy.renderY,
    );
    if (enemy.health < this.previousHealth) this.playHit();
    this.previousHealth = enemy.health;
    this.healthBar.setValue(enemy.health, enemy.maxHealth, false);
    this.healthBar.container.setVisible(
      this.alwaysShowHealth || enemy.health < enemy.maxHealth,
    );
  }

  public setSelected(selected: boolean): void {
    this.selectionRing.setVisible(selected);
  }

  public remove(
    reason: EnemyRemovalVisual,
    onComplete?: () => void,
  ): void {
    if (this.destroyed) return;
    if (reason === 'immediate') {
      this.destroy();
      onComplete?.();
      return;
    }
    this.scene.tweens.killTweensOf(this.visualContainer);
    const tween = this.scene.tweens.add({
      targets: this.visualContainer,
      alpha: 0,
      scale: reason === 'death' ? 0.35 : 0.1,
      duration: reason === 'death' ? 150 : 110,
      ease: 'Sine.In',
      onComplete: () => {
        this.destroy();
        onComplete?.();
      },
    });
    this.cleanup.set('removal', () => tween.stop());
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cleanup.destroy();
    this.hitArea.removeAllListeners();
    this.healthBar.destroy();
    this.scene.tweens.killTweensOf([
      this.rootContainer,
      this.visualContainer,
      ...this.statusEffectLayer.getAll(),
    ]);
    this.rootContainer.destroy(true);
  }

  private playWalk(body: Phaser.GameObjects.GameObject): void {
    const tween = this.scene.tweens.add({
      targets: body,
      angle: 2,
      scaleY: '*=0.97',
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.cleanup.set('walk', () => tween.stop());
  }

  private playHit(): void {
    this.scene.tweens.killTweensOf(this.visualContainer);
    applyEnemyHitPose(this.visualContainer);
    const tween = this.scene.tweens.add(
      createEnemyHitTweenConfig(
        this.visualContainer,
        UI_METRICS.animation.fast,
      ),
    );
    this.cleanup.set('hit', () => tween.stop());
  }
}

import Phaser from 'phaser';

import type { AssetRegistry } from '../../assets/AssetRegistry';
import type { HeroDefinition } from '../../battle/definitions';
import type { HeroStar } from '../../battle/HeroStar';
import { deriveHeroStarUiState } from '../../ui/state/HeroStarUiState';
import { UiCleanupBag } from '../../ui/state/UiCleanupBag';
import { UI_COLORS, toCssColor } from '../../ui/theme/uiTheme';
import { UI_FONT_FAMILY, UI_FONT_SIZES } from '../../ui/theme/uiTypography';
import {
  type EntityVisualState,
  resolveAnimationClip,
} from '../AnimationDefinitions';
import {
  type HeroVisualRegistry,
  resolveHeroBodyScale,
  selectHeroBattleVisual,
} from '../VisualDefinitions';
import { createProgrammaticBody } from './ProgrammaticVisualFactory';

export interface HeroBattleViewOptions {
  readonly showLabels: boolean;
  readonly maximumDisplaySize: number;
}

export class HeroBattleView {
  public readonly container: Phaser.GameObjects.Container;
  private readonly visualContainer: Phaser.GameObjects.Container;
  private readonly statusLayer: Phaser.GameObjects.Container;
  private readonly cleanup = new UiCleanupBag();
  private currentState: EntityVisualState = 'idle';
  private destroyed = false;
  private readonly baseVisualX: number;
  private readonly baseVisualY: number;
  private readonly idleDurationMs: number;
  private readonly idleScaleAmount: number;

  public constructor(
    private readonly scene: Phaser.Scene,
    hero: HeroDefinition,
    starLevel: HeroStar,
    assets: AssetRegistry,
    visuals: HeroVisualRegistry,
    options: HeroBattleViewOptions,
  ) {
    const definition = visuals.get(hero.id);
    this.baseVisualX = definition.slotOffset.x;
    this.baseVisualY = definition.slotOffset.y;
    this.idleDurationMs = definition.idle.durationMs;
    this.idleScaleAmount = definition.idle.scaleAmount;
    const selection = selectHeroBattleVisual(definition, starLevel, assets);
    const idleClip = resolveAnimationClip(
      definition.animations,
      'idle',
      assets,
    );
    let usesTexture = false;
    const body = selection.kind === 'texture' &&
        scene.textures.exists(selection.textureKey)
      ? (() => {
          usesTexture = true;
          return scene.add
            .image(0, 0, selection.textureKey)
            .setOrigin(definition.footAnchor.x, definition.footAnchor.y);
        })()
      : idleClip !== null && scene.textures.exists(idleClip.textureKey)
        ? (() => {
            usesTexture = true;
            return scene.add
              .sprite(0, 0, idleClip.textureKey)
              .setOrigin(definition.footAnchor.x, definition.footAnchor.y)
              .play(idleClip.clip.animationKey);
          })()
        : createProgrammaticBody(
            scene,
            definition.fallbackShape,
            definition.fallbackColor,
            Math.min(14, options.maximumDisplaySize / 2),
          );
    const bounds = body.getBounds();
    const normalizedScale = resolveHeroBodyScale(
      usesTexture ? 'texture' : 'programmatic',
      definition.defaultScale,
      Math.max(bounds.width, 1),
      Math.max(bounds.height, 1),
      options.maximumDisplaySize,
    );
    body.setScale(normalizedScale);
    const base = scene.add
      .circle(0, 0, 19, UI_COLORS.pageDeep, 0.72)
      .setStrokeStyle(1, definition.fallbackColor, 0.72);
    this.statusLayer = scene.add.container(0, 0);
    this.visualContainer = scene.add.container(
      definition.slotOffset.x,
      definition.slotOffset.y,
      [base, body, this.statusLayer],
    );
    const children: Phaser.GameObjects.GameObject[] = [this.visualContainer];
    if (options.showLabels) {
      children.push(
        scene.add
          .text(0, 23, hero.name, {
            color: toCssColor(UI_COLORS.textPrimary),
            fontFamily: UI_FONT_FAMILY,
            fontSize: `${UI_FONT_SIZES.caption}px`,
          })
          .setOrigin(0.5),
        scene.add
          .text(0, 38, deriveHeroStarUiState(starLevel).shortLabel, {
            color: toCssColor(UI_COLORS.star),
            fontFamily: UI_FONT_FAMILY,
            fontSize: `${UI_FONT_SIZES.caption}px`,
          })
          .setOrigin(0.5),
      );
    }
    this.container = scene.add.container(0, 0, children).setDepth(definition.depth);
    this.playIdle(definition.idle.durationMs, definition.idle.scaleAmount);
  }

  public get state(): EntityVisualState {
    return this.currentState;
  }

  public playSummon(): void {
    if (this.destroyed) return;
    this.currentState = 'summon';
    this.stopMotionTweens();
    this.visualContainer.setAlpha(0).setScale(0.45);
    const tween = this.scene.tweens.add({
      targets: this.visualContainer,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Back.Out',
      onComplete: () => this.resumeIdle(),
    });
    this.cleanup.set('action', () => tween.stop());
  }

  public playAttack(): void {
    if (this.destroyed || this.currentState === 'disabled') return;
    this.currentState = 'attack';
    this.stopMotionTweens();
    this.visualContainer
      .setPosition(this.baseVisualX, this.baseVisualY - 2)
      .setScale(1);
    const tween = this.scene.tweens.add({
      targets: this.visualContainer,
      y: this.baseVisualY - 6,
      scaleX: 1.08,
      scaleY: 0.94,
      duration: 70,
      yoyo: true,
      ease: 'Sine.Out',
      onComplete: () => this.resumeIdle(),
    });
    this.cleanup.set('action', () => tween.stop());
  }

  public setBuffed(buffed: boolean): void {
    if (this.destroyed) return;
    this.cleanup.clear('buffed');
    this.statusLayer.removeAll(true);
    if (!buffed) {
      if (this.currentState === 'buffed') this.resumeIdle();
      return;
    }
    this.currentState = 'buffed';
    const aura = this.scene.add
      .circle(0, 7, 22, UI_COLORS.energy, 0.08)
      .setStrokeStyle(2, UI_COLORS.energy, 0.72);
    this.statusLayer.add(aura);
    const tween = this.scene.tweens.add({
      targets: aura,
      alpha: 0.28,
      scale: 1.13,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
    this.cleanup.set('buffed', () => tween.stop());
  }

  public setDisabled(disabled: boolean): void {
    if (this.destroyed) return;
    this.currentState = disabled ? 'disabled' : 'idle';
    if (disabled) this.stopMotionTweens();
    this.visualContainer.setAlpha(disabled ? 0.42 : 1);
    if (!disabled) this.resumeIdle();
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cleanup.destroy();
    this.scene.tweens.killTweensOf([
      this.container,
      this.visualContainer,
      ...this.statusLayer.getAll(),
    ]);
    this.container.destroy(true);
  }

  private playIdle(durationMs: number, scaleAmount: number): void {
    this.cleanup.clear('idle');
    const tween = this.scene.tweens.add({
      targets: this.visualContainer,
      scaleX: 1 + scaleAmount,
      scaleY: 1 - scaleAmount,
      duration: durationMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.cleanup.set('idle', () => tween.stop());
  }

  private resumeIdle(): void {
    if (this.destroyed || this.currentState === 'disabled') return;
    this.cleanup.clear('action');
    this.currentState = 'idle';
    this.visualContainer
      .setPosition(this.baseVisualX, this.baseVisualY)
      .setScale(1)
      .setAlpha(1);
    this.playIdle(this.idleDurationMs, this.idleScaleAmount);
  }

  private stopMotionTweens(): void {
    this.cleanup.clear('action');
    this.cleanup.clear('idle');
    this.scene.tweens.killTweensOf(this.visualContainer);
  }
}

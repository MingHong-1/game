import Phaser from 'phaser';

import type { AssetRegistry } from '../../assets/AssetRegistry';
import { GAME_ASSET_REGISTRY } from '../../assets/GameAssetRegistry';
import { MAX_HERO_STAR, type HeroStar } from '../../battle/HeroStar';
import type { HeroSlotSnapshot } from '../../battle/SlotSystem';
import type { HeroDefinition } from '../../battle/definitions';
import { HERO_VISUAL_REGISTRY } from '../../data/visualDefinitions';
import type { HeroVisualRegistry } from '../../presentation/VisualDefinitions';
import { HeroBattleView } from '../../presentation/views/HeroBattleView';
import {
  deriveHeroSlotPersistentText,
  getHeroSlotHitArea,
  getHeroSlotInteractionStyle,
  deriveHeroSlotInteractionVisualState,
  type HeroSlotInteractionState,
} from '../state/HeroSlotInteractionState';
import {
  HERO_SLOT_LAYER_ORDER,
  HERO_SLOT_LAYER_POLICY,
  HERO_SLOT_STATE_LAYER_ORDER,
  shouldShowForegroundLip,
  shouldShowLockOverlay,
} from '../state/HeroSlotLayerModel';
import { UiCleanupBag } from '../state/UiCleanupBag';
import { UI_METRICS } from '../theme/uiMetrics';
import { UI_COLORS, toCssColor } from '../theme/uiTheme';
import { UI_FONT_FAMILY, UI_FONT_SIZES } from '../theme/uiTypography';

export interface HeroSlotUpdateOptions {
  readonly hero: HeroDefinition | undefined;
  readonly isNextLockedSlot: boolean;
  readonly summonsUntilUnlock: number | null;
  readonly animate: boolean;
}

export interface HeroSlotViewOptions {
  readonly onSelect?: (heroInstanceId: string) => void;
  readonly onHoverChanged?: (slotIndex: number, hovered: boolean) => void;
}

/**
 * 格位显示树只依赖子节点添加顺序，不依赖 Container 内部 setDepth：
 * backplate → hero(echo → main) → thin lip → state → lock → hit area。
 */
export class HeroSlotView {
  public readonly container: Phaser.GameObjects.Container;
  public readonly layerOrder = HERO_SLOT_LAYER_ORDER;
  public readonly stateLayerOrder = HERO_SLOT_STATE_LAYER_ORDER;
  private readonly backplateGraphics: Phaser.GameObjects.Graphics;
  private readonly identityFrameGraphics: Phaser.GameObjects.Graphics;
  private readonly hoverVisualGraphics: Phaser.GameObjects.Graphics;
  private readonly selectedOutlineGraphics: Phaser.GameObjects.Graphics;
  private readonly selectedMarker: Phaser.GameObjects.Graphics;
  private readonly foregroundLipGraphics: Phaser.GameObjects.Graphics;
  private readonly emptyMark: Phaser.GameObjects.Container;
  private readonly lockIcon: Phaser.GameObjects.Container;
  private readonly lockOverlayLayer: Phaser.GameObjects.Container;
  private readonly heroVisualLayer: Phaser.GameObjects.Container;
  private readonly foregroundLipLayer: Phaser.GameObjects.Container;
  private readonly detailText: Phaser.GameObjects.Text;
  private readonly sparkle: Phaser.GameObjects.Container;
  private readonly interactionOverlay: Phaser.GameObjects.Graphics;
  private readonly dragOverlay: Phaser.GameObjects.Container;
  private readonly interactionHitArea: Phaser.GameObjects.Rectangle;
  private readonly cleanup = new UiCleanupBag();
  private heroBattleView: HeroBattleView | undefined;
  private renderedStarLevel: HeroStar | null = null;
  private occupantId: string | null = null;
  private unlocked = false;
  private initialized = false;
  private selected = false;
  private hovered = false;
  private maximumStar = false;
  private accentColor: number = UI_COLORS.panelBorderSoft;
  private interactionState: HeroSlotInteractionState = 'locked';
  private requestedInteractionState: HeroSlotInteractionState = 'normal';

  public constructor(
    private readonly scene: Phaser.Scene,
    public readonly index: number,
    x: number,
    y: number,
    private readonly assets: AssetRegistry = GAME_ASSET_REGISTRY,
    private readonly heroVisuals: HeroVisualRegistry = HERO_VISUAL_REGISTRY,
    private readonly options: HeroSlotViewOptions = {},
  ) {
    this.backplateGraphics = scene.add.graphics();
    this.identityFrameGraphics = scene.add.graphics();
    this.hoverVisualGraphics = scene.add.graphics();
    this.selectedOutlineGraphics = scene.add.graphics();
    this.selectedMarker = scene.add.graphics().setVisible(false);
    this.drawSelectedMarker();
    this.foregroundLipGraphics = scene.add.graphics();
    const runeRing = scene.add
      .circle(0, UI_METRICS.slot.runeY, 18, UI_COLORS.primary, 0.03)
      .setStrokeStyle(1, UI_COLORS.primary, 0.18);
    const runeStar = scene.add
      .star(0, UI_METRICS.slot.runeY, 6, 5, 12, UI_COLORS.primary, 0.08)
      .setStrokeStyle(1, UI_COLORS.primary, 0.22);
    this.emptyMark = scene.add.container(0, 0, [runeRing, runeStar]);

    const shackle = scene.add
      .circle(0, -12, 9, UI_COLORS.shadow, 0)
      .setStrokeStyle(3, UI_COLORS.locked, 0.82);
    const lockBody = scene.add
      .rectangle(0, -2, 24, 19, UI_COLORS.locked, 0.7)
      .setStrokeStyle(2, UI_COLORS.textMuted, 0.65);
    const keyhole = scene.add.circle(0, -3, 2.5, UI_COLORS.pageDeep, 0.95);
    this.lockIcon = scene.add.container(0, 0, [shackle, lockBody, keyhole]);
    this.detailText = scene.add
      .text(0, UI_METRICS.slot.detailY, '', {
        align: 'center',
        color: toCssColor(UI_COLORS.textMuted),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.caption}px`,
      })
      .setOrigin(0.5);
    const lockShade = scene.add.rectangle(
      0,
      UI_METRICS.slot.backgroundTop + UI_METRICS.slot.height / 2,
      UI_METRICS.slot.width,
      UI_METRICS.slot.height,
      UI_COLORS.pageDeep,
      0.22,
    );

    const sparkles: Phaser.GameObjects.Arc[] = [];
    const sparklePositions = [
      [-30, -14],
      [-18, 12],
      [0, -25],
      [22, -15],
      [31, 12],
      [4, 17],
    ] as const;
    for (const [sparkleX, sparkleY] of sparklePositions) {
      sparkles.push(scene.add.circle(sparkleX, sparkleY, 2.5, UI_COLORS.star, 0.95));
    }
    this.sparkle = scene.add.container(0, 0, sparkles).setAlpha(0).setScale(0.5);
    this.interactionOverlay = scene.add.graphics();
    this.dragOverlay = scene.add.container(0, 0).setVisible(false);

    const slotBackplateLayer = scene.add.container(0, 0, [
      this.backplateGraphics,
      this.emptyMark,
    ]);
    this.heroVisualLayer = scene.add.container(0, 0);
    this.foregroundLipLayer = scene.add.container(0, 0, [this.foregroundLipGraphics]);
    const slotStateOverlayLayer = scene.add.container(0, 0, [
      this.identityFrameGraphics,
      this.hoverVisualGraphics,
      this.selectedOutlineGraphics,
      this.selectedMarker,
      this.sparkle,
      this.interactionOverlay,
      this.dragOverlay,
    ]);
    this.lockOverlayLayer = scene.add.container(0, 0, [
      lockShade,
      this.lockIcon,
      this.detailText,
    ]);
    const hitArea = getHeroSlotHitArea();
    this.interactionHitArea = scene.add
      .rectangle(
        hitArea.x + hitArea.width / 2,
        hitArea.y + hitArea.height / 2,
        hitArea.width,
        hitArea.height,
        UI_COLORS.white,
        0.001,
      )
      .setInteractive({ useHandCursor: true });

    this.container = scene.add.container(x, y, [
      slotBackplateLayer,
      this.heroVisualLayer,
      this.foregroundLipLayer,
      slotStateOverlayLayer,
      this.lockOverlayLayer,
      this.interactionHitArea,
    ]);
    this.interactionHitArea.on('pointerover', this.handlePointerOver);
    this.interactionHitArea.on('pointerout', this.handlePointerOut);
    this.interactionHitArea.on('pointerup', this.handlePointerUp);
    this.drawBackplate(false);
    this.renderInteractionState();
  }

  public update(slot: HeroSlotSnapshot, options: HeroSlotUpdateOptions): void {
    const newlyUnlocked = this.initialized && !this.unlocked && slot.unlocked;
    const newOccupant =
      slot.occupant !== null && slot.occupant.instanceId !== this.occupantId;
    const starVisualChanged =
      slot.occupant !== null && slot.occupant.starLevel !== this.renderedStarLevel;
    this.unlocked = slot.unlocked;
    this.maximumStar = slot.occupant?.starLevel === MAX_HERO_STAR;
    const persistentText = deriveHeroSlotPersistentText(
      slot.unlocked,
      options.isNextLockedSlot,
      options.summonsUntilUnlock,
    );
    this.lockOverlayLayer.setVisible(shouldShowLockOverlay(slot.unlocked));

    if (!slot.unlocked) {
      this.destroyHeroGlyph();
      this.occupantId = null;
      this.selected = false;
      this.requestedInteractionState = 'locked';
      this.emptyMark.setVisible(false);
      this.foregroundLipLayer.setVisible(shouldShowForegroundLip(false, false));
      this.lockIcon.setVisible(true).setAlpha(0.7);
      this.detailText
        .setText(persistentText.detail)
        .setColor(toCssColor(UI_COLORS.textMuted))
        .setVisible(true);
      this.accentColor = UI_COLORS.locked;
      this.drawBackplate(false);
    } else if (slot.occupant === null) {
      this.destroyHeroGlyph();
      this.occupantId = null;
      this.selected = false;
      if (this.requestedInteractionState === 'locked') {
        this.requestedInteractionState = 'normal';
      }
      this.emptyMark.setVisible(true);
      this.foregroundLipLayer.setVisible(shouldShowForegroundLip(true, false));
      this.detailText.setText('').setVisible(false);
      this.accentColor = UI_COLORS.primary;
      this.drawBackplate(false);
    } else {
      if (this.requestedInteractionState === 'locked') {
        this.requestedInteractionState = 'normal';
      }
      this.emptyMark.setVisible(false);
      this.foregroundLipLayer.setVisible(shouldShowForegroundLip(true, true));
      if (newOccupant || starVisualChanged || this.heroBattleView === undefined) {
        this.destroyHeroGlyph();
        if (options.hero !== undefined) {
          this.heroBattleView = new HeroBattleView(
            this.scene,
            options.hero,
            slot.occupant.starLevel,
            this.assets,
            this.heroVisuals,
            {
              showLabels: false,
              echoDisplaySize: UI_METRICS.slot.heroEchoDisplaySize,
              maximumDisplaySize: UI_METRICS.slot.heroMaximumDisplaySize,
            },
          );
          this.heroVisualLayer.add(this.heroBattleView.container);
          this.renderedStarLevel = slot.occupant.starLevel;
        }
      }
      this.occupantId = slot.occupant.instanceId;
      this.accentColor = options.hero?.color ?? UI_COLORS.primary;
      this.drawBackplate(true);
      this.drawForegroundLip(this.accentColor);
    }

    this.renderInteractionState();

    if (newlyUnlocked && options.animate) this.playUnlock();
    if (newOccupant && options.animate) this.playSummon();
    this.initialized = true;
  }

  public setSelected(selected: boolean): void {
    this.selected = selected;
    this.renderInteractionState();
  }

  public setInteractionState(state: HeroSlotInteractionState): void {
    if (state === 'selected') this.selected = true;
    else if (state === 'hovered') this.hovered = true;
    else if (state === 'maximumStar') this.maximumStar = true;
    this.requestedInteractionState =
      state === 'selected' || state === 'hovered' || state === 'maximumStar'
        ? 'normal'
        : state;
    this.renderInteractionState();
  }

  public flash(): void {
    this.scene.tweens.killTweensOf(this.container);
    const tween = this.scene.tweens.add({
      targets: this.container,
      scale: 1.07,
      duration: UI_METRICS.animation.fast,
      yoyo: true,
    });
    this.cleanup.set('flash', () => tween.stop());
  }

  public playAttack(): void {
    this.heroBattleView?.playAttack();
  }

  public setBuffed(buffed: boolean): void {
    this.heroBattleView?.setBuffed(buffed);
  }

  public setHeroDisabled(disabled: boolean): void {
    this.heroBattleView?.setDisabled(disabled);
    this.requestedInteractionState = disabled ? 'disabled' : 'normal';
    this.renderInteractionState();
  }

  public destroy(): void {
    this.interactionHitArea.removeAllListeners();
    this.cleanup.destroy();
    this.scene.tweens.killTweensOf([
      this.container,
      this.heroBattleView?.container,
      this.lockIcon,
      this.sparkle,
    ]);
    this.container.destroy(true);
  }

  private playUnlock(): void {
    this.lockOverlayLayer.setVisible(true);
    this.lockIcon.setVisible(true).setAlpha(0.7).setScale(1);
    this.sparkle.setAlpha(1).setScale(0.45);
    const sparkleTween = this.scene.tweens.add({
      targets: this.sparkle,
      scale: 1.35,
      alpha: 0,
      duration: UI_METRICS.animation.slow,
      ease: 'Sine.Out',
    });
    const lockTween = this.scene.tweens.add({
      targets: this.lockIcon,
      alpha: 0,
      scale: 1.3,
      duration: UI_METRICS.animation.normal,
      onComplete: () => {
        this.lockIcon.setVisible(false).setScale(1);
        this.lockOverlayLayer.setVisible(false);
      },
    });
    this.cleanup.set('unlock-sparkle', () => sparkleTween.stop());
    this.cleanup.set('unlock-lock', () => lockTween.stop());
  }

  private playSummon(): void {
    if (this.heroBattleView === undefined) return;
    this.heroBattleView.playSummon();
    this.flash();
  }

  private destroyHeroGlyph(): void {
    if (this.heroBattleView === undefined) return;
    this.heroBattleView.destroy();
    this.heroBattleView = undefined;
    this.renderedStarLevel = null;
    this.heroVisualLayer.removeAll(false);
  }

  private drawBackplate(occupied: boolean): void {
    const width = UI_METRICS.slot.width;
    const height = UI_METRICS.slot.height;
    this.backplateGraphics.clear();
    this.backplateGraphics.fillStyle(
      this.unlocked ? UI_COLORS.panelStrong : UI_COLORS.pageDeep,
      this.unlocked ? (occupied ? 0.58 : 0.84) : 0.72,
    );
    this.backplateGraphics.fillRoundedRect(
      -width / 2,
      UI_METRICS.slot.backgroundTop,
      width,
      height,
      UI_METRICS.slot.cornerRadius,
    );
  }

  private drawForegroundLip(accentColor: number): void {
    const width = UI_METRICS.slot.foregroundLipWidth;
    const height = HERO_SLOT_LAYER_POLICY.foregroundLipHeight;
    const slotBottom = UI_METRICS.slot.backgroundTop + UI_METRICS.slot.height;
    const y = slotBottom - UI_METRICS.slot.foregroundLipBottomInset - height / 2;
    this.foregroundLipGraphics.clear();
    this.foregroundLipGraphics.fillStyle(
      UI_COLORS.pageDeep,
      UI_METRICS.slot.foregroundLipAlpha,
    );
    this.foregroundLipGraphics.fillRoundedRect(
      -width / 2,
      y - height / 2,
      width,
      height,
      height / 2,
    );
    this.foregroundLipGraphics.lineStyle(
      1,
      accentColor,
      UI_METRICS.slot.foregroundLipAlpha,
    );
    this.foregroundLipGraphics.beginPath();
    this.foregroundLipGraphics.moveTo(-width / 2 + 3, y - height / 2);
    this.foregroundLipGraphics.lineTo(width / 2 - 3, y - height / 2);
    this.foregroundLipGraphics.strokePath();
  }

  private drawStateFrame(state: HeroSlotInteractionState): void {
    const style = getHeroSlotInteractionStyle(state);
    this.identityFrameGraphics.clear();
    this.identityFrameGraphics.lineStyle(
      style.borderWidth,
      state === 'normal' ? this.accentColor : style.borderColor,
      style.borderAlpha,
    );
    this.identityFrameGraphics.strokeRoundedRect(
      -UI_METRICS.slot.width / 2,
      UI_METRICS.slot.backgroundTop,
      UI_METRICS.slot.width,
      UI_METRICS.slot.height,
      UI_METRICS.slot.cornerRadius,
    );
  }

  private renderInteractionState(): void {
    const visualState = deriveHeroSlotInteractionVisualState({
      unlocked: this.unlocked,
      occupied: this.occupantId !== null,
      selected: this.selected,
      hovered: this.hovered,
      maximumStar: this.maximumStar,
      requestedState: this.requestedInteractionState,
    });
    this.interactionState = visualState.frameState;
    this.drawStateFrame(visualState.frameState);
    this.drawHoverVisual(visualState.showHoverVisual);
    this.drawSelectedOutline(visualState.showSelectedOutline);
    this.selectedMarker.setVisible(visualState.showSelectedMarker);

    const hitArea = getHeroSlotHitArea();
    const style = getHeroSlotInteractionStyle(visualState.frameState);
    this.interactionOverlay.clear();
    if (style.overlayAlpha > 0) {
      this.interactionOverlay.fillStyle(style.overlayColor, style.overlayAlpha);
      this.interactionOverlay.fillRoundedRect(
        hitArea.x,
        hitArea.y,
        hitArea.width,
        hitArea.height,
        UI_METRICS.slot.cornerRadius,
      );
    }
    this.dragOverlay.setVisible(visualState.frameState === 'dragging');
  }

  private drawSelectedOutline(visible: boolean): void {
    this.selectedOutlineGraphics.clear();
    if (!visible) return;
    const gap = UI_METRICS.slot.selectedOutlineGap;
    const verticalInset = UI_METRICS.slot.selectedOutlineWidth / 2;
    this.selectedOutlineGraphics.lineStyle(
      UI_METRICS.slot.selectedOutlineWidth,
      UI_COLORS.slotSelectedOutline,
      1,
    );
    this.selectedOutlineGraphics.strokeRoundedRect(
      -UI_METRICS.slot.width / 2 - gap,
      UI_METRICS.slot.backgroundTop + verticalInset,
      UI_METRICS.slot.width + gap * 2,
      UI_METRICS.slot.height - verticalInset * 2,
      UI_METRICS.slot.cornerRadius + gap,
    );
  }

  private drawHoverVisual(visible: boolean): void {
    this.hoverVisualGraphics.clear();
    if (!visible) return;
    const style = getHeroSlotInteractionStyle('hovered');
    const inset = UI_METRICS.slot.hoverFrameInset;
    this.hoverVisualGraphics.lineStyle(
      style.borderWidth,
      style.borderColor,
      style.borderAlpha,
    );
    this.hoverVisualGraphics.strokeRoundedRect(
      -UI_METRICS.slot.width / 2 + inset,
      UI_METRICS.slot.backgroundTop + inset,
      UI_METRICS.slot.width - inset * 2,
      UI_METRICS.slot.height - inset * 2,
      UI_METRICS.slot.cornerRadius - inset,
    );
  }

  private drawSelectedMarker(): void {
    const size = UI_METRICS.slot.selectedMarkerSize;
    const left = UI_METRICS.slot.width / 2 -
      UI_METRICS.slot.selectedMarkerInsetX - size;
    const top = UI_METRICS.slot.backgroundTop +
      UI_METRICS.slot.selectedMarkerInsetY;
    const centerX = left + size / 2;
    const centerY = top + size / 2;
    this.selectedMarker.clear();
    this.selectedMarker.fillStyle(UI_COLORS.slotSelectedMarker, 0.98);
    this.selectedMarker.lineStyle(1, UI_COLORS.slotSelectedOutline, 1);
    this.selectedMarker.beginPath();
    this.selectedMarker.moveTo(centerX, top);
    this.selectedMarker.lineTo(left + size, centerY);
    this.selectedMarker.lineTo(centerX, top + size);
    this.selectedMarker.lineTo(left, centerY);
    this.selectedMarker.closePath();
    this.selectedMarker.fillPath();
    this.selectedMarker.strokePath();
  }

  private readonly handlePointerOver = (): void => {
    this.hovered = true;
    this.options.onHoverChanged?.(this.index, true);
    if (!this.unlocked || this.interactionState === 'disabled') return;
    this.renderInteractionState();
  };

  private readonly handlePointerOut = (): void => {
    this.hovered = false;
    this.options.onHoverChanged?.(this.index, false);
    if (!this.unlocked || this.interactionState === 'disabled') return;
    this.renderInteractionState();
  };

  private readonly handlePointerUp = (): void => {
    if (!this.unlocked || this.occupantId === null) return;
    this.options.onSelect?.(this.occupantId);
  };
}

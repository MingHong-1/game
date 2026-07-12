import Phaser from 'phaser';

import type { HeroSlotSnapshot } from '../../battle/SlotSystem';
import type { HeroDefinition } from '../../battle/definitions';
import type { AssetRegistry } from '../../assets/AssetRegistry';
import { GAME_ASSET_REGISTRY } from '../../assets/GameAssetRegistry';
import { HERO_VISUAL_REGISTRY } from '../../data/visualDefinitions';
import type { HeroVisualRegistry } from '../../presentation/VisualDefinitions';
import { HeroBattleView } from '../../presentation/views/HeroBattleView';
import { UiCleanupBag } from '../state/UiCleanupBag';
import { deriveHeroStarUiState } from '../state/HeroStarUiState';
import { UI_METRICS } from '../theme/uiMetrics';
import { UI_COLORS, toCssColor } from '../theme/uiTheme';
import { UI_FONT_FAMILY, UI_FONT_SIZES } from '../theme/uiTypography';

export interface HeroSlotUpdateOptions {
  readonly hero: HeroDefinition | undefined;
  readonly isNextLockedSlot: boolean;
  readonly summonsUntilUnlock: number | null;
  readonly animate: boolean;
}

export class HeroSlotView {
  public readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly emptyMark: Phaser.GameObjects.Container;
  private readonly lockIcon: Phaser.GameObjects.Container;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly detailText: Phaser.GameObjects.Text;
  private readonly sparkle: Phaser.GameObjects.Container;
  private readonly cleanup = new UiCleanupBag();
  private heroBattleView: HeroBattleView | undefined;
  private occupantId: string | null = null;
  private unlocked = false;
  private initialized = false;
  private selected = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    public readonly index: number,
    x: number,
    y: number,
    private readonly assets: AssetRegistry = GAME_ASSET_REGISTRY,
    private readonly heroVisuals: HeroVisualRegistry = HERO_VISUAL_REGISTRY,
  ) {
    this.background = scene.add.graphics();
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
    this.nameText = scene.add
      .text(0, UI_METRICS.slot.nameY, '', {
        align: 'center',
        color: toCssColor(UI_COLORS.textSecondary),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.caption}px`,
        fontStyle: 'bold',
        wordWrap: { width: UI_METRICS.slot.width - 10 },
      })
      .setOrigin(0.5);
    this.detailText = scene.add
      .text(0, UI_METRICS.slot.detailY, '', {
        align: 'center',
        color: toCssColor(UI_COLORS.textMuted),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.caption}px`,
      })
      .setOrigin(0.5);
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
      sparkles.push(
        scene.add.circle(sparkleX, sparkleY, 2.5, UI_COLORS.star, 0.95),
      );
    }
    this.sparkle = scene.add
      .container(0, 0, sparkles)
      .setAlpha(0)
      .setScale(0.5);
    this.container = scene.add.container(x, y, [
      this.background,
      this.emptyMark,
      this.lockIcon,
      this.nameText,
      this.detailText,
      this.sparkle,
    ]);
    this.drawBackground(UI_COLORS.panelBorderSoft);
  }

  public update(
    slot: HeroSlotSnapshot,
    options: HeroSlotUpdateOptions,
  ): void {
    const newlyUnlocked = this.initialized && !this.unlocked && slot.unlocked;
    const newOccupant =
      slot.occupant !== null && slot.occupant.instanceId !== this.occupantId;
    this.unlocked = slot.unlocked;

    if (!slot.unlocked) {
      this.destroyHeroGlyph();
      this.occupantId = null;
      this.emptyMark.setVisible(false);
      this.lockIcon.setVisible(true).setAlpha(0.7);
      this.nameText
        .setText(`第 ${slot.index + 1} 格`)
        .setColor(toCssColor(UI_COLORS.locked));
      this.detailText
        .setText(
          options.isNextLockedSlot && options.summonsUntilUnlock !== null
            ? `再召唤 ${options.summonsUntilUnlock} 次`
            : '等待解锁',
        )
        .setColor(toCssColor(UI_COLORS.textMuted));
      this.drawBackground(UI_COLORS.locked);
    } else if (slot.occupant === null) {
      this.destroyHeroGlyph();
      this.occupantId = null;
      this.emptyMark.setVisible(true);
      this.lockIcon.setVisible(false);
      this.nameText
        .setText(`第 ${slot.index + 1} 格 · 空`)
        .setColor(toCssColor(UI_COLORS.textSecondary));
      this.detailText
        .setText('等待召唤')
        .setColor(toCssColor(UI_COLORS.textMuted));
      this.drawBackground(UI_COLORS.primary);
    } else {
      this.emptyMark.setVisible(false);
      this.lockIcon.setVisible(false);
      if (newOccupant || this.heroBattleView === undefined) {
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
              maximumDisplaySize: UI_METRICS.slot.heroMaximumDisplaySize,
            },
          );
          this.container.addAt(this.heroBattleView.container, 3);
        }
      }
      this.occupantId = slot.occupant.instanceId;
      this.nameText
        .setText(options.hero?.name ?? slot.occupant.heroDefinitionId)
        .setColor(toCssColor(UI_COLORS.textPrimary));
      this.detailText
        .setText(deriveHeroStarUiState(slot.occupant.starLevel).detailLabel)
        .setColor(toCssColor(UI_COLORS.star));
      this.drawBackground(options.hero?.color ?? UI_COLORS.primary);
    }

    if (newlyUnlocked && options.animate) this.playUnlock();
    if (newOccupant && options.animate) this.playSummon();
    this.initialized = true;
  }

  public setSelected(selected: boolean): void {
    this.selected = selected;
    this.drawBackground(UI_COLORS.primary);
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
  }

  public destroy(): void {
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
      onComplete: () => this.lockIcon.setVisible(false).setScale(1),
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
  }

  private drawBackground(accentColor: number): void {
    const width = UI_METRICS.slot.width;
    const height = UI_METRICS.slot.height;
    this.background.clear();
    this.background.fillStyle(
      this.unlocked ? UI_COLORS.panelStrong : UI_COLORS.pageDeep,
      this.unlocked ? 0.94 : 0.72,
    );
    this.background.fillRoundedRect(
      -width / 2,
      UI_METRICS.slot.backgroundTop,
      width,
      height,
      UI_METRICS.slot.cornerRadius,
    );
    this.background.lineStyle(
      this.selected ? 4 : UI_METRICS.slot.borderWidth,
      this.selected ? UI_COLORS.star : accentColor,
      this.unlocked ? 0.95 : 0.62,
    );
    this.background.strokeRoundedRect(
      -width / 2,
      UI_METRICS.slot.backgroundTop,
      width,
      height,
      UI_METRICS.slot.cornerRadius,
    );
  }
}

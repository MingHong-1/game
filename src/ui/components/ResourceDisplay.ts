import Phaser from 'phaser';

import { UiCleanupBag } from '../state/UiCleanupBag';
import { UI_METRICS } from '../theme/uiMetrics';
import { UI_COLORS, toCssColor } from '../theme/uiTheme';
import { UI_FONT_FAMILY, UI_FONT_SIZES } from '../theme/uiTypography';

export interface ResourceDisplayOptions {
  readonly label: string;
  readonly icon: string;
  readonly width: number;
  readonly accentColor?: number;
}

export class ResourceDisplay {
  public readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly valueText: Phaser.GameObjects.Text;
  private readonly deltaText: Phaser.GameObjects.Text;
  private readonly cleanup = new UiCleanupBag();
  private numericValue: number | undefined;
  private insufficient = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly options: ResourceDisplayOptions,
  ) {
    this.background = scene.add.graphics();
    const icon = scene.add
      .text(-options.width / 2 + 18, 0, options.icon, {
        color: toCssColor(options.accentColor ?? UI_COLORS.energy),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.value}px`,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const label = scene.add
      .text(-options.width / 2 + 34, -10, options.label, {
        color: toCssColor(UI_COLORS.textMuted),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.caption}px`,
      })
      .setOrigin(0, 0.5);
    this.valueText = scene.add
      .text(-options.width / 2 + 34, 10, '', {
        color: toCssColor(UI_COLORS.textPrimary),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.value}px`,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);
    this.deltaText = scene.add
      .text(options.width / 2 - 8, -2, '', {
        color: toCssColor(UI_COLORS.coreHealthy),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.small}px`,
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5)
      .setVisible(false);
    this.container = scene.add.container(x, y, [
      this.background,
      icon,
      label,
      this.valueText,
      this.deltaText,
    ]);
    this.draw();
  }

  public setValue(value: number | string, animate = true): void {
    this.valueText.setText(String(value));
    if (typeof value !== 'number') {
      this.numericValue = undefined;
      return;
    }
    const delta = this.numericValue === undefined ? 0 : value - this.numericValue;
    this.numericValue = value;
    if (!animate || delta === 0) return;

    this.deltaText
      .setText(`${delta > 0 ? '+' : ''}${delta}`)
      .setColor(
        toCssColor(delta > 0 ? UI_COLORS.coreHealthy : UI_COLORS.coreDanger),
      )
      .setAlpha(1)
      .setY(-2)
      .setVisible(true);
    const deltaTween = this.scene.tweens.add({
      targets: this.deltaText,
      y: -22,
      alpha: 0,
      duration: UI_METRICS.animation.slow,
      onComplete: () => this.deltaText.setVisible(false),
    });
    const valueTween = this.scene.tweens.add({
      targets: this.valueText,
      scale: 1.16,
      duration: UI_METRICS.animation.fast,
      yoyo: true,
    });
    this.cleanup.set('delta', () => deltaTween.stop());
    this.cleanup.set('value', () => valueTween.stop());
  }

  public setInsufficient(insufficient: boolean): void {
    if (this.insufficient === insufficient) return;
    this.insufficient = insufficient;
    this.draw();
  }

  public destroy(): void {
    this.cleanup.destroy();
    this.scene.tweens.killTweensOf([this.valueText, this.deltaText]);
    this.container.destroy(true);
  }

  private draw(): void {
    const width = this.options.width;
    this.background.clear();
    this.background.fillStyle(UI_COLORS.pageDeep, 0.58);
    this.background.fillRoundedRect(-width / 2, -24, width, 48, 9);
    this.background.lineStyle(
      1,
      this.insufficient ? UI_COLORS.coreDanger : UI_COLORS.panelBorderSoft,
      0.85,
    );
    this.background.strokeRoundedRect(-width / 2, -24, width, 48, 9);
  }
}

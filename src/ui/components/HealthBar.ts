import Phaser from 'phaser';

import { UiCleanupBag } from '../state/UiCleanupBag';
import { UI_METRICS } from '../theme/uiMetrics';
import { UI_COLORS, toCssColor } from '../theme/uiTheme';
import { UI_FONT_FAMILY, UI_FONT_SIZES } from '../theme/uiTypography';

export interface HealthBarOptions {
  readonly width: number;
  readonly height: number;
  readonly showValue?: boolean;
}

export class HealthBar {
  public readonly container: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly valueText?: Phaser.GameObjects.Text;
  private readonly cleanup = new UiCleanupBag();
  private ratio = 1;

  public constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    options: HealthBarOptions,
  ) {
    const background = scene.add
      .rectangle(0, 0, options.width, options.height, UI_COLORS.pageDeep, 0.9)
      .setStrokeStyle(1, UI_COLORS.panelBorderSoft, 0.75);
    this.fill = scene.add
      .rectangle(
        -options.width / 2,
        0,
        options.width - 4,
        Math.max(2, options.height - 4),
        UI_COLORS.coreHealthy,
      )
      .setOrigin(0, 0.5);
    const children: Phaser.GameObjects.GameObject[] = [background, this.fill];
    if (options.showValue) {
      this.valueText = scene.add
        .text(0, 0, '', {
          color: toCssColor(UI_COLORS.textPrimary),
          fontFamily: UI_FONT_FAMILY,
          fontSize: `${UI_FONT_SIZES.caption}px`,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      children.push(this.valueText);
    }
    this.container = scene.add.container(x, y, children);
  }

  public setValue(current: number, maximum: number, animate = true): void {
    const nextRatio = maximum <= 0 ? 0 : Phaser.Math.Clamp(current / maximum, 0, 1);
    this.valueText?.setText(`${Math.ceil(current)} / ${maximum}`);
    const fillColor =
      nextRatio <= 0.25
        ? UI_COLORS.coreDanger
        : nextRatio <= 0.55
          ? UI_COLORS.coreWarning
          : UI_COLORS.coreHealthy;
    this.fill.setFillStyle(fillColor);
    if (nextRatio === this.ratio) return;
    this.ratio = nextRatio;
    this.cleanup.clear('ratio');
    this.scene.tweens.killTweensOf(this.fill);
    if (!animate) {
      this.fill.setScale(nextRatio, 1);
      return;
    }
    const tween = this.scene.tweens.add({
      targets: this.fill,
      scaleX: nextRatio,
      duration: UI_METRICS.animation.normal,
      ease: 'Sine.Out',
    });
    this.cleanup.set('ratio', () => tween.stop());
  }

  public get targetRatio(): number {
    return this.ratio;
  }

  public destroy(): void {
    this.cleanup.destroy();
    this.scene.tweens.killTweensOf(this.fill);
    this.container.destroy(true);
  }
}

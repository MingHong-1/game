import Phaser from 'phaser';

import { UI_METRICS } from '../theme/uiMetrics';
import {
  UI_COLORS,
  getToneColor,
  toCssColor,
  type UiTone,
} from '../theme/uiTheme';
import { UI_FONT_FAMILY, UI_FONT_SIZES } from '../theme/uiTypography';

export interface PanelOptions {
  readonly width: number;
  readonly height: number;
  readonly title?: string;
  readonly tone?: UiTone;
  readonly strong?: boolean;
  readonly alpha?: number;
}

export class Panel {
  public readonly container: Phaser.GameObjects.Container;
  public readonly content: Phaser.GameObjects.Container;
  private readonly border: Phaser.GameObjects.Graphics;
  private highlighted = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly options: PanelOptions,
  ) {
    const shadow = scene.add.graphics();
    shadow.fillStyle(UI_COLORS.shadow, 0.45);
    shadow.fillRoundedRect(
      UI_METRICS.panel.shadowOffset,
      UI_METRICS.panel.shadowOffset,
      options.width,
      options.height,
      UI_METRICS.panel.cornerRadius,
    );
    this.border = scene.add.graphics();
    this.draw();
    this.content = scene.add.container(0, 0);
    const children: Phaser.GameObjects.GameObject[] = [
      shadow,
      this.border,
      this.content,
    ];
    if (options.title !== undefined) {
      children.push(
        scene.add
          .text(UI_METRICS.panel.padding, 12, options.title, {
            color: toCssColor(UI_COLORS.star),
            fontFamily: UI_FONT_FAMILY,
            fontSize: `${UI_FONT_SIZES.small}px`,
            fontStyle: 'bold',
          })
          .setOrigin(0, 0),
      );
    }
    this.container = scene.add.container(x, y, children);
  }

  public setHighlighted(highlighted: boolean): void {
    if (this.highlighted === highlighted) return;
    this.highlighted = highlighted;
    this.draw();
  }

  public destroy(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy(true);
  }

  private draw(): void {
    const tone = this.options.tone ?? 'normal';
    const fill = this.options.strong
      ? UI_COLORS.panelStrong
      : UI_COLORS.panel;
    const borderColor = this.highlighted
      ? getToneColor(tone === 'normal' ? 'accent' : tone)
      : tone === 'normal'
        ? UI_COLORS.panelBorder
        : getToneColor(tone);
    this.border.clear();
    this.border.fillStyle(fill, this.options.alpha ?? 0.9);
    this.border.fillRoundedRect(
      0,
      0,
      this.options.width,
      this.options.height,
      UI_METRICS.panel.cornerRadius,
    );
    this.border.lineStyle(
      UI_METRICS.panel.borderWidth,
      borderColor,
      this.highlighted ? 1 : 0.78,
    );
    this.border.strokeRoundedRect(
      0,
      0,
      this.options.width,
      this.options.height,
      UI_METRICS.panel.cornerRadius,
    );
  }
}

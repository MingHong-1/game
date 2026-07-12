import Phaser from 'phaser';

import type { BottomCommandLayout, UiRect } from '../layout/BottomCommandLayout';
import { UI_METRICS } from '../theme/uiMetrics';
import { UI_COLORS } from '../theme/uiTheme';

export function isUiDebugEnabled(
  search: string,
  isDevelopment: boolean,
): boolean {
  return isDevelopment && new URLSearchParams(search).get('uiDebug') === '1';
}

export class UiDebugOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;

  public constructor(
    scene: Phaser.Scene,
    layout: BottomCommandLayout,
  ) {
    const deck = UI_METRICS.layout.commandDeck;
    this.graphics = scene.add.graphics().setDepth(UI_METRICS.depth.debug + 1);
    this.graphics.setPosition(deck.x, deck.y);
    this.drawColumns(layout);
    this.drawComponents(layout);
    this.drawHeroBounds(layout);
    this.drawBaselines(layout);
  }

  public destroy(): void {
    this.graphics.destroy();
  }

  private drawColumns(layout: BottomCommandLayout): void {
    this.stroke(layout.bounds, UI_COLORS.white, 0.74, 2);
    this.stroke(layout.columns.left, UI_COLORS.energy, 0.9, 2);
    this.stroke(layout.columns.center, UI_COLORS.star, 0.9, 2);
    this.stroke(layout.columns.right, UI_COLORS.primary, 0.9, 2);
  }

  private drawComponents(layout: BottomCommandLayout): void {
    for (const component of [
      layout.left.energy,
      layout.left.summonCost,
      layout.left.skillStatus,
      layout.left.skillPreview,
      layout.left.helperText,
      layout.right.formation,
      layout.right.expansionProgress,
      layout.right.summon,
      layout.right.merge,
      layout.right.rebuild,
      layout.right.helperText,
    ]) {
      this.stroke(component, UI_COLORS.primary, 0.62, 1);
    }
  }

  private drawHeroBounds(layout: BottomCommandLayout): void {
    this.stroke(layout.heroBoard.visualBounds, UI_COLORS.star, 0.45, 1);
    for (const [index, slot] of layout.heroBoard.slotRects.entries()) {
      this.stroke(slot, UI_COLORS.star, 0.78, 1);
      const center = layout.heroBoard.slotCenters[index];
      if (center === undefined) continue;
      const visualSize = UI_METRICS.slot.heroMaximumDisplaySize;
      this.stroke(
        {
          x: center.x - visualSize / 2,
          y: center.y - visualSize + 10,
          width: visualSize,
          height: visualSize,
        },
        UI_COLORS.coreHealthy,
        0.62,
        1,
      );
      this.stroke(
        {
          x: slot.x + UI_METRICS.spacing.micro,
          y: center.y + UI_METRICS.slot.heroTextSafeTop,
          width: slot.width - UI_METRICS.spacing.internal,
          height: slot.height -
            (UI_METRICS.slot.heroTextSafeTop - UI_METRICS.slot.backgroundTop),
        },
        UI_COLORS.coreDanger,
        0.48,
        1,
      );
    }
  }

  private drawBaselines(layout: BottomCommandLayout): void {
    this.graphics.lineStyle(1, UI_COLORS.white, 0.34);
    for (const y of layout.rowBaselines) {
      this.graphics.beginPath();
      this.graphics.moveTo(0, y);
      this.graphics.lineTo(layout.bounds.width, y);
      this.graphics.strokePath();
    }
  }

  private stroke(
    rectangle: UiRect,
    color: number,
    alpha: number,
    width: number,
  ): void {
    this.graphics.lineStyle(width, color, alpha);
    this.graphics.strokeRect(
      rectangle.x,
      rectangle.y,
      rectangle.width,
      rectangle.height,
    );
  }
}

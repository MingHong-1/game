import Phaser from 'phaser';

import type { SelectedHeroInfoViewModel } from '../viewmodels/SelectedHeroInfo';
import { UI_METRICS } from '../theme/uiMetrics';
import { UI_COLORS, toCssColor } from '../theme/uiTheme';
import { UI_FONT_FAMILY, UI_FONT_SIZES } from '../theme/uiTypography';

export class SelectedHeroInfoBar {
  public readonly container: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.Text;

  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const background = scene.add.graphics();
    background.fillStyle(UI_COLORS.pageDeep, 0.72);
    background.fillRoundedRect(0, 0, width, height, UI_METRICS.statCard.cornerRadius);
    background.lineStyle(1, UI_COLORS.panelBorderSoft, 0.74);
    background.strokeRoundedRect(0, 0, width, height, UI_METRICS.statCard.cornerRadius);
    this.text = scene.add
      .text(width / 2, height / 2, '英雄编队 · 点击英雄查看信息', {
        align: 'center',
        color: toCssColor(UI_COLORS.textSecondary),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.helper}px`,
        maxLines: 1,
        fixedWidth: width - UI_METRICS.spacing.module,
        fixedHeight: height,
      })
      .setOrigin(0.5);
    this.container = scene.add.container(x, y, [background, this.text]);
  }

  public update(viewModel: SelectedHeroInfoViewModel | null): void {
    if (viewModel === null) {
      this.text
        .setText('英雄编队 · 点击英雄查看信息')
        .setColor(toCssColor(UI_COLORS.textSecondary));
      return;
    }
    this.text
      .setText(formatSelectedHeroInfoLabel(viewModel))
      .setColor(toCssColor(UI_COLORS.textPrimary));
  }

  public destroy(): void {
    this.container.destroy(true);
  }
}

export function formatSelectedHeroInfoLabel(
  viewModel: SelectedHeroInfoViewModel,
  maximumCharacters = 48,
): string {
  const label =
    `${viewModel.name} · ${viewModel.starLevel}星 · ${viewModel.roleLabel}` +
    ` · 攻击${formatNumber(viewModel.effectiveBasicAttack)}` +
    ` · 暴击${(viewModel.critChance * 100).toFixed(0)}%`;
  const characters = Array.from(label);
  return characters.length <= maximumCharacters
    ? label
    : `${characters.slice(0, maximumCharacters - 1).join('')}…`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

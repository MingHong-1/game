import Phaser from 'phaser';

import { UI_COLORS, toCssColor } from '../theme/uiTheme';
import { UI_FONT_FAMILY, UI_FONT_SIZES } from '../theme/uiTypography';

export class SectionLabel {
  public readonly text: Phaser.GameObjects.Text;

  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
  ) {
    this.text = scene.add
      .text(x, y, label, {
        color: toCssColor(UI_COLORS.textSecondary),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.helper}px`,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);
  }
}

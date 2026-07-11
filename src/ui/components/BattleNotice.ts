import Phaser from 'phaser';

import { ToastQueue, type ToastMessage } from '../state/ToastQueue';
import { UiCleanupBag } from '../state/UiCleanupBag';
import { UI_METRICS } from '../theme/uiMetrics';
import { UI_COLORS, getToneColor, toCssColor } from '../theme/uiTheme';
import { UI_FONT_FAMILY, UI_FONT_SIZES } from '../theme/uiTypography';

export class BattleNotice {
  public readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly queue = new ToastQueue(4);
  private readonly cleanup = new UiCleanupBag();
  private activeText: string | undefined;
  private destroyed = false;
  private readonly baseY: number;

  public constructor(private readonly scene: Phaser.Scene, x: number, y: number) {
    this.baseY = y;
    this.background = scene.add.graphics();
    this.text = scene.add
      .text(0, 0, '', {
        align: 'center',
        color: toCssColor(UI_COLORS.textPrimary),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.heading}px`,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.container = scene.add
      .container(x, y, [this.background, this.text])
      .setAlpha(0)
      .setVisible(false)
      .setDepth(UI_METRICS.depth.notice);
  }

  public enqueue(message: ToastMessage): void {
    if (this.destroyed || message.text === this.activeText) return;
    this.queue.enqueue(message);
    if (this.activeText === undefined) this.showNext();
  }

  public clear(): void {
    this.queue.clear();
    this.cleanup.clear('hold');
    this.cleanup.clear('fade');
    this.activeText = undefined;
    this.container.setVisible(false).setAlpha(0);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.queue.destroy();
    this.cleanup.destroy();
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy(true);
  }

  private showNext(): void {
    const message = this.queue.dequeue();
    if (message === undefined || this.destroyed) {
      this.activeText = undefined;
      return;
    }
    this.activeText = message.text;
    this.text.setText(message.text);
    const width = Math.max(280, Math.min(660, this.text.width + 72));
    const accent = getToneColor(message.tone);
    this.background.clear();
    this.background.fillStyle(UI_COLORS.panel, 0.94);
    this.background.fillRoundedRect(-width / 2, -27, width, 54, 14);
    this.background.lineStyle(2, accent, 0.95);
    this.background.strokeRoundedRect(-width / 2, -27, width, 54, 14);
    this.container.setVisible(true).setAlpha(0).setY(this.baseY + 8);
    const targetY = this.baseY;
    const fadeIn = this.scene.tweens.add({
      targets: this.container,
      y: targetY,
      alpha: 1,
      duration: UI_METRICS.animation.normal,
      ease: 'Sine.Out',
    });
    this.cleanup.set('fade', () => fadeIn.stop());
    const hold = this.scene.time.delayedCall(message.durationMs, () => {
      const fadeOut = this.scene.tweens.add({
        targets: this.container,
        y: targetY - 8,
        alpha: 0,
        duration: UI_METRICS.animation.normal,
        onComplete: () => {
          this.container.setVisible(false);
          this.activeText = undefined;
          this.showNext();
        },
      });
      this.cleanup.set('fade', () => fadeOut.stop());
    });
    this.cleanup.set('hold', () => hold.remove(false));
  }
}

import Phaser from 'phaser';

import { ButtonStateController } from '../state/ButtonStateController';
import { UiCleanupBag } from '../state/UiCleanupBag';
import { UI_METRICS } from '../theme/uiMetrics';
import { UI_COLORS, toCssColor } from '../theme/uiTheme';
import { UI_FONT_FAMILY, UI_FONT_SIZES } from '../theme/uiTypography';

export type GameButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface GameButtonOptions {
  readonly label: string;
  readonly subtitle?: string;
  readonly icon?: string;
  readonly width: number;
  readonly height?: number;
  readonly fontSize?: number;
  readonly variant?: GameButtonVariant;
  readonly keyboardKeyCode?: number;
  readonly onPress: () => void;
}

export class GameButton {
  public readonly container: Phaser.GameObjects.Container;
  private readonly visual: Phaser.GameObjects.Graphics;
  private readonly hitArea: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly subtitle?: Phaser.GameObjects.Text;
  private readonly controller: ButtonStateController;
  private readonly cleanup = new UiCleanupBag();
  private selected = false;
  private focused = false;
  private pressed = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly options: GameButtonOptions,
  ) {
    const height = options.height ?? UI_METRICS.button.height;
    this.visual = scene.add.graphics();
    this.hitArea = scene.add
      .rectangle(0, 0, options.width, height, UI_COLORS.white, 0.001)
      .setInteractive({ useHandCursor: true });
    const textOffset = options.subtitle === undefined ? 0 : -8;
    this.label = scene.add
      .text(options.icon === undefined ? 0 : 10, textOffset, options.label, {
        color: toCssColor(UI_COLORS.textPrimary),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${options.fontSize ?? UI_FONT_SIZES.button}px`,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const children: Phaser.GameObjects.GameObject[] = [
      this.visual,
      this.hitArea,
      this.label,
    ];
    if (options.icon !== undefined) {
      children.push(
        scene.add
          .text(-options.width / 2 + 18, 0, options.icon, {
            color: toCssColor(UI_COLORS.textHint),
            fontFamily: UI_FONT_FAMILY,
            fontSize: `${UI_FONT_SIZES.value}px`,
          })
          .setOrigin(0.5),
      );
    }
    if (options.subtitle !== undefined) {
      this.subtitle = scene.add
        .text(0, 14, options.subtitle, {
          color: toCssColor(UI_COLORS.textSecondary),
          fontFamily: UI_FONT_FAMILY,
          fontSize: `${UI_FONT_SIZES.caption}px`,
        })
        .setOrigin(0.5);
      children.push(this.subtitle);
    }
    this.container = scene.add.container(x, y, children);
    this.controller = new ButtonStateController(
      options.onPress,
      UI_METRICS.button.repeatGuardMs,
    );

    const onOver = (): void => {
      this.focused = true;
      this.draw();
    };
    const onOut = (): void => {
      this.focused = false;
      this.pressed = false;
      this.container.setScale(1);
      this.draw();
    };
    const onDown = (): void => {
      if (!this.controller.isEnabled) return;
      this.pressed = true;
      this.draw();
      this.container.setScale(0.985);
    };
    const onUp = (): void => {
      this.pressed = false;
      this.container.setScale(1);
      this.draw();
      this.controller.trigger(this.scene.time.now);
    };
    this.hitArea.on('pointerover', onOver);
    this.hitArea.on('pointerout', onOut);
    this.hitArea.on('pointerdown', onDown);
    this.hitArea.on('pointerup', onUp);
    this.cleanup.set('pointer-events', () => {
      this.hitArea.off('pointerover', onOver);
      this.hitArea.off('pointerout', onOut);
      this.hitArea.off('pointerdown', onDown);
      this.hitArea.off('pointerup', onUp);
    });

    if (options.keyboardKeyCode !== undefined && scene.input.keyboard !== null) {
      const key = scene.input.keyboard.addKey(options.keyboardKeyCode);
      const onKeyDown = (): void => {
        this.focused = true;
        this.draw();
        this.controller.trigger(this.scene.time.now);
      };
      key.on('down', onKeyDown);
      this.cleanup.set('keyboard', () => {
        key.off('down', onKeyDown);
        scene.input.keyboard?.removeKey(options.keyboardKeyCode!);
      });
    }
    this.draw();
  }

  public setEnabled(enabled: boolean): void {
    if (this.controller.isEnabled === enabled) return;
    this.controller.setEnabled(enabled);
    if (enabled) this.hitArea.setInteractive({ useHandCursor: true });
    else this.hitArea.disableInteractive();
    this.draw();
  }

  public setSelected(selected: boolean): void {
    if (this.selected === selected) return;
    this.selected = selected;
    this.draw();
  }

  public setFocused(focused: boolean): void {
    this.focused = focused;
    this.draw();
  }

  public setLabel(label: string): void {
    if (this.label.text === label) return;
    this.label.setText(label);
  }

  public setSubtitle(subtitle: string): void {
    if (this.subtitle?.text === subtitle) return;
    this.subtitle?.setText(subtitle);
  }

  public setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  public pulse(): void {
    this.scene.tweens.killTweensOf(this.container);
    const tween = this.scene.tweens.add({
      targets: this.container,
      scale: 1.045,
      duration: UI_METRICS.animation.normal,
      yoyo: true,
      ease: 'Sine.Out',
    });
    this.cleanup.set('pulse', () => tween.stop());
  }

  public destroy(): void {
    this.controller.destroy();
    this.cleanup.destroy();
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy(true);
  }

  private draw(): void {
    const enabled = this.controller.isEnabled;
    const variant = this.options.variant ?? 'secondary';
    let fill: number = UI_COLORS.panelHighlight;
    let border: number = UI_COLORS.panelBorderSoft;
    if (variant === 'primary') {
      fill = UI_COLORS.primaryPressed;
      border = UI_COLORS.primary;
    } else if (variant === 'danger') {
      fill = UI_COLORS.danger;
      border = UI_COLORS.coreDanger;
    } else if (variant === 'ghost') {
      fill = UI_COLORS.panel;
      border = UI_COLORS.panelBorder;
    }
    if (this.selected) {
      fill = UI_COLORS.panelHighlight;
      border = UI_COLORS.star;
    }
    if (this.focused && enabled) {
      fill = variant === 'danger' ? UI_COLORS.dangerHover : UI_COLORS.primaryHover;
    }
    if (this.pressed && enabled) fill = UI_COLORS.primaryPressed;
    if (!enabled) {
      fill = UI_COLORS.disabled;
      border = UI_COLORS.locked;
    }
    const height = this.options.height ?? UI_METRICS.button.height;
    this.visual.clear();
    this.visual.fillStyle(fill, enabled ? 0.94 : 0.5);
    this.visual.fillRoundedRect(
      -this.options.width / 2,
      -height / 2,
      this.options.width,
      height,
      UI_METRICS.button.cornerRadius,
    );
    this.visual.lineStyle(
      this.focused ? 3 : UI_METRICS.button.borderWidth,
      border,
      enabled ? 1 : 0.55,
    );
    this.visual.strokeRoundedRect(
      -this.options.width / 2,
      -height / 2,
      this.options.width,
      height,
      UI_METRICS.button.cornerRadius,
    );
    this.container.setAlpha(enabled ? 1 : 0.58);
  }
}

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH, SceneKey } from '../core/gameConstants';
import { resolveInitialRunSeed } from '../battle/RunSeed';
import { GameButton } from '../ui/components/GameButton';
import { Panel } from '../ui/components/Panel';
import { UI_COLORS, toCssColor } from '../ui/theme/uiTheme';
import { UI_FONT_FAMILY, UI_FONT_SIZES } from '../ui/theme/uiTypography';

const STAR_POINTS = [
  [92, 92, 3],
  [224, 154, 2],
  [348, 72, 2],
  [985, 112, 3],
  [1168, 182, 2],
  [1064, 592, 2],
  [166, 584, 3],
] as const;

export class MainMenuScene extends Phaser.Scene {
  private readonly backgroundTweens: Phaser.Tweens.Tween[] = [];

  public constructor() {
    super(SceneKey.MainMenu);
  }

  public create(): void {
    this.backgroundTweens.length = 0;
    this.cameras.main.setBackgroundColor(toCssColor(UI_COLORS.pageBackground));
    this.drawBackdrop();

    const frame = new Panel(this, 340, 142, {
      width: 600,
      height: 420,
      tone: 'accent',
      strong: true,
      alpha: 0.9,
    });
    frame.container.setDepth(10);
    const emblemGlow = this.add.circle(300, 78, 48, UI_COLORS.energy, 0.1);
    const emblem = this.add
      .star(300, 78, 6, 20, 42, UI_COLORS.energy)
      .setStrokeStyle(4, UI_COLORS.star, 0.94);
    const title = this.add
      .text(300, 158, '星核守望', {
        color: toCssColor(UI_COLORS.textPrimary),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.display}px`,
        fontStyle: 'bold',
        stroke: toCssColor(UI_COLORS.panelStrong),
        strokeThickness: 7,
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(300, 224, '雾林边境 · 随机合成塔防', {
        color: toCssColor(UI_COLORS.textSecondary),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.heading}px`,
        letterSpacing: 3,
      })
      .setOrigin(0.5);
    const divider = this.add.rectangle(300, 263, 360, 1, UI_COLORS.panelBorder, 0.65);
    const startButton = new GameButton(this, 300, 322, {
      label: '开始新战斗',
      subtitle: 'ENTER',
      icon: '✦',
      width: 280,
      height: 70,
      fontSize: UI_FONT_SIZES.value,
      variant: 'primary',
      keyboardKeyCode: Phaser.Input.Keyboard.KeyCodes.ENTER,
      onPress: () =>
        this.scene.start(SceneKey.Prototype, {
          seed: resolveInitialRunSeed(window.location.search),
        }),
    });
    const stage = this.add
      .text(300, 386, '阶段 2C.1 · 正式随机局', {
        color: toCssColor(UI_COLORS.textMuted),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.small}px`,
      })
      .setOrigin(0.5);
    frame.content.add([
      emblemGlow,
      emblem,
      title,
      subtitle,
      divider,
      startButton.container,
      stage,
    ]);
    const pulse = this.tweens.add({
      targets: emblemGlow,
      scale: 1.18,
      alpha: 0.2,
      duration: 1_700,
      yoyo: true,
      repeat: -1,
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      pulse.stop();
      for (const tween of this.backgroundTweens) tween.stop();
      this.backgroundTweens.length = 0;
      startButton.destroy();
      frame.destroy();
    });
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(UI_COLORS.pageDeep, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(UI_COLORS.battleBackground, 0.75);
    graphics.fillCircle(GAME_WIDTH / 2, 320, 420);
    graphics.lineStyle(2, UI_COLORS.primary, 0.16);
    graphics.strokeCircle(GAME_WIDTH / 2, 320, 430);
    graphics.lineStyle(1, UI_COLORS.panelBorder, 0.22);
    graphics.lineBetween(70, 610, GAME_WIDTH - 70, 610);

    const treePositions = [80, 155, 245, 1_035, 1_120, 1_205] as const;
    for (const x of treePositions) {
      graphics.fillStyle(UI_COLORS.forestDark, 0.72);
      graphics.fillTriangle(x, 170, x - 55, 520, x + 55, 520);
      graphics.fillCircle(x, 270, 62);
    }
    for (const [x, y, radius] of STAR_POINTS) {
      this.add.circle(x, y, radius, UI_COLORS.energy, 0.72);
    }
    const mistA = this.add.ellipse(280, 520, 520, 80, UI_COLORS.battleMist, 0.05);
    const mistB = this.add.ellipse(1_000, 500, 560, 86, UI_COLORS.battleMist, 0.045);
    this.backgroundTweens.push(
      this.tweens.add({ targets: mistA, x: 310, alpha: 0.09, duration: 4_500, yoyo: true, repeat: -1 }),
      this.tweens.add({ targets: mistB, x: 970, alpha: 0.085, duration: 5_100, yoyo: true, repeat: -1 }),
    );
  }
}

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from './core/gameConstants';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { PrototypeScene } from './scenes/PrototypeScene';
import { UI_COLORS, toCssColor } from './ui/theme/uiTheme';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  title: '星核守望',
  version: '0.1.0',
  backgroundColor: toCssColor(UI_COLORS.pageBackground),
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
  scale: {
    parent: 'game-container',
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: false,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    max: {
      width: 1600,
      height: 900,
    },
  },
  scene: [BootScene, MainMenuScene, PrototypeScene],
};

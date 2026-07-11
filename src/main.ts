import Phaser from 'phaser';

import { gameConfig } from './gameConfig';
import './style.css';

const game = new Phaser.Game(gameConfig);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true);
  });
}

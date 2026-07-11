import Phaser from 'phaser';

import type { FallbackShape } from '../VisualDefinitions';
import { UI_COLORS } from '../../ui/theme/uiTheme';

export function createProgrammaticBody(
  scene: Phaser.Scene,
  shape: FallbackShape,
  color: number,
  radius: number,
): Phaser.GameObjects.Shape {
  if (shape === 'circle') {
    return scene.add
      .circle(0, 0, radius, color)
      .setStrokeStyle(2, UI_COLORS.white, 0.72);
  }
  if (shape === 'diamond') {
    return scene.add
      .rectangle(0, 0, radius * 1.55, radius * 1.55, color)
      .setRotation(Math.PI / 4)
      .setStrokeStyle(2, UI_COLORS.white, 0.72);
  }
  const points = shape === 'triangle'
    ? 3
    : shape === 'octagram'
      ? 8
      : shape === 'hexagon'
        ? 6
        : 5;
  return scene.add
    .star(0, 0, points, radius * 0.48, radius, color)
    .setStrokeStyle(2, UI_COLORS.white, 0.76);
}

export interface EnemyMotionTarget {
  setPosition(x: number, y: number): unknown;
}

export interface EnemyVisualFeedbackTarget {
  setAlpha(alpha: number): EnemyVisualFeedbackTarget;
  setScale(scale: number): EnemyVisualFeedbackTarget;
}

/** 怪物运动根节点坐标的唯一写入口。 */
export function writeEnemyMotionPosition(
  target: EnemyMotionTarget,
  x: number,
  y: number,
): void {
  target.setPosition(x, y);
}

/** 受击起始姿态只允许修改视觉子节点。 */
export function applyEnemyHitPose(target: EnemyVisualFeedbackTarget): void {
  target.setAlpha(0.58).setScale(1.08);
}

export function createEnemyHitTweenConfig(
  target: EnemyVisualFeedbackTarget,
  duration: number,
): {
  readonly targets: EnemyVisualFeedbackTarget;
  readonly alpha: number;
  readonly scale: number;
  readonly duration: number;
  readonly ease: string;
} {
  return {
    targets: target,
    alpha: 1,
    scale: 1,
    duration,
    ease: 'Sine.Out',
  };
}

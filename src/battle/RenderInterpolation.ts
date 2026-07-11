/** 将固定步长累积器转换为只供显示层使用的 0～1 插值比例。 */
export function getInterpolationAlpha(
  accumulatorMs: number,
  fixedStepMs: number,
): number {
  if (!Number.isFinite(accumulatorMs) || accumulatorMs < 0) {
    throw new RangeError('插值累积时间必须是非负有限数字');
  }
  if (!Number.isFinite(fixedStepMs) || fixedStepMs <= 0) {
    throw new RangeError('插值固定步长必须是正有限数字');
  }
  return Math.min(1, Math.max(0, accumulatorMs / fixedStepMs));
}

/** 线性插值只生成显示值，不回写任何战斗状态。 */
export function interpolateNumber(
  previous: number,
  current: number,
  alpha: number,
): number {
  if (
    !Number.isFinite(previous) ||
    !Number.isFinite(current) ||
    !Number.isFinite(alpha) ||
    alpha < 0 ||
    alpha > 1
  ) {
    throw new RangeError('插值参数必须是有限数字，且 alpha 位于 0～1');
  }
  return previous + (current - previous) * alpha;
}

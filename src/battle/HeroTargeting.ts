import type { HeroDefinition } from './definitions';

/**
 * 普通攻击区域只由敌人的道路进度决定，与英雄所在格位的屏幕坐标无关。
 */
export function isEnemyInHeroAttackArea(
  hero: HeroDefinition,
  pathProgress: number,
): boolean {
  return pathProgress >= hero.minimumAttackPathProgress;
}

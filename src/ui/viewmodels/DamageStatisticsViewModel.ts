import type { BattleStatisticsSnapshot } from '../../battle/statistics/BattleStatisticsTracker';
import type { HeroDefinition } from '../../battle/definitions';

export interface HeroDamageStatisticsViewModel {
  readonly heroDefinitionId: string;
  readonly name: string;
  readonly instanceCount: number;
  readonly totalDamage: number;
  readonly teamShare: number;
  readonly basicAttackDamage: number;
  readonly criticalDamage: number;
  readonly criticalHits: number;
  readonly hitCount: number;
  readonly dps: number;
}

export interface DamageStatisticsViewModel {
  readonly teamTotalDamage: number;
  readonly elapsedBattleTimeMs: number;
  readonly heroes: readonly HeroDamageStatisticsViewModel[];
}

export function createDamageStatisticsViewModel(
  snapshot: BattleStatisticsSnapshot,
  heroDefinitions: ReadonlyMap<string, HeroDefinition>,
): DamageStatisticsViewModel {
  return Object.freeze({
    teamTotalDamage: snapshot.teamTotalDamage,
    elapsedBattleTimeMs: snapshot.elapsedBattleTimeMs,
    heroes: Object.freeze(snapshot.byHero.map((entry) => Object.freeze({
      heroDefinitionId: entry.heroDefinitionId,
      name: heroDefinitions.get(entry.heroDefinitionId)?.name ?? entry.heroDefinitionId,
      instanceCount: entry.instanceCount,
      totalDamage: entry.totalDamage,
      teamShare: entry.teamShare,
      basicAttackDamage: entry.basicAttackDamage,
      criticalDamage: entry.criticalDamage,
      criticalHits: entry.criticalHits,
      hitCount: entry.hitCount,
      dps: entry.dps,
    }))),
  });
}

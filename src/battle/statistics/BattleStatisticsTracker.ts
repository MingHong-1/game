import type { DamageResult } from '../combat/DamageResult';

export interface HeroDamageStatistics {
  readonly sourceInstanceId: string;
  readonly heroDefinitionId: string;
  readonly totalDamage: number;
  readonly basicAttackDamage: number;
  readonly skillDamage: number;
  readonly criticalDamage: number;
  readonly criticalHits: number;
  readonly hitCount: number;
  readonly aoeDamage: number;
  readonly dotDamage: number;
  readonly summonDamage: number;
  readonly firstDamageTimeMs: number | null;
  readonly lastDamageTimeMs: number | null;
  readonly dps: number;
}

export interface HeroDefinitionDamageStatistics {
  readonly heroDefinitionId: string;
  readonly instanceCount: number;
  readonly totalDamage: number;
  readonly basicAttackDamage: number;
  readonly skillDamage: number;
  readonly criticalDamage: number;
  readonly criticalHits: number;
  readonly hitCount: number;
  readonly aoeDamage: number;
  readonly dotDamage: number;
  readonly summonDamage: number;
  readonly firstDamageTimeMs: number | null;
  readonly lastDamageTimeMs: number | null;
  readonly dps: number;
  readonly teamShare: number;
}

export interface BattleStatisticsSnapshot {
  readonly teamTotalDamage: number;
  readonly elapsedBattleTimeMs: number;
  readonly byInstance: readonly HeroDamageStatistics[];
  readonly byHero: readonly HeroDefinitionDamageStatistics[];
}

interface MutableHeroDamageStatistics {
  readonly sourceInstanceId: string;
  readonly heroDefinitionId: string;
  totalDamage: number;
  basicAttackDamage: number;
  skillDamage: number;
  criticalDamage: number;
  criticalHits: number;
  hitCount: number;
  aoeDamage: number;
  dotDamage: number;
  summonDamage: number;
  firstDamageTimeMs: number | null;
  lastDamageTimeMs: number | null;
}

export class BattleStatisticsTracker {
  private readonly instances = new Map<string, MutableHeroDamageStatistics>();
  private readonly processedRequestIds = new Set<string>();

  public recordDamage(result: DamageResult): void {
    if (result.source.kind !== 'hero' || result.appliedDamage <= 0) return;
    if (this.processedRequestIds.has(result.requestId)) return;
    this.processedRequestIds.add(result.requestId);
    const current = this.instances.get(result.source.instanceId) ??
      createMutable(result.source.instanceId, result.source.definitionId);
    if (!this.instances.has(result.source.instanceId)) {
      this.instances.set(result.source.instanceId, current);
    }
    const amount = result.appliedDamage;
    current.totalDamage += amount;
    current.hitCount += 1;
    if (result.tags.includes('basicAttack')) current.basicAttackDamage += amount;
    if (result.tags.includes('skill')) current.skillDamage += amount;
    if (result.tags.includes('aoe')) current.aoeDamage += amount;
    if (result.tags.includes('dot')) current.dotDamage += amount;
    if (result.tags.includes('summon')) current.summonDamage += amount;
    if (result.isCritical) {
      current.criticalDamage += amount;
      current.criticalHits += 1;
    }
    current.firstDamageTimeMs ??= result.simulationTimeMs;
    current.lastDamageTimeMs = result.simulationTimeMs;
  }

  public reset(): void {
    this.instances.clear();
    this.processedRequestIds.clear();
  }

  public getSnapshot(elapsedBattleTimeMs: number): BattleStatisticsSnapshot {
    if (!Number.isFinite(elapsedBattleTimeMs) || elapsedBattleTimeMs < 0) {
      throw new RangeError('战斗统计时间必须是非负有限数字');
    }
    const byInstance = [...this.instances.values()]
      .sort((left, right) => left.sourceInstanceId.localeCompare(right.sourceInstanceId))
      .map((entry) => freezeInstance(entry, elapsedBattleTimeMs));
    const teamTotalDamage = byInstance.reduce(
      (total, entry) => total + entry.totalDamage,
      0,
    );
    const grouped = new Map<string, HeroDamageStatistics[]>();
    for (const entry of byInstance) {
      const group = grouped.get(entry.heroDefinitionId) ?? [];
      group.push(entry);
      grouped.set(entry.heroDefinitionId, group);
    }
    const byHero = [...grouped.entries()]
      .map(([heroDefinitionId, entries]) =>
        aggregateHero(heroDefinitionId, entries, elapsedBattleTimeMs, teamTotalDamage),
      )
      .sort((left, right) =>
        right.totalDamage - left.totalDamage ||
        left.heroDefinitionId.localeCompare(right.heroDefinitionId),
      );
    return Object.freeze({
      teamTotalDamage,
      elapsedBattleTimeMs,
      byInstance: Object.freeze(byInstance),
      byHero: Object.freeze(byHero),
    });
  }
}

function createMutable(
  sourceInstanceId: string,
  heroDefinitionId: string,
): MutableHeroDamageStatistics {
  return {
    sourceInstanceId,
    heroDefinitionId,
    totalDamage: 0,
    basicAttackDamage: 0,
    skillDamage: 0,
    criticalDamage: 0,
    criticalHits: 0,
    hitCount: 0,
    aoeDamage: 0,
    dotDamage: 0,
    summonDamage: 0,
    firstDamageTimeMs: null,
    lastDamageTimeMs: null,
  };
}

function freezeInstance(
  source: MutableHeroDamageStatistics,
  elapsedBattleTimeMs: number,
): HeroDamageStatistics {
  return Object.freeze({
    ...source,
    dps: calculateDps(source.totalDamage, elapsedBattleTimeMs),
  });
}

function aggregateHero(
  heroDefinitionId: string,
  entries: readonly HeroDamageStatistics[],
  elapsedBattleTimeMs: number,
  teamTotalDamage: number,
): HeroDefinitionDamageStatistics {
  const sum = (selector: (entry: HeroDamageStatistics) => number): number =>
    entries.reduce((total, entry) => total + selector(entry), 0);
  const totalDamage = sum((entry) => entry.totalDamage);
  const firstTimes = entries.flatMap((entry) =>
    entry.firstDamageTimeMs === null ? [] : [entry.firstDamageTimeMs],
  );
  const lastTimes = entries.flatMap((entry) =>
    entry.lastDamageTimeMs === null ? [] : [entry.lastDamageTimeMs],
  );
  return Object.freeze({
    heroDefinitionId,
    instanceCount: entries.length,
    totalDamage,
    basicAttackDamage: sum((entry) => entry.basicAttackDamage),
    skillDamage: sum((entry) => entry.skillDamage),
    criticalDamage: sum((entry) => entry.criticalDamage),
    criticalHits: sum((entry) => entry.criticalHits),
    hitCount: sum((entry) => entry.hitCount),
    aoeDamage: sum((entry) => entry.aoeDamage),
    dotDamage: sum((entry) => entry.dotDamage),
    summonDamage: sum((entry) => entry.summonDamage),
    firstDamageTimeMs: firstTimes.length === 0 ? null : Math.min(...firstTimes),
    lastDamageTimeMs: lastTimes.length === 0 ? null : Math.max(...lastTimes),
    dps: calculateDps(totalDamage, elapsedBattleTimeMs),
    teamShare: teamTotalDamage === 0 ? 0 : totalDamage / teamTotalDamage,
  });
}

function calculateDps(totalDamage: number, elapsedBattleTimeMs: number): number {
  return elapsedBattleTimeMs <= 0
    ? 0
    : totalDamage / (elapsedBattleTimeMs / 1_000);
}

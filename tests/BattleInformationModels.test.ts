import { describe, expect, it } from 'vitest';

import { BattleSession } from '../src/battle/BattleSession';
import type { DamageResult } from '../src/battle/combat/DamageResult';
import { BattleStatisticsTracker } from '../src/battle/statistics/BattleStatisticsTracker';
import { BATTLE_CONFIG } from '../src/data/battleConfig';
import { ENEMY_DEFINITIONS_BY_ID } from '../src/data/enemyDefinitions';
import { HERO_DEFINITIONS_BY_ID } from '../src/data/heroDefinitions';
import { PROTOTYPE_LEVEL } from '../src/data/levelDefinitions';
import { BattleRightDrawerState, getAvailableDrawerTabs } from '../src/ui/state/BattleRightDrawerState';
import { createDamageStatisticsViewModel } from '../src/ui/viewmodels/DamageStatisticsViewModel';
import { createEnemyIntel } from '../src/ui/viewmodels/EnemyIntelProvider';
import { createSelectedHeroInfo } from '../src/ui/viewmodels/SelectedHeroInfo';

describe('伤害统计', () => {
  it('按实例记录appliedDamage并按heroId稳定汇总', () => {
    const tracker = new BattleStatisticsTracker();
    tracker.recordDamage(result('damage-1', 'hero-2', 'gale-hunter', 25, false, 1_000));
    tracker.recordDamage(result('damage-2', 'hero-1', 'gale-hunter', 75, true, 2_000));
    tracker.recordDamage(result('damage-3', 'hero-3', 'ember-mage', 50, false, 2_500));
    const snapshot = tracker.getSnapshot(5_000);
    expect(snapshot.teamTotalDamage).toBe(150);
    expect(snapshot.byInstance.map((entry) => entry.sourceInstanceId))
      .toEqual(['hero-1', 'hero-2', 'hero-3']);
    expect(snapshot.byHero[0]).toMatchObject({
      heroDefinitionId: 'gale-hunter',
      instanceCount: 2,
      totalDamage: 100,
      basicAttackDamage: 100,
      criticalDamage: 75,
      criticalHits: 1,
      hitCount: 2,
      dps: 20,
      teamShare: 2 / 3,
    });
  });

  it('重复requestId不重复统计且暂停时相同模拟时间保持DPS', () => {
    const tracker = new BattleStatisticsTracker();
    const damage = result('damage-1', 'hero-1', 'gale-hunter', 100, false, 1_000);
    tracker.recordDamage(damage);
    tracker.recordDamage(damage);
    expect(tracker.getSnapshot(2_000).teamTotalDamage).toBe(100);
    expect(tracker.getSnapshot(2_000).byHero[0]?.dps).toBe(50);
    tracker.reset();
    expect(tracker.getSnapshot(0).teamTotalDamage).toBe(0);
  });

  it('ViewModel使用英雄定义名称且保持统计排序', () => {
    const tracker = new BattleStatisticsTracker();
    tracker.recordDamage(result('damage-1', 'hero-1', 'gale-hunter', 100, false, 1_000));
    const model = createDamageStatisticsViewModel(
      tracker.getSnapshot(2_000),
      HERO_DEFINITIONS_BY_ID,
    );
    expect(model.heroes[0]).toMatchObject({ name: '疾风猎手', totalDamage: 100 });
  });

  it('BattleSession排空表现事件不会清空整局统计，重置才清空', () => {
    const session = createSession();
    session.start();
    expect(session.attemptSummon().success).toBe(true);
    advance(session, 25_000);
    const beforeDrain = session.getSnapshot().statistics.teamTotalDamage;
    expect(beforeDrain).toBeGreaterThan(0);
    session.drainPresentationEvents();
    expect(session.getSnapshot().statistics.teamTotalDamage).toBe(beforeDrain);
    session.pause();
    const paused = session.getSnapshot().statistics;
    advance(session, 2_000);
    expect(session.getSnapshot().statistics).toEqual(paused);
    session.reset();
    expect(session.getSnapshot().statistics.teamTotalDamage).toBe(0);
  });

  it('同run seed和相同输入产生一致的伤害统计', () => {
    const run = (): ReturnType<BattleSession['getSnapshot']>['statistics'] => {
      const session = createSession();
      session.start();
      expect(session.attemptSummon().success).toBe(true);
      advance(session, 25_000);
      return session.getSnapshot().statistics;
    };
    expect(run()).toEqual(run());
  });
});

describe('怪物情报与英雄选中信息', () => {
  it('波次概览和选中怪物详情来自真实Definition与Runtime快照', () => {
    const session = createSession();
    session.start();
    advance(session, 8_200);
    const snapshot = session.getSnapshot();
    const enemy = snapshot.enemies[0];
    expect(enemy).toBeDefined();
    const intel = createEnemyIntel(
      snapshot,
      PROTOTYPE_LEVEL,
      ENEMY_DEFINITIONS_BY_ID,
      enemy!.id,
    );
    expect(intel.currentWave).toMatchObject({ waveIndex: 0, title: '边境侦察群' });
    expect(intel.currentWave?.enemies.length).toBeGreaterThan(0);
    expect(intel.selectedEnemy).toMatchObject({
      enemyInstanceId: enemy!.id,
      name: enemy!.name,
      health: enemy!.health,
      armor: enemy!.armor,
      resistance: enemy!.resistance,
    });
    expect(createEnemyIntel(
      { ...snapshot, enemies: [] },
      PROTOTYPE_LEVEL,
      ENEMY_DEFINITIONS_BY_ID,
      enemy!.id,
    ).selectedEnemy).toBeNull();
  });

  it('选中英雄信息条只读派生名称、精确星级、职业和战斗属性', () => {
    const session = createSession();
    session.start();
    const summon = session.attemptSummon();
    expect(summon.success).toBe(true);
    if (!summon.success) return;
    const model = createSelectedHeroInfo(
      summon.heroInstanceId,
      session.getSnapshot(),
      HERO_DEFINITIONS_BY_ID,
    );
    expect(model).toMatchObject({ heroInstanceId: summon.heroInstanceId, starLevel: 1 });
    expect(model?.effectiveBasicAttack).toBeGreaterThan(0);
  });

  it('同heroId的多个实例仍按具体instanceId刷新信息条', () => {
    const session = createSession();
    session.start();
    const summon = session.attemptSummon();
    expect(summon.success).toBe(true);
    if (!summon.success) return;
    const snapshot = session.getSnapshot();
    const original = snapshot.heroes.find(
      (hero) => hero.id === summon.heroInstanceId,
    );
    expect(original).toBeDefined();
    if (original === undefined) return;
    const secondInstance = {
      ...original,
      id: `${original.id}-second`,
      starLevel: 2 as const,
    };
    const duplicatedSnapshot = {
      ...snapshot,
      heroes: Object.freeze([...snapshot.heroes, secondInstance]),
    };
    const firstModel = createSelectedHeroInfo(
      original.id,
      duplicatedSnapshot,
      HERO_DEFINITIONS_BY_ID,
    );
    const secondModel = createSelectedHeroInfo(
      secondInstance.id,
      duplicatedSnapshot,
      HERO_DEFINITIONS_BY_ID,
    );
    expect(firstModel?.heroInstanceId).toBe(original.id);
    expect(secondModel).toMatchObject({
      heroInstanceId: secondInstance.id,
      name: firstModel?.name,
      starLevel: 2,
    });
    expect(secondModel?.effectiveBasicAttack).toBeGreaterThan(
      firstModel?.effectiveBasicAttack ?? 0,
    );
  });
});

describe('右侧抽屉状态', () => {
  it('默认收起、同一时间只有一个标签且点击当前标签收起', () => {
    const state = new BattleRightDrawerState(false);
    expect(state.snapshot).toEqual({ activeTab: null, expanded: false });
    expect(state.toggle('enemy-intel')).toEqual({ activeTab: 'enemy-intel', expanded: true });
    expect(state.toggle('damage-statistics')).toEqual({
      activeTab: 'damage-statistics',
      expanded: true,
    });
    expect(state.toggle('damage-statistics')).toEqual({ activeTab: null, expanded: false });
  });

  it('正式模式隐藏模拟调试，开发模式显式提供', () => {
    expect(getAvailableDrawerTabs(false)).toEqual(['enemy-intel', 'damage-statistics']);
    expect(getAvailableDrawerTabs(true)).toEqual([
      'enemy-intel',
      'damage-statistics',
      'simulation-debug',
    ]);
    expect(() => new BattleRightDrawerState(false).toggle('simulation-debug'))
      .toThrow('当前模式不可用');
  });
});

function createSession(): BattleSession {
  return new BattleSession({
    config: BATTLE_CONFIG,
    level: PROTOTYPE_LEVEL,
    heroDefinitions: HERO_DEFINITIONS_BY_ID,
    enemyDefinitions: ENEMY_DEFINITIONS_BY_ID,
    seed: 'information-model-test',
  });
}

function advance(session: BattleSession, milliseconds: number): void {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 20) session.update(20);
}

function result(
  requestId: string,
  sourceInstanceId: string,
  heroDefinitionId: string,
  appliedDamage: number,
  critical: boolean,
  simulationTimeMs: number,
): DamageResult {
  return {
    requestId,
    requestSequence: Number(requestId.replace(/\D/g, '')) || 1,
    source: { kind: 'hero', instanceId: sourceInstanceId, definitionId: heroDefinitionId },
    target: { kind: 'enemy', instanceId: 'enemy-1', definitionId: 'void-scout' },
    damageType: 'physical',
    tags: ['basicAttack', 'projectile'],
    simulationTimeMs,
    baseDamage: appliedDamage,
    starDamageMultiplier: 1,
    damageBeforeCritical: appliedDamage,
    isCritical: critical,
    criticalMultiplier: critical ? 1.8 : 1,
    damageAfterCritical: appliedDamage,
    defenseBeforePenetration: 0,
    effectiveDefense: 0,
    damageReduction: 0,
    mitigatedDamage: appliedDamage,
    damageTakenMultiplier: 1,
    calculatedDamage: appliedDamage,
    appliedDamage,
    overkillDamage: 0,
    targetHpBefore: 1_000,
    targetHpAfter: 1_000 - appliedDamage,
    isLethal: false,
  };
}

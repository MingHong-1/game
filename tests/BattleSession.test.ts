import { describe, expect, it } from 'vitest';

import { BattleSession } from '../src/battle/BattleSession';
import { BattleState } from '../src/battle/BattleState';
import type {
  EnemyDefinition,
  HeroDefinition,
  LevelDefinition,
} from '../src/battle/definitions';
import { BATTLE_CONFIG } from '../src/data/battleConfig';
import { ENEMY_DEFINITIONS_BY_ID } from '../src/data/enemyDefinitions';
import { HERO_DEFINITIONS_BY_ID } from '../src/data/heroDefinitions';
import { PROTOTYPE_LEVEL } from '../src/data/levelDefinitions';

function createPrototypeSession(seed = 'stage-2-session'): BattleSession {
  return new BattleSession({
    config: BATTLE_CONFIG,
    level: PROTOTYPE_LEVEL,
    heroDefinitions: HERO_DEFINITIONS_BY_ID,
    enemyDefinitions: ENEMY_DEFINITIONS_BY_ID,
    seed,
  });
}

const TEST_HEROES: readonly HeroDefinition[] = Array.from(
  { length: 4 },
  (_, index) => ({
    id: `reward-hero-${index}`,
    name: `奖励测试英雄 ${index}`,
    role: 'marksman' as const,
    color: 0x00ffff + index,
    radius: 10,
    attackDamage: 100,
    attackIntervalMs: 20,
    minimumAttackPathProgress: 0,
    projectileSpeed: 10_000,
    projectileColor: 0xffffff,
    targeting: 'closest-to-core' as const,
  }),
);

const TEST_ENEMIES: readonly EnemyDefinition[] = [
  {
    id: 'reward-normal',
    name: '普通',
    kind: 'normal',
    color: 0x00ff00,
    maxHealth: 1,
    traversalTimeSeconds: 100,
    coreDamage: 1,
    killEnergyReward: 1,
    radius: 5,
  },
  {
    id: 'reward-heavy',
    name: '重甲',
    kind: 'heavy',
    color: 0xffaa00,
    maxHealth: 1,
    traversalTimeSeconds: 100,
    coreDamage: 1,
    killEnergyReward: 2,
    radius: 5,
  },
  {
    id: 'reward-elite',
    name: '精英',
    kind: 'elite',
    color: 0xffff00,
    maxHealth: 1,
    traversalTimeSeconds: 100,
    coreDamage: 1,
    killEnergyReward: 5,
    radius: 5,
  },
  {
    id: 'reward-boss',
    name: 'Boss',
    kind: 'boss',
    color: 0xff0000,
    maxHealth: 1,
    traversalTimeSeconds: 100,
    coreDamage: 100,
    killEnergyReward: 0,
    radius: 8,
  },
];

const REWARD_LEVEL: LevelDefinition = {
  id: 'energy-reward-level',
  name: '能量奖励测试',
  defaultSeed: 'reward-seed',
  coreMaxHealth: 100,
  coreRadius: 20,
  coreColor: 0x00ffff,
  initialPreparationSeconds: 0,
  wavePreviewSeconds: 0,
  path: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
  laneLayout: {
    laneCount: 5,
    corridorWidthStart: 100,
    corridorWidthMiddle: 80,
    corridorWidthEnd: 50,
    laneSpacing: 18,
    localJitter: 2,
  },
  heroPool: TEST_HEROES.map((hero) => hero.id),
  heroSlots: Array.from({ length: 10 }, (_, index) => ({
    x: 0,
    y: index * 4,
  })),
  waves: [
    {
      id: 'reward-wave',
      startTimeMs: 0,
      completionEnergyReward: 2,
      preview: { title: '奖励波', threat: 'normal', formation: '测试' },
      spawns: TEST_ENEMIES.slice(0, 3).map((enemy) => ({
        enemyPool: [enemy.id],
        count: 1,
        intervalMs: 0,
        startDelayMs: 0,
      })),
    },
    {
      id: 'boss-wave',
      startTimeMs: 100_000,
      completionEnergyReward: 2,
      preview: { title: 'Boss 波', threat: 'boss', formation: '测试' },
      spawns: [
        {
          enemyPool: ['reward-boss'],
          count: 1,
          intervalMs: 0,
          startDelayMs: 0,
        },
      ],
    },
  ],
};

function createRewardSession(): BattleSession {
  return new BattleSession({
    config: BATTLE_CONFIG,
    level: REWARD_LEVEL,
    heroDefinitions: new Map(TEST_HEROES.map((hero) => [hero.id, hero])),
    enemyDefinitions: new Map(
      TEST_ENEMIES.map((enemy) => [enemy.id, enemy]),
    ),
  });
}

function summonWheneverPossible(session: BattleSession): void {
  const snapshot = session.getSnapshot();
  if (
    snapshot.state === BattleState.Running &&
    snapshot.canSummonIntoSlot &&
    snapshot.energy >= snapshot.currentSummonCost
  ) {
    session.attemptSummon();
  }
}

describe('BattleSession', () => {
  it('以 15 能量、5 个空格和费用 5 开始', () => {
    const session = createPrototypeSession();
    const snapshot = session.getSnapshot();

    expect(snapshot.energy).toBe(15);
    expect(snapshot.currentSummonCost).toBe(5);
    expect(snapshot.successfulSummons).toBe(0);
    expect(snapshot.heroCount).toBe(0);
    expect(snapshot.unlockedSlots).toBe(5);
    expect(snapshot.maximumSlots).toBe(10);
    expect(snapshot.nextSlotUnlockAt).toBe(5);
  });

  it('准备倒计时期间允许召唤但尚不生成敌人', () => {
    const session = createPrototypeSession('preparation-summon');
    session.start();
    expect(session.getSnapshot().isPreparing).toBe(true);
    expect(session.attemptSummon().success).toBe(true);
    expect(session.getSnapshot().heroCount).toBe(1);

    for (let elapsed = 0; elapsed < 7_000; elapsed += BATTLE_CONFIG.fixedStepMs) {
      session.update(BATTLE_CONFIG.fixedStepMs);
    }
    expect(session.getSnapshot().enemies).toHaveLength(0);
    expect(session.getSnapshot().preparationRemainingMs).toBe(1_000);
  });

  it('战斗前拒绝召唤且不产生副作用', () => {
    const session = createPrototypeSession();
    const before = session.getSnapshot();

    expect(session.attemptSummon()).toMatchObject({
      success: false,
      reason: 'battle-not-running',
    });
    expect(session.getSnapshot()).toEqual(before);
  });

  it('初始能量只够连续召唤 3 次，第四次因能量不足被拒绝', () => {
    const session = createPrototypeSession();
    session.start();

    expect(session.attemptSummon().success).toBe(true);
    expect(session.attemptSummon().success).toBe(true);
    expect(session.attemptSummon().success).toBe(true);
    expect(session.attemptSummon()).toMatchObject({
      success: false,
      reason: 'insufficient-energy',
    });

    const snapshot = session.getSnapshot();
    expect(snapshot.energy).toBe(0);
    expect(snapshot.heroCount).toBe(3);
    expect(snapshot.successfulSummons).toBe(3);
    expect(snapshot.bagRemainingCount).toBe(5);
  });

  it('召唤英雄使用对应格位作为展示和弹道起点', () => {
    const session = createPrototypeSession('slot-visual-position');
    session.start();

    const result = session.attemptSummon();
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    const snapshot = session.getSnapshot();
    expect(snapshot.heroes).toHaveLength(1);
    expect(snapshot.heroes[0]).toMatchObject({
      id: result.heroInstanceId,
      definitionId: result.heroDefinitionId,
      x: result.slot.x,
      y: result.slot.y,
    });
    expect(snapshot.slots[result.slot.index]?.occupant).toMatchObject({
      instanceId: result.heroInstanceId,
    });

    let projectile = session.getSnapshot().projectiles[0];
    for (let step = 0; step < 4_000 && projectile === undefined; step += 1) {
      session.update(BATTLE_CONFIG.fixedStepMs);
      projectile = session.getSnapshot().projectiles[0];
    }
    const heroDefinition = HERO_DEFINITIONS_BY_ID.get(
      result.heroDefinitionId,
    );
    expect(projectile).toBeDefined();
    expect(heroDefinition).toBeDefined();
    if (projectile !== undefined && heroDefinition !== undefined) {
      const distanceFromSlot = Math.hypot(
        projectile.x - result.slot.x,
        projectile.y - result.slot.y,
      );
      expect(distanceFromSlot).toBeGreaterThan(0);
      expect(distanceFromSlot).toBeLessThanOrEqual(
        heroDefinition.projectileSpeed * (BATTLE_CONFIG.fixedStepMs / 1_000) +
          1e-9,
      );
      expect(projectile.y).toBeLessThan(result.slot.y);
    }
  });

  it('普通、重甲、精英击杀与波次完成奖励进入同一能量账户', () => {
    const session = createRewardSession();
    session.start();
    expect(session.attemptSummon().success).toBe(true);
    expect(session.getSnapshot().energy).toBe(10);

    session.update(120);
    expect(session.getSnapshot().energy).toBe(20);

    session.update(1_000);
    expect(session.getSnapshot().energy).toBe(20);
  });

  it('相同种子和玩家操作复现相同召唤与战斗快照', () => {
    const first = createPrototypeSession('same-session');
    const second = createPrototypeSession('same-session');
    first.start();
    second.start();

    for (let frame = 0; frame < 80; frame += 1) {
      summonWheneverPossible(first);
      summonWheneverPossible(second);
      first.update(120);
      second.update(120);
    }

    expect(first.getSnapshot()).toEqual(second.getSnapshot());
  });

  it('同种子重演恢复相同召唤顺序', () => {
    const session = createPrototypeSession('same-seed-replay');
    const summonThree = (): string[] => {
      session.start();
      return Array.from({ length: 3 }, () => {
        const result = session.attemptSummon();
        if (!result.success) throw new Error('测试召唤失败');
        return result.heroDefinitionId;
      });
    };

    const firstOrder = summonThree();
    session.reset();
    const replayOrder = summonThree();
    expect(replayOrder).toEqual(firstOrder);
    expect(session.getSnapshot().seed).toBe('same-seed-replay');
  });

  it('默认原型可通过能量奖励完成首次扩格并胜利', () => {
    const session = createPrototypeSession(PROTOTYPE_LEVEL.defaultSeed);
    session.start();
    session.setTimeScale(2);

    for (
      let frame = 0;
      frame < 2_000 && session.state === BattleState.Running;
      frame += 1
    ) {
      summonWheneverPossible(session);
      session.update(50);
    }

    const snapshot = session.getSnapshot();
    expect(snapshot.heroCount).toBe(6);
    expect(snapshot.unlockedSlots).toBe(6);
    expect(snapshot.successfulSummons).toBe(6);
    expect(snapshot.state).toBe(BattleState.Victory);
    expect(snapshot.coreHealth).toBeGreaterThan(0);
  });

  it('重置恢复初始能量、空格位、召唤次数和英雄袋', () => {
    const session = createPrototypeSession();
    session.start();
    session.attemptSummon();
    session.attemptSummon();
    session.reset();

    const snapshot = session.getSnapshot();
    expect(snapshot.state).toBe(BattleState.Ready);
    expect(snapshot.energy).toBe(15);
    expect(snapshot.heroCount).toBe(0);
    expect(snapshot.successfulSummons).toBe(0);
    expect(snapshot.bagRemainingCount).toBe(0);
    expect(snapshot.unlockedSlots).toBe(5);
    expect(snapshot.heroes).toHaveLength(0);
    expect(snapshot.slots.map((slot) => slot.occupant)).toEqual(
      Array.from({ length: 10 }, () => null),
    );
    expect(snapshot.slots.map(({ x, y }) => ({ x, y }))).toEqual(
      PROTOTYPE_LEVEL.heroSlots,
    );
  });

  it('表现事件可独立消费且重置后不残留旧事件', () => {
    const session = createPrototypeSession('presentation-events');
    session.start();
    session.attemptSummon();
    for (let frame = 0; frame < 1_000; frame += 1) session.update(20);
    expect(session.drainPresentationEvents().some(
      (event) => event.type === 'hero-attacked',
    )).toBe(true);
    expect(session.drainPresentationEvents()).toEqual([]);

    session.update(20);
    session.reset();
    expect(session.drainPresentationEvents()).toEqual([]);
  });
});

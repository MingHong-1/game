import { describe, expect, it } from 'vitest';

import type {
  BattleSnapshot,
  EnemySnapshot,
} from '../src/battle/BattleSimulation';
import { BattleState } from '../src/battle/BattleState';
import {
  assertMonotonicSimulationProgress,
  EnemyProgressRegressionMonitor,
} from '../src/battle/EnemyProgressRegressionMonitor';
import {
  applyEnemyHitPose,
  createEnemyHitTweenConfig,
  writeEnemyMotionPosition,
} from '../src/ui/state/EnemyViewTransform';
import { StableViewRegistry } from '../src/ui/state/StableViewRegistry';

function createEnemy(
  id: string,
  previousPathProgress: number,
  pathProgress: number,
  renderPathProgress: number,
): EnemySnapshot {
  return {
    id,
    definitionId: 'diagnostic-enemy',
    name: '诊断敌人',
    kind: 'normal',
    color: 0xffffff,
    radius: 10,
    health: 10,
    maxHealth: 10,
    traversalTimeSeconds: 22,
    estimatedRemainingSeconds: (1 - pathProgress) * 22,
    previousPathProgress,
    renderPathProgress,
    previousX: 0,
    previousY: previousPathProgress * 100,
    renderX: 0,
    renderY: renderPathProgress * 100,
    pathProgress,
    laneIndex: 2,
    laneOffset: 0,
    x: 0,
    y: pathProgress * 100,
  };
}

function createSnapshot(enemy: EnemySnapshot): BattleSnapshot {
  return {
    state: BattleState.Running,
    elapsedMs: 1_000,
    battleElapsedMs: 1_000,
    preparationRemainingMs: 0,
    isPreparing: false,
    currentWaveIndex: 0,
    upcomingWave: null,
    timingStats: {
      firstSpawnTimeMs: 0,
      firstCoreArrivalTimeMs: null,
      firstCoreArrivalTraversalMs: null,
      averageTraversalTimeSeconds: 22,
      peakAliveEnemyCount: 1,
      closestEnemyTraversalTimeSeconds: 22,
      closestEnemyEstimatedRemainingSeconds: 20,
      currentWaveStartTimeMs: 0,
    },
    frameDiagnostics: {
      maxSimulationStepsPerFrame: 5,
      maxAccumulatedTimeMs: 100,
      lastFrameDeltaMs: 16,
      simulationStepsLastFrame: 1,
      interpolationAlpha: 0.5,
      accumulatorMs: 10,
      droppedSimulationTimeLastFrameMs: 0,
      droppedSimulationTimeMs: 0,
      peakFrameDeltaMs: 16,
      longFramesOver33Ms: 0,
      longFramesOver50Ms: 0,
      longFramesOver100Ms: 0,
      frameInputSuspended: false,
      visibilityResyncCount: 0,
    },
    timeScale: 1,
    seed: 'diagnostic-seed',
    coreHealth: 100,
    coreMaxHealth: 100,
    pendingSpawnCount: 0,
    heroes: [],
    enemies: [enemy],
    projectiles: [],
  };
}

describe('敌人回退诊断', () => {
  it('模拟进度断言接受单调推进并拒绝真实回退', () => {
    expect(() => assertMonotonicSimulationProgress('enemy-1', 0.2, 0.2))
      .not.toThrow();
    expect(() => assertMonotonicSimulationProgress('enemy-1', 0.2, 0.21))
      .not.toThrow();
    expect(() => assertMonotonicSimulationProgress('enemy-1', 0.2, 0.19))
      .toThrow('模拟 pathProgress 回退');
  });

  it('分别识别模拟回退和显示回退，并对同一实例和类型只报告一次', () => {
    const monitor = new EnemyProgressRegressionMonitor();
    expect(monitor.observe(createSnapshot(createEnemy('enemy-1', 0.1, 0.12, 0.11))))
      .toEqual([]);

    const renderRegression = monitor.observe(
      createSnapshot(createEnemy('enemy-1', 0.12, 0.14, 0.09)),
    );
    expect(renderRegression).toHaveLength(1);
    expect(renderRegression[0]).toMatchObject({
      type: 'render-progress-regression',
      instanceId: 'enemy-1',
      previousSimulationProgress: 0.12,
      currentSimulationProgress: 0.14,
      lastRenderedProgress: 0.11,
      renderedProgress: 0.09,
      interpolationAlpha: 0.5,
      accumulatorMs: 10,
      simulationStepsThisFrame: 1,
      droppedLongFrameTime: false,
      timeScale: 1,
      state: BattleState.Running,
    });
    expect(monitor.observe(
      createSnapshot(createEnemy('enemy-1', 0.12, 0.14, 0.08)),
    )).toEqual([]);

    const simulationRegression = monitor.observe(
      createSnapshot(createEnemy('enemy-1', 0.14, 0.13, 0.13)),
    );
    expect(simulationRegression).toHaveLength(1);
    expect(simulationRegression[0]?.type)
      .toBe('simulation-progress-regression');
  });
});

describe('稳定敌人视图身份', () => {
  it('数组重排和删除不会让其他实例换绑，新实例不会继承旧视图', () => {
    const registry = new StableViewRegistry<{ readonly token: symbol }>();
    registry.beginFrame();
    const firstA = registry.getOrCreate('enemy-a', () => ({ token: Symbol('a') }));
    const firstB = registry.getOrCreate('enemy-b', () => ({ token: Symbol('b') }));
    registry.sweep(() => undefined);

    registry.beginFrame();
    const reorderedB = registry.getOrCreate('enemy-b', () => ({ token: Symbol('wrong-b') }));
    const reorderedA = registry.getOrCreate('enemy-a', () => ({ token: Symbol('wrong-a') }));
    registry.sweep(() => undefined);
    expect(reorderedA).toBe(firstA);
    expect(reorderedB).toBe(firstB);

    registry.beginFrame();
    expect(registry.getOrCreate('enemy-b', () => ({ token: Symbol('wrong-b') })))
      .toBe(firstB);
    const destroyed: symbol[] = [];
    registry.sweep((view) => destroyed.push(view.token));
    expect(destroyed).toEqual([firstA.token]);

    registry.beginFrame();
    registry.getOrCreate('enemy-b', () => ({ token: Symbol('wrong-b') }));
    const newA = registry.getOrCreate('enemy-a', () => ({ token: Symbol('new-a') }));
    registry.sweep(() => undefined);
    expect(newA).not.toBe(firstA);
  });

  it('30 个实例同时删除和重排时保持每个存活实例的原视图', () => {
    const registry = new StableViewRegistry<{ readonly id: number }>();
    registry.beginFrame();
    const original = new Map<string, { readonly id: number }>();
    for (let index = 0; index < 30; index += 1) {
      const instanceId = `enemy-${index}`;
      original.set(instanceId, registry.getOrCreate(instanceId, () => ({ id: index })));
    }
    registry.sweep(() => undefined);

    registry.beginFrame();
    for (let index = 29; index >= 0; index -= 2) {
      const instanceId = `enemy-${index}`;
      expect(registry.getOrCreate(instanceId, () => ({ id: -1 })))
        .toBe(original.get(instanceId));
    }
    registry.sweep(() => undefined);
    expect(registry.size).toBe(15);
  });
});

describe('敌人运动根节点与视觉反馈隔离', () => {
  it('受击姿态和Tween只作用视觉节点，不修改运动根节点坐标', () => {
    const root = {
      x: 0,
      y: 0,
      setPosition(x: number, y: number) {
        this.x = x;
        this.y = y;
      },
    };
    const visual = {
      alpha: 1,
      scale: 1,
      setAlpha(alpha: number) {
        this.alpha = alpha;
        return this;
      },
      setScale(scale: number) {
        this.scale = scale;
        return this;
      },
    };

    writeEnemyMotionPosition(root, 120, 240);
    applyEnemyHitPose(visual);
    const tween = createEnemyHitTweenConfig(visual, 120);
    expect(root).toMatchObject({ x: 120, y: 240 });
    expect(visual).toMatchObject({ alpha: 0.58, scale: 1.08 });
    expect(tween.targets).toBe(visual);
    expect(tween).not.toHaveProperty('x');
    expect(tween).not.toHaveProperty('y');
  });
});

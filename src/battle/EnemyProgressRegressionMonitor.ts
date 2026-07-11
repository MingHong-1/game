import type { BattleSnapshot } from './BattleSimulation';
import type { BattleState } from './BattleState';
import type { BattleTimeScale } from './definitions';

export const PROGRESS_REGRESSION_EPSILON = 1e-6;

interface LastEnemyProgress {
  readonly simulationProgress: number;
  readonly renderedProgress: number;
}

export interface EnemyProgressRegressionDiagnostic {
  readonly type: 'simulation-progress-regression' | 'render-progress-regression';
  readonly instanceId: string;
  readonly previousSimulationProgress: number;
  readonly currentSimulationProgress: number;
  readonly lastRenderedProgress: number;
  readonly renderedProgress: number;
  readonly renderedX: number;
  readonly renderedY: number;
  readonly interpolationAlpha: number;
  readonly frameDeltaMs: number;
  readonly accumulatorMs: number;
  readonly simulationStepsThisFrame: number;
  readonly droppedLongFrameTime: boolean;
  readonly droppedSimulationTimeLastFrameMs: number;
  readonly timeScale: BattleTimeScale;
  readonly state: BattleState;
}

export function assertMonotonicSimulationProgress(
  instanceId: string,
  previousProgress: number,
  currentProgress: number,
): void {
  if (currentProgress < previousProgress - PROGRESS_REGRESSION_EPSILON) {
    throw new Error(
      `敌人 ${instanceId} 的模拟 pathProgress 回退：${previousProgress} -> ${currentProgress}`,
    );
  }
}

/** 只负责诊断，不修正或钳制任何模拟/显示进度。 */
export class EnemyProgressRegressionMonitor {
  private readonly lastProgressById = new Map<string, LastEnemyProgress>();
  private readonly reportedKeys = new Set<string>();

  public observe(snapshot: BattleSnapshot): readonly EnemyProgressRegressionDiagnostic[] {
    const diagnostics: EnemyProgressRegressionDiagnostic[] = [];
    const activeIds = new Set<string>();

    for (const enemy of snapshot.enemies) {
      activeIds.add(enemy.id);
      const last = this.lastProgressById.get(enemy.id);
      const simulationRegressed =
        enemy.pathProgress <
          enemy.previousPathProgress - PROGRESS_REGRESSION_EPSILON ||
        (last !== undefined &&
          enemy.pathProgress <
            last.simulationProgress - PROGRESS_REGRESSION_EPSILON);
      const renderRegressed =
        last !== undefined &&
        enemy.renderPathProgress <
          last.renderedProgress - PROGRESS_REGRESSION_EPSILON;

      if (simulationRegressed) {
        this.recordOnce(
          diagnostics,
          'simulation-progress-regression',
          enemy,
          last?.renderedProgress ?? enemy.renderPathProgress,
          snapshot,
        );
      }
      if (renderRegressed) {
        this.recordOnce(
          diagnostics,
          'render-progress-regression',
          enemy,
          last?.renderedProgress ?? enemy.renderPathProgress,
          snapshot,
        );
      }
      this.lastProgressById.set(enemy.id, {
        simulationProgress: enemy.pathProgress,
        renderedProgress: enemy.renderPathProgress,
      });
    }

    for (const instanceId of this.lastProgressById.keys()) {
      if (!activeIds.has(instanceId)) this.lastProgressById.delete(instanceId);
    }
    return diagnostics;
  }

  /** 用于重置、visibility 和丢帧边界，建立新的显示基线而不报告回退。 */
  public snap(snapshot: BattleSnapshot): void {
    this.lastProgressById.clear();
    for (const enemy of snapshot.enemies) {
      this.lastProgressById.set(enemy.id, {
        simulationProgress: enemy.pathProgress,
        renderedProgress: enemy.pathProgress,
      });
    }
  }

  public reset(): void {
    this.lastProgressById.clear();
    this.reportedKeys.clear();
  }

  private recordOnce(
    diagnostics: EnemyProgressRegressionDiagnostic[],
    type: EnemyProgressRegressionDiagnostic['type'],
    enemy: BattleSnapshot['enemies'][number],
    lastRenderedProgress: number,
    snapshot: BattleSnapshot,
  ): void {
    const key = `${enemy.id}:${type}`;
    if (this.reportedKeys.has(key)) return;
    this.reportedKeys.add(key);
    diagnostics.push({
      type,
      instanceId: enemy.id,
      previousSimulationProgress: enemy.previousPathProgress,
      currentSimulationProgress: enemy.pathProgress,
      lastRenderedProgress,
      renderedProgress: enemy.renderPathProgress,
      renderedX: enemy.renderX,
      renderedY: enemy.renderY,
      interpolationAlpha: snapshot.frameDiagnostics.interpolationAlpha,
      frameDeltaMs: snapshot.frameDiagnostics.lastFrameDeltaMs,
      accumulatorMs: snapshot.frameDiagnostics.accumulatorMs,
      simulationStepsThisFrame:
        snapshot.frameDiagnostics.simulationStepsLastFrame,
      droppedLongFrameTime:
        snapshot.frameDiagnostics.droppedSimulationTimeLastFrameMs > 0,
      droppedSimulationTimeLastFrameMs:
        snapshot.frameDiagnostics.droppedSimulationTimeLastFrameMs,
      timeScale: snapshot.timeScale,
      state: snapshot.state,
    });
  }
}

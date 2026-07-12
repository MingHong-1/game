import { BattleState } from './BattleState';
import { BattleStateMachine } from './BattleStateMachine';
import type { BattleEvent } from './BattleEvents';
import { assertMonotonicSimulationProgress } from './EnemyProgressRegressionMonitor';
import type {
  BattleConfig,
  BattleTimeScale,
  EnemyDefinition,
  EnemyKind,
  HeroDefinition,
  LevelDefinition,
  PointDefinition,
} from './definitions';
import { isEnemyInHeroAttackArea } from './HeroTargeting';
import {
  assertHeroStar,
  MIN_HERO_STAR,
  type HeroStar,
} from './HeroStar';
import { LanePathGeometry, type LanePosition } from './LanePathGeometry';
import {
  getEligibleLaneIndices,
  LaneSpawnPlanner,
} from './LaneSpawnPlanner';
import {
  getInterpolationAlpha,
  interpolateNumber,
} from './RenderInterpolation';
import { type RandomSeed, SeededRandom } from './SeededRandom';
import { RunRandomStreams } from './RunRandomStreams';
import { WaveRandomStreams } from './WaveRandomStreams';
import {
  aggregateCombatStats,
  type CombatModifier,
} from './combat/CombatModifiers';
import {
  type CombatStats,
  createCombatStats,
  getEffectiveAttackIntervalMs,
} from './combat/CombatStats';
import { DamageApplicationLedger } from './combat/DamageApplication';
import type { DamageResult } from './combat/DamageResult';
import { resolveDamage } from './combat/DamageResolver';
import {
  createDamageTags,
  type DamageType,
  getConfiguredDamageType,
} from './combat/DamageTypes';

const BASIC_PROJECTILE_DAMAGE_TAGS = createDamageTags(
  'basicAttack',
  'projectile',
);

interface RuntimeHero {
  readonly id: string;
  readonly definition: HeroDefinition;
  readonly x: number;
  readonly y: number;
  readonly starLevel: HeroStar;
  readonly baseCombatStats: CombatStats;
  readonly combatModifiers: readonly CombatModifier[];
  readonly combatStats: CombatStats;
  cooldownMs: number;
}

interface RuntimeEnemy {
  readonly id: string;
  readonly definition: EnemyDefinition;
  readonly waveId: string;
  readonly laneIndex: number;
  readonly localJitter: number;
  readonly spawnOrder: number;
  readonly spawnedAtMs: number;
  health: number;
  readonly baseCombatStats: CombatStats;
  readonly combatModifiers: readonly CombatModifier[];
  readonly combatStats: CombatStats;
  traversalElapsedMs: number;
  /** 为阶段 2D 的减速/加速预留；本阶段固定为 1。 */
  movementRate: number;
  previousPathProgress: number;
  pathProgress: number;
}

interface RuntimeProjectile {
  readonly id: string;
  readonly sequence: number;
  readonly sourceHeroInstanceId: string;
  readonly sourceHeroDefinitionId: string;
  readonly targetEnemyId: string;
  readonly baseAmount: number;
  readonly damageType: DamageType;
  readonly sourceStar: HeroStar;
  readonly sourceStats: CombatStats;
  readonly speed: number;
  readonly color: number;
  previousX: number;
  previousY: number;
  x: number;
  y: number;
}

interface SpawnScheduleItem {
  readonly atMs: number;
  readonly order: number;
  readonly waveId: string;
  readonly enemyPool: readonly string[];
  readonly spawn: LevelDefinition['waves'][number]['spawns'][number];
  readonly spawnIndex: number;
}

interface RuntimeWaveState {
  readonly completionEnergyReward: number;
  remainingToSpawn: number;
  activeEnemies: number;
  completed: boolean;
}

interface RuntimeWaveRandomState {
  readonly waveCompositionRng: SeededRandom;
  readonly waveLanePlanner: LaneSpawnPlanner;
  readonly waveVisualJitterRng: SeededRandom;
}

export interface HeroSnapshot extends PointDefinition {
  readonly id: string;
  readonly definitionId: string;
  readonly name: string;
  readonly color: number;
  readonly radius: number;
  readonly starLevel: HeroStar;
}

export interface EnemySnapshot extends PointDefinition {
  readonly id: string;
  readonly definitionId: string;
  readonly name: string;
  readonly kind: EnemyKind;
  readonly waveId: string;
  readonly color: number;
  readonly radius: number;
  readonly health: number;
  readonly maxHealth: number;
  readonly armor: number;
  readonly resistance: number;
  readonly traversalTimeSeconds: number;
  readonly estimatedRemainingSeconds: number;
  /** 以下 previous/render 字段只供显示插值，不是玩法权威状态。 */
  readonly previousPathProgress: number;
  readonly renderPathProgress: number;
  readonly previousX: number;
  readonly previousY: number;
  readonly renderX: number;
  readonly renderY: number;
  readonly pathProgress: number;
  readonly laneIndex: number;
  readonly laneOffset: number;
}

export interface WaveRuntimeSnapshot {
  readonly waveId: string;
  readonly remainingToSpawn: number;
  readonly activeEnemies: number;
  readonly completed: boolean;
}

export interface WavePreviewSnapshot {
  readonly waveIndex: number;
  readonly waveId: string;
  readonly title: string;
  readonly threat: LevelDefinition['waves'][number]['preview']['threat'];
  readonly formation: string;
  readonly primaryEnemyNames: readonly string[];
  readonly startsInMs: number;
  readonly startTimeMs: number;
}

export interface BattleTimingStatsSnapshot {
  readonly firstSpawnTimeMs: number | null;
  readonly firstCoreArrivalTimeMs: number | null;
  readonly firstCoreArrivalTraversalMs: number | null;
  readonly averageTraversalTimeSeconds: number | null;
  readonly peakAliveEnemyCount: number;
  readonly closestEnemyTraversalTimeSeconds: number | null;
  readonly closestEnemyEstimatedRemainingSeconds: number | null;
  readonly currentWaveStartTimeMs: number | null;
}

export interface ProjectileSnapshot extends PointDefinition {
  readonly id: string;
  readonly sourceHeroInstanceId: string;
  readonly color: number;
  readonly radius: number;
  readonly previousX: number;
  readonly previousY: number;
  readonly renderX: number;
  readonly renderY: number;
}

export interface SimulationFrameDiagnostics {
  readonly maxSimulationStepsPerFrame: number;
  readonly maxAccumulatedTimeMs: number;
  readonly lastFrameDeltaMs: number;
  readonly simulationStepsLastFrame: number;
  readonly interpolationAlpha: number;
  readonly accumulatorMs: number;
  readonly droppedSimulationTimeLastFrameMs: number;
  readonly droppedSimulationTimeMs: number;
  readonly peakFrameDeltaMs: number;
  readonly longFramesOver33Ms: number;
  readonly longFramesOver50Ms: number;
  readonly longFramesOver100Ms: number;
  readonly frameInputSuspended: boolean;
  readonly visibilityResyncCount: number;
}

export interface BattleSnapshot {
  readonly state: BattleState;
  readonly elapsedMs: number;
  readonly battleElapsedMs: number;
  readonly preparationRemainingMs: number;
  readonly isPreparing: boolean;
  readonly currentWaveIndex: number | null;
  readonly upcomingWave: WavePreviewSnapshot | null;
  readonly timingStats: BattleTimingStatsSnapshot;
  readonly frameDiagnostics: SimulationFrameDiagnostics;
  readonly timeScale: BattleTimeScale;
  readonly seed: string;
  readonly coreHealth: number;
  readonly coreMaxHealth: number;
  readonly pendingSpawnCount: number;
  readonly heroes: readonly HeroSnapshot[];
  readonly enemies: readonly EnemySnapshot[];
  readonly projectiles: readonly ProjectileSnapshot[];
  readonly waves: readonly WaveRuntimeSnapshot[];
}

export const MAX_SIMULATION_STEPS_PER_FRAME = 5;

export interface BattleSimulationOptions {
  readonly config: BattleConfig;
  readonly level: LevelDefinition;
  readonly heroDefinitions: ReadonlyMap<string, HeroDefinition>;
  readonly enemyDefinitions: ReadonlyMap<string, EnemyDefinition>;
  readonly seed?: RandomSeed;
  readonly combatDebug?: boolean;
}

function assertPositiveFinite(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${fieldName}必须是正数`);
  }
}

function assertNonNegativeFinite(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${fieldName}不能是负数`);
  }
}

export class BattleSimulation {
  private readonly stateMachine = new BattleStateMachine();
  private readonly laneGeometry: LanePathGeometry;
  private readonly spawnSchedule: readonly SpawnScheduleItem[];
  private readonly config: BattleConfig;
  private readonly level: LevelDefinition;
  private readonly heroDefinitions: ReadonlyMap<string, HeroDefinition>;
  private readonly enemyDefinitions: ReadonlyMap<string, EnemyDefinition>;
  private readonly heroes = new Map<string, RuntimeHero>();
  private readonly enemies = new Map<string, RuntimeEnemy>();
  private readonly projectiles = new Map<string, RuntimeProjectile>();
  private readonly waveStates = new Map<string, RuntimeWaveState>();
  private readonly pendingEvents: BattleEvent[] = [];
  private readonly damageApplication = new DamageApplicationLedger();
  private readonly combatDebug: boolean;

  private readonly waveRandomStates = new Map<
    string,
    RuntimeWaveRandomState
  >();
  private runSeed: string;
  private timeScale: BattleTimeScale;
  private elapsedMs = 0;
  private accumulatorMs = 0;
  private coreHealth = 0;
  private spawnCursor = 0;
  private nextEnemyId = 1;
  private nextProjectileId = 1;
  private nextDamageRequestId = 1;
  private combatRng!: SeededRandom;
  private firstSpawnTimeMs: number | null = null;
  private firstCoreArrivalTimeMs: number | null = null;
  private firstCoreArrivalTraversalMs: number | null = null;
  private totalSpawnedTraversalSeconds = 0;
  private spawnedEnemyCount = 0;
  private peakAliveEnemyCount = 0;
  private frameInputSuspended = false;
  private ignoreNextFrameDelta = false;
  private simulationStepsLastFrame = 0;
  private lastFrameDeltaMs = 0;
  private droppedSimulationTimeLastFrameMs = 0;
  private droppedSimulationTimeMs = 0;
  private droppedSimulationTimeThisFrame = false;
  private peakFrameDeltaMs = 0;
  private longFramesOver33Ms = 0;
  private longFramesOver50Ms = 0;
  private longFramesOver100Ms = 0;
  private visibilityResyncCount = 0;

  public constructor(options: BattleSimulationOptions) {
    this.config = options.config;
    this.level = options.level;
    this.heroDefinitions = options.heroDefinitions;
    this.enemyDefinitions = options.enemyDefinitions;
    this.combatDebug = options.combatDebug === true && import.meta.env.DEV;
    this.laneGeometry = new LanePathGeometry(
      options.level.path,
      options.level.laneLayout,
    );

    const initialSeed = options.seed ?? options.level.defaultSeed;
    this.runSeed = new SeededRandom(initialSeed).seed;

    this.validateConfig();
    this.spawnSchedule = this.buildSpawnSchedule();
    this.timeScale = this.config.defaultTimeScale;
    this.reset(initialSeed);
  }

  public get state(): BattleState {
    return this.stateMachine.state;
  }

  public get seed(): string {
    return this.runSeed;
  }

  public start(): boolean {
    return this.transitionFrom(BattleState.Ready, BattleState.Running);
  }

  public pause(): boolean {
    return this.transitionFrom(BattleState.Running, BattleState.Paused);
  }

  public resume(): boolean {
    return this.transitionFrom(BattleState.Paused, BattleState.Running);
  }

  public openSkillSelection(): boolean {
    return this.transitionFrom(
      BattleState.Running,
      BattleState.SkillSelection,
    );
  }

  public closeSkillSelection(): boolean {
    return this.transitionFrom(
      BattleState.SkillSelection,
      BattleState.Running,
    );
  }

  public setTimeScale(timeScale: BattleTimeScale): void {
    if (!this.config.supportedTimeScales.includes(timeScale)) {
      throw new RangeError(`不支持的战斗倍速：${timeScale}`);
    }
    this.timeScale = timeScale;
  }

  /** 页面隐藏或失焦时停止接纳真实时间；恢复后的第一帧仅用于时钟重同步。 */
  public setFrameInputSuspended(suspended: boolean): void {
    if (this.frameInputSuspended === suspended) return;
    this.frameInputSuspended = suspended;
    this.accumulatorMs = 0;
    this.simulationStepsLastFrame = 0;
    this.droppedSimulationTimeLastFrameMs = 0;
    this.droppedSimulationTimeThisFrame = false;
    this.synchronizeInterpolationState();
    if (!suspended) {
      this.ignoreNextFrameDelta = true;
      this.visibilityResyncCount += 1;
    }
  }

  public reset(seed: RandomSeed = this.runSeed): void {
    this.stateMachine.reset();
    this.runSeed = new SeededRandom(seed).seed;
    this.timeScale = this.config.defaultTimeScale;
    this.elapsedMs = 0;
    this.accumulatorMs = 0;
    this.coreHealth = this.level.coreMaxHealth;
    this.spawnCursor = 0;
    this.nextEnemyId = 1;
    this.nextProjectileId = 1;
    this.nextDamageRequestId = 1;
    this.combatRng = new RunRandomStreams(this.runSeed).create('combatRng');
    this.damageApplication.reset();
    this.firstSpawnTimeMs = null;
    this.firstCoreArrivalTimeMs = null;
    this.firstCoreArrivalTraversalMs = null;
    this.totalSpawnedTraversalSeconds = 0;
    this.spawnedEnemyCount = 0;
    this.peakAliveEnemyCount = 0;
    this.frameInputSuspended = false;
    this.ignoreNextFrameDelta = false;
    this.simulationStepsLastFrame = 0;
    this.lastFrameDeltaMs = 0;
    this.droppedSimulationTimeLastFrameMs = 0;
    this.droppedSimulationTimeMs = 0;
    this.droppedSimulationTimeThisFrame = false;
    this.peakFrameDeltaMs = 0;
    this.longFramesOver33Ms = 0;
    this.longFramesOver50Ms = 0;
    this.longFramesOver100Ms = 0;
    this.visibilityResyncCount = 0;
    this.heroes.clear();
    this.enemies.clear();
    this.projectiles.clear();

    this.waveStates.clear();
    this.waveRandomStates.clear();
    this.pendingEvents.length = 0;
    const waveRandomStreams = new WaveRandomStreams(
      this.runSeed,
      this.level.id,
    );
    for (const wave of this.level.waves) {
      const spawnCount = wave.spawns.reduce(
        (total, spawn) => total + spawn.count,
        0,
      );
      this.waveStates.set(wave.id, {
        completionEnergyReward: wave.completionEnergyReward,
        remainingToSpawn: spawnCount,
        activeEnemies: 0,
        completed: false,
      });
      this.waveRandomStates.set(wave.id, {
        waveCompositionRng: waveRandomStreams.create(wave.id, 'composition'),
        waveLanePlanner: new LaneSpawnPlanner(
          this.laneGeometry.laneCount,
          waveRandomStreams.create(wave.id, 'lanes'),
        ),
        waveVisualJitterRng: waveRandomStreams.create(wave.id, 'jitter'),
      });
    }
  }

  public addHero(
    instanceId: string,
    heroDefinitionId: string,
    visualPosition: PointDefinition,
    starLevel: HeroStar = MIN_HERO_STAR,
  ): void {
    if (this.heroes.has(instanceId)) {
      throw new Error(`英雄实例 id 重复：${instanceId}`);
    }
    if (
      !Number.isFinite(visualPosition.x) ||
      !Number.isFinite(visualPosition.y)
    ) {
      throw new RangeError('英雄展示位置必须使用有限坐标');
    }
    assertHeroStar(starLevel, '战斗英雄星级');
    const definition = this.heroDefinitions.get(heroDefinitionId);
    if (definition === undefined) {
      throw new Error(`无法加入未知英雄：${heroDefinitionId}`);
    }
    const baseCombatStats = createCombatStats({
      ...definition.combatStats,
      attackPower: definition.attackDamage,
    });
    const combatModifiers: readonly CombatModifier[] = Object.freeze([]);
    const combatStats = aggregateCombatStats(
      baseCombatStats,
      combatModifiers,
    ).stats;
    this.heroes.set(instanceId, {
      id: instanceId,
      definition,
      x: visualPosition.x,
      y: visualPosition.y,
      starLevel,
      baseCombatStats,
      combatModifiers,
      combatStats,
      cooldownMs: 0,
    });
  }

  public update(frameDeltaMs: number): number {
    assertNonNegativeFinite(frameDeltaMs, '帧间隔');
    this.recordFrameDelta(frameDeltaMs);
    this.simulationStepsLastFrame = 0;
    this.droppedSimulationTimeLastFrameMs = 0;
    this.droppedSimulationTimeThisFrame = false;

    if (
      this.frameInputSuspended ||
      this.state !== BattleState.Running ||
      frameDeltaMs === 0
    ) {
      return 0;
    }
    if (this.ignoreNextFrameDelta) {
      this.ignoreNextFrameDelta = false;
      return 0;
    }

    const boundedDeltaMs = Math.min(
      frameDeltaMs,
      this.config.maxFrameDeltaMs,
    );
    const scaledFrameDeltaMs = frameDeltaMs * this.timeScale;
    const acceptedScaledDeltaMs = boundedDeltaMs * this.timeScale;
    this.dropSimulationTime(
      Math.max(0, scaledFrameDeltaMs - acceptedScaledDeltaMs),
    );
    this.accumulatorMs += acceptedScaledDeltaMs;
    const maxAccumulatedTimeMs = this.getMaxAccumulatedTimeMs();
    if (this.accumulatorMs > maxAccumulatedTimeMs) {
      this.dropSimulationTime(
        this.accumulatorMs - maxAccumulatedTimeMs,
      );
      this.accumulatorMs = maxAccumulatedTimeMs;
    }
    let advancedMs = 0;

    while (
      this.accumulatorMs >= this.config.fixedStepMs &&
      this.state === BattleState.Running &&
      this.simulationStepsLastFrame < MAX_SIMULATION_STEPS_PER_FRAME
    ) {
      this.step(this.config.fixedStepMs);
      this.accumulatorMs -= this.config.fixedStepMs;
      advancedMs += this.config.fixedStepMs;
      this.simulationStepsLastFrame += 1;
    }
    if (this.droppedSimulationTimeThisFrame) {
      // 丢弃追赶时间意味着时间线发生了视觉重同步；前后快照必须一起 snap，
      // 否则较小的新 alpha 可能重新显示旧 previous 状态。
      this.synchronizeInterpolationState();
    }
    if (this.state !== BattleState.Running) {
      this.accumulatorMs = 0;
      this.synchronizeInterpolationState();
    }
    return advancedMs;
  }

  public drainEvents(): readonly BattleEvent[] {
    const events = [...this.pendingEvents];
    this.pendingEvents.length = 0;
    return events;
  }

  public getSnapshot(): BattleSnapshot {
    const preparationDurationMs = this.getPreparationDurationMs();
    const currentWaveIndex = this.getCurrentWaveIndex();
    const closestEnemy = this.getClosestEnemyToCore();
    const interpolationAlpha = getInterpolationAlpha(
      this.accumulatorMs,
      this.config.fixedStepMs,
    );
    return {
      state: this.state,
      elapsedMs: this.elapsedMs,
      battleElapsedMs: Math.max(0, this.elapsedMs - preparationDurationMs),
      preparationRemainingMs: Math.max(
        0,
        preparationDurationMs - this.elapsedMs,
      ),
      isPreparing:
        this.state !== BattleState.Ready &&
        this.elapsedMs < preparationDurationMs,
      currentWaveIndex,
      upcomingWave: this.getUpcomingWavePreview(),
      timingStats: {
        firstSpawnTimeMs: this.firstSpawnTimeMs,
        firstCoreArrivalTimeMs: this.firstCoreArrivalTimeMs,
        firstCoreArrivalTraversalMs: this.firstCoreArrivalTraversalMs,
        averageTraversalTimeSeconds:
          this.spawnedEnemyCount === 0
            ? null
            : this.totalSpawnedTraversalSeconds / this.spawnedEnemyCount,
        peakAliveEnemyCount: this.peakAliveEnemyCount,
        closestEnemyTraversalTimeSeconds:
          closestEnemy?.definition.traversalTimeSeconds ?? null,
        closestEnemyEstimatedRemainingSeconds:
          closestEnemy === undefined
            ? null
            : (1 - closestEnemy.pathProgress) *
              closestEnemy.definition.traversalTimeSeconds,
        currentWaveStartTimeMs:
          currentWaveIndex === null
            ? null
            : this.getAbsoluteWaveStartTimeMs(currentWaveIndex),
      },
      frameDiagnostics: {
        maxSimulationStepsPerFrame: MAX_SIMULATION_STEPS_PER_FRAME,
        maxAccumulatedTimeMs: this.getMaxAccumulatedTimeMs(),
        lastFrameDeltaMs: this.lastFrameDeltaMs,
        simulationStepsLastFrame: this.simulationStepsLastFrame,
        interpolationAlpha,
        accumulatorMs: this.accumulatorMs,
        droppedSimulationTimeLastFrameMs:
          this.droppedSimulationTimeLastFrameMs,
        droppedSimulationTimeMs: this.droppedSimulationTimeMs,
        peakFrameDeltaMs: this.peakFrameDeltaMs,
        longFramesOver33Ms: this.longFramesOver33Ms,
        longFramesOver50Ms: this.longFramesOver50Ms,
        longFramesOver100Ms: this.longFramesOver100Ms,
        frameInputSuspended: this.frameInputSuspended,
        visibilityResyncCount: this.visibilityResyncCount,
      },
      timeScale: this.timeScale,
      seed: this.seed,
      coreHealth: this.coreHealth,
      coreMaxHealth: this.level.coreMaxHealth,
      pendingSpawnCount: this.spawnSchedule.length - this.spawnCursor,
      heroes: Array.from(this.heroes.values(), (hero) => ({
        id: hero.id,
        definitionId: hero.definition.id,
        name: hero.definition.name,
        color: hero.definition.color,
        radius: hero.definition.radius,
        starLevel: hero.starLevel,
        x: hero.x,
        y: hero.y,
      })),
      enemies: Array.from(this.enemies.values(), (enemy) => {
        const position = this.getEnemyPosition(enemy);
        const previousPosition = this.laneGeometry.positionAtProgress(
          enemy.previousPathProgress,
          enemy.laneIndex,
          enemy.localJitter,
        );
        const renderPathProgress = interpolateNumber(
          enemy.previousPathProgress,
          enemy.pathProgress,
          interpolationAlpha,
        );
        const renderPosition = this.laneGeometry.positionAtProgress(
          renderPathProgress,
          enemy.laneIndex,
          enemy.localJitter,
        );
        return {
          id: enemy.id,
          definitionId: enemy.definition.id,
          name: enemy.definition.name,
          kind: enemy.definition.kind,
          waveId: enemy.waveId,
          color: enemy.definition.color,
          radius: enemy.definition.radius,
          health: enemy.health,
          maxHealth: enemy.definition.maxHealth,
          armor: enemy.combatStats.armor,
          resistance: enemy.combatStats.resistance,
          traversalTimeSeconds: enemy.definition.traversalTimeSeconds,
          estimatedRemainingSeconds:
            (1 - position.pathProgress) *
            enemy.definition.traversalTimeSeconds,
          previousPathProgress: enemy.previousPathProgress,
          renderPathProgress,
          previousX: previousPosition.x,
          previousY: previousPosition.y,
          renderX: renderPosition.x,
          renderY: renderPosition.y,
          pathProgress: position.pathProgress,
          laneIndex: position.laneIndex,
          laneOffset: position.laneOffset,
          x: position.x,
          y: position.y,
        };
      }),
      projectiles: Array.from(this.projectiles.values(), (projectile) => ({
        id: projectile.id,
        sourceHeroInstanceId: projectile.sourceHeroInstanceId,
        color: projectile.color,
        radius: this.config.projectileRadius,
        previousX: projectile.previousX,
        previousY: projectile.previousY,
        renderX: interpolateNumber(
          projectile.previousX,
          projectile.x,
          interpolationAlpha,
        ),
        renderY: interpolateNumber(
          projectile.previousY,
          projectile.y,
          interpolationAlpha,
        ),
        x: projectile.x,
        y: projectile.y,
      })),
      waves: this.level.waves.map((wave) => {
        const state = this.waveStates.get(wave.id);
        if (state === undefined) throw new Error(`缺少波次运行状态：${wave.id}`);
        return {
          waveId: wave.id,
          remainingToSpawn: state.remainingToSpawn,
          activeEnemies: state.activeEnemies,
          completed: state.completed,
        };
      }),
    };
  }

  private validateConfig(): void {
    assertPositiveFinite(this.config.fixedStepMs, '固定步长');
    assertPositiveFinite(this.config.maxFrameDeltaMs, '最大帧间隔');
    assertPositiveFinite(this.config.projectileRadius, '弹道半径');
    assertPositiveFinite(this.level.coreMaxHealth, '星核生命');
    assertPositiveFinite(this.level.coreRadius, '星核半径');
    assertNonNegativeFinite(
      this.level.initialPreparationSeconds,
      '开局准备时间',
    );
    assertNonNegativeFinite(this.level.wavePreviewSeconds, '波次预告时间');

    if (
      !this.config.supportedTimeScales.includes(
        this.config.defaultTimeScale,
      )
    ) {
      throw new Error('默认倍速必须包含在受支持倍速中');
    }

    for (const definition of this.heroDefinitions.values()) {
      assertPositiveFinite(definition.radius, `${definition.id}.radius`);
      assertPositiveFinite(
        definition.attackDamage,
        `${definition.id}.attackDamage`,
      );
      assertPositiveFinite(
        definition.attackIntervalMs,
        `${definition.id}.attackIntervalMs`,
      );
      if (
        !Number.isFinite(definition.minimumAttackPathProgress) ||
        definition.minimumAttackPathProgress < 0 ||
        definition.minimumAttackPathProgress > 1
      ) {
        throw new RangeError(
          `${definition.id}.minimumAttackPathProgress 必须在 0 到 1 之间`,
        );
      }
      assertPositiveFinite(
        definition.projectileSpeed,
        `${definition.id}.projectileSpeed`,
      );
      getConfiguredDamageType(definition.damageType);
      createCombatStats({
        ...definition.combatStats,
        attackPower: definition.attackDamage,
      });
    }

    for (const definition of this.enemyDefinitions.values()) {
      assertPositiveFinite(definition.radius, `${definition.id}.radius`);
      assertPositiveFinite(
        definition.maxHealth,
        `${definition.id}.maxHealth`,
      );
      assertPositiveFinite(
        definition.traversalTimeSeconds,
        `${definition.id}.traversalTimeSeconds`,
      );
      assertPositiveFinite(
        definition.coreDamage,
        `${definition.id}.coreDamage`,
      );
      if (
        !Number.isSafeInteger(definition.killEnergyReward) ||
        definition.killEnergyReward < 0
      ) {
        throw new RangeError(
          `${definition.id}.killEnergyReward 必须是非负整数`,
        );
      }
      createCombatStats({
        ...definition.combatStats,
        attackPower: 0,
      });
    }
  }

  private buildSpawnSchedule(): readonly SpawnScheduleItem[] {
    const schedule: SpawnScheduleItem[] = [];
    let order = 0;
    let hasGuaranteedBoss = false;
    const waveIds = new Set<string>();

    for (const wave of this.level.waves) {
      if (waveIds.has(wave.id)) {
        throw new Error(`波次 id 重复：${wave.id}`);
      }
      waveIds.add(wave.id);
      assertNonNegativeFinite(wave.startTimeMs, `${wave.id}.startTimeMs`);
      if (
        !Number.isSafeInteger(wave.completionEnergyReward) ||
        wave.completionEnergyReward < 0
      ) {
        throw new RangeError(`${wave.id}.completionEnergyReward 必须是非负整数`);
      }
      if (wave.spawns.length === 0) {
        throw new RangeError(`${wave.id} 至少需要一个生成组`);
      }

      for (const spawn of wave.spawns) {
        if (!Number.isInteger(spawn.count) || spawn.count <= 0) {
          throw new RangeError(`${wave.id}.count 必须是正整数`);
        }
        assertNonNegativeFinite(spawn.intervalMs, `${wave.id}.intervalMs`);
        assertNonNegativeFinite(spawn.startDelayMs, `${wave.id}.startDelayMs`);
        if (spawn.enemyPool.length === 0) {
          throw new RangeError(`${wave.id} 的敌人池不能为空`);
        }
        getEligibleLaneIndices(this.laneGeometry.laneCount, spawn);

        const definitions = spawn.enemyPool.map((enemyId) => {
          const definition = this.enemyDefinitions.get(enemyId);
          if (definition === undefined) {
            throw new Error(`波次引用了未知敌人：${enemyId}`);
          }
          return definition;
        });
        if (definitions.every((definition) => definition.kind === 'boss')) {
          hasGuaranteedBoss = true;
        }

        const formationWidth = this.getFormationWidth(spawn);
        if (
          spawn.spawnFormation === 'line' &&
          spawn.count > formationWidth &&
          spawn.intervalMs === 0
        ) {
          throw new RangeError(
            `${wave.id} 的同通道多排生成间隔必须大于 0`,
          );
        }

        for (let index = 0; index < spawn.count; index += 1) {
          const formationStep =
            spawn.spawnFormation === 'line'
              ? Math.floor(index / formationWidth)
              : index;
          schedule.push({
            atMs:
              this.getPreparationDurationMs() +
              wave.startTimeMs +
              spawn.startDelayMs +
              formationStep * spawn.intervalMs,
            order,
            waveId: wave.id,
            enemyPool: spawn.enemyPool,
            spawn,
            spawnIndex: index,
          });
          order += 1;
        }
      }
    }

    if (!hasGuaranteedBoss) {
      throw new Error('关卡至少需要一个确定生成的 Boss，才能满足胜利条件');
    }

    schedule.sort((left, right) => left.atMs - right.atMs || left.order - right.order);
    return schedule;
  }

  private transitionFrom(
    expectedState: BattleState,
    nextState: BattleState,
  ): boolean {
    if (this.state !== expectedState) {
      return false;
    }
    this.stateMachine.transition(nextState);
    return true;
  }

  private step(stepMs: number): void {
    this.capturePreviousSimulationState();
    this.elapsedMs += stepMs;
    this.spawnEnemiesDue();
    this.updateHeroes(stepMs);
    this.updateProjectiles(stepMs);

    if (this.state === BattleState.Running) {
      this.updateEnemies(stepMs);
    }
  }

  private spawnEnemiesDue(): void {
    while (this.spawnCursor < this.spawnSchedule.length) {
      const scheduledSpawn = this.spawnSchedule[this.spawnCursor];
      if (
        scheduledSpawn === undefined ||
        scheduledSpawn.atMs > this.elapsedMs
      ) {
        return;
      }

      const waveRandomState = this.getWaveRandomState(
        scheduledSpawn.waveId,
      );
      const enemyId = waveRandomState.waveCompositionRng.pick(
        scheduledSpawn.enemyPool,
      );
      const definition = this.enemyDefinitions.get(enemyId);
      if (definition === undefined) {
        throw new Error(`生成时找不到敌人配置：${enemyId}`);
      }

      const runtimeId = `enemy-${this.nextEnemyId}`;
      this.nextEnemyId += 1;
      const baseCombatStats = createCombatStats({
        ...definition.combatStats,
        attackPower: 0,
      });
      const combatModifiers: readonly CombatModifier[] = Object.freeze([]);
      this.enemies.set(runtimeId, {
        id: runtimeId,
        definition,
        waveId: scheduledSpawn.waveId,
        laneIndex: waveRandomState.waveLanePlanner.selectLane({
          spawn: scheduledSpawn.spawn,
          spawnIndex: scheduledSpawn.spawnIndex,
          enemyKind: definition.kind,
        }),
        localJitter:
          (waveRandomState.waveVisualJitterRng.nextFloat() * 2 - 1) *
          this.level.laneLayout.localJitter,
        spawnOrder: scheduledSpawn.order,
        spawnedAtMs: scheduledSpawn.atMs,
        health: definition.maxHealth,
        baseCombatStats,
        combatModifiers,
        combatStats: aggregateCombatStats(
          baseCombatStats,
          combatModifiers,
        ).stats,
        traversalElapsedMs: 0,
        movementRate: 1,
        previousPathProgress: 0,
        pathProgress: 0,
      });
      this.firstSpawnTimeMs ??= scheduledSpawn.atMs;
      this.totalSpawnedTraversalSeconds += definition.traversalTimeSeconds;
      this.spawnedEnemyCount += 1;
      this.peakAliveEnemyCount = Math.max(
        this.peakAliveEnemyCount,
        this.enemies.size,
      );
      const waveState = this.waveStates.get(scheduledSpawn.waveId);
      if (waveState === undefined) {
        throw new Error(`生成时找不到波次状态：${scheduledSpawn.waveId}`);
      }
      waveState.remainingToSpawn -= 1;
      waveState.activeEnemies += 1;
      this.spawnCursor += 1;
    }
  }

  private updateHeroes(stepMs: number): void {
    for (const hero of this.heroes.values()) {
      hero.cooldownMs -= stepMs;
      if (hero.cooldownMs > 0) {
        continue;
      }

      const target = this.findTargetFor(hero);
      if (target === undefined) {
        hero.cooldownMs = 0;
        continue;
      }

      const projectileId = `projectile-${this.nextProjectileId}`;
      const projectileSequence = this.nextProjectileId;
      this.nextProjectileId += 1;
      this.projectiles.set(projectileId, {
        id: projectileId,
        sequence: projectileSequence,
        sourceHeroInstanceId: hero.id,
        sourceHeroDefinitionId: hero.definition.id,
        targetEnemyId: target.id,
        baseAmount: hero.combatStats.attackPower,
        damageType: getConfiguredDamageType(hero.definition.damageType),
        sourceStar: hero.starLevel,
        sourceStats: hero.combatStats,
        speed: hero.definition.projectileSpeed,
        color: hero.definition.projectileColor,
        previousX: hero.x,
        previousY: hero.y,
        x: hero.x,
        y: hero.y,
      });
      this.pendingEvents.push({
        type: 'hero-attacked',
        heroInstanceId: hero.id,
        targetEnemyInstanceId: target.id,
        projectileInstanceId: projectileId,
      });
      hero.cooldownMs += getEffectiveAttackIntervalMs(
        hero.definition.attackIntervalMs,
        hero.combatStats.attackSpeedMultiplier,
      );
    }
  }

  private findTargetFor(hero: RuntimeHero): RuntimeEnemy | undefined {
    let selectedTarget: RuntimeEnemy | undefined;
    let furthestProgress = -1;

    for (const enemy of this.enemies.values()) {
      if (!isEnemyInHeroAttackArea(hero.definition, enemy.pathProgress)) {
        continue;
      }

      if (
        enemy.pathProgress > furthestProgress ||
        (enemy.pathProgress === furthestProgress &&
          this.hasHigherStablePriority(enemy, selectedTarget))
      ) {
        selectedTarget = enemy;
        furthestProgress = enemy.pathProgress;
      }
    }

    return selectedTarget;
  }

  private updateProjectiles(stepMs: number): void {
    const stepSeconds = stepMs / 1_000;

    const projectiles = [...this.projectiles.values()].sort(
      (left, right) => left.sequence - right.sequence,
    );
    for (const projectile of projectiles) {
      const target = this.enemies.get(projectile.targetEnemyId);
      if (target === undefined) {
        this.projectiles.delete(projectile.id);
        continue;
      }
      const source = this.heroes.get(projectile.sourceHeroInstanceId);
      if (source === undefined || target.health <= 0) {
        this.projectiles.delete(projectile.id);
        continue;
      }

      const targetPosition = this.getEnemyPosition(target);
      const deltaX = targetPosition.x - projectile.x;
      const deltaY = targetPosition.y - projectile.y;
      const distance = Math.hypot(deltaX, deltaY);
      const travelDistance = projectile.speed * stepSeconds;

      if (distance <= travelDistance + target.definition.radius) {
        this.projectiles.delete(projectile.id);
        const damage = this.resolveProjectileDamage(projectile, target);
        if (!this.damageApplication.apply(damage, target)) continue;
        this.pendingEvents.push({ type: 'damage-applied', result: damage });
        this.logDamage(damage);
        if (damage.isLethal) {
          this.killEnemy(target);
        }
        continue;
      }

      const ratio = travelDistance / distance;
      projectile.x += deltaX * ratio;
      projectile.y += deltaY * ratio;
    }
  }

  private resolveProjectileDamage(
    projectile: RuntimeProjectile,
    target: RuntimeEnemy,
  ): DamageResult {
    const requestSequence = this.nextDamageRequestId;
    const requestId = `damage-${requestSequence}`;
    this.nextDamageRequestId += 1;
    return resolveDamage(
      {
        requestId,
        requestSequence,
        source: {
          kind: 'hero',
          instanceId: projectile.sourceHeroInstanceId,
          definitionId: projectile.sourceHeroDefinitionId,
        },
        target: {
          kind: 'enemy',
          instanceId: target.id,
          definitionId: target.definition.id,
        },
        baseAmount: projectile.baseAmount,
        damageType: projectile.damageType,
        tags: BASIC_PROJECTILE_DAMAGE_TAGS,
        canCrit: true,
        simulationTimeMs: this.elapsedMs,
        sourceStar: projectile.sourceStar,
        sourceStats: projectile.sourceStats,
        targetStats: target.combatStats,
        targetIsBoss: target.definition.kind === 'boss',
        targetHpBefore: target.health,
      },
      this.combatRng,
    );
  }

  private logDamage(result: DamageResult): void {
    if (!this.combatDebug) return;
    console.info(
      '[Damage]',
      `time=${result.simulationTimeMs}`,
      `source=${result.source.instanceId}`,
      `target=${result.target.instanceId}`,
      `type=${result.damageType}`,
      `base=${result.baseDamage}`,
      `crit=${result.isCritical}`,
      `defense=${result.effectiveDefense}`,
      `reduction=${result.damageReduction}`,
      `final=${result.appliedDamage}`,
      `hp=${result.targetHpBefore}->${result.targetHpAfter}`,
    );
  }

  private killEnemy(enemy: RuntimeEnemy): void {
    this.enemies.delete(enemy.id);
    this.pendingEvents.push({
      type: 'enemy-killed',
      enemyInstanceId: enemy.id,
      enemyDefinitionId: enemy.definition.id,
      enemyKind: enemy.definition.kind,
      energyReward: enemy.definition.killEnergyReward,
    });
    this.recordEnemyRemoved(enemy);
    if (enemy.definition.kind === 'boss') {
      this.stateMachine.transition(BattleState.Victory);
    }
  }

  private updateEnemies(stepMs: number): void {
    for (const enemy of this.enemies.values()) {
      enemy.traversalElapsedMs += stepMs * enemy.movementRate;
      const nextPathProgress = Math.min(
        1,
        enemy.traversalElapsedMs /
          (enemy.definition.traversalTimeSeconds * 1_000),
      );
      if (import.meta.env.DEV) {
        assertMonotonicSimulationProgress(
          enemy.id,
          enemy.pathProgress,
          nextPathProgress,
        );
      }
      enemy.pathProgress = nextPathProgress;
      if (enemy.pathProgress < 1) {
        continue;
      }

      enemy.pathProgress = 1;
      this.enemies.delete(enemy.id);
      this.pendingEvents.push({
        type: 'enemy-reached-core',
        enemyInstanceId: enemy.id,
        enemyDefinitionId: enemy.definition.id,
      });
      this.recordEnemyRemoved(enemy);
      if (this.firstCoreArrivalTimeMs === null) {
        this.firstCoreArrivalTimeMs = this.elapsedMs;
        this.firstCoreArrivalTraversalMs =
          this.elapsedMs - enemy.spawnedAtMs;
      }
      this.coreHealth = Math.max(
        0,
        this.coreHealth - enemy.definition.coreDamage,
      );

      if (this.coreHealth === 0) {
        this.stateMachine.transition(BattleState.Defeat);
        return;
      }
    }
  }

  private recordEnemyRemoved(enemy: RuntimeEnemy): void {
    const waveState = this.waveStates.get(enemy.waveId);
    if (waveState === undefined) {
      throw new Error(`移除敌人时找不到波次状态：${enemy.waveId}`);
    }
    waveState.activeEnemies -= 1;
    if (
      !waveState.completed &&
      waveState.remainingToSpawn === 0 &&
      waveState.activeEnemies === 0
    ) {
      waveState.completed = true;
      this.pendingEvents.push({
        type: 'wave-completed',
        waveId: enemy.waveId,
        energyReward: waveState.completionEnergyReward,
      });
    }
  }

  private getEnemyPosition(enemy: RuntimeEnemy): LanePosition {
    return this.laneGeometry.positionAtProgress(
      enemy.pathProgress,
      enemy.laneIndex,
      enemy.localJitter,
    );
  }

  private capturePreviousSimulationState(): void {
    for (const enemy of this.enemies.values()) {
      enemy.previousPathProgress = enemy.pathProgress;
    }
    for (const projectile of this.projectiles.values()) {
      projectile.previousX = projectile.x;
      projectile.previousY = projectile.y;
    }
  }

  private synchronizeInterpolationState(): void {
    for (const enemy of this.enemies.values()) {
      enemy.previousPathProgress = enemy.pathProgress;
    }
    for (const projectile of this.projectiles.values()) {
      projectile.previousX = projectile.x;
      projectile.previousY = projectile.y;
    }
  }

  private getMaxAccumulatedTimeMs(): number {
    return this.config.fixedStepMs * MAX_SIMULATION_STEPS_PER_FRAME;
  }

  private dropSimulationTime(amountMs: number): void {
    if (amountMs <= 0) return;
    this.droppedSimulationTimeThisFrame = true;
    this.droppedSimulationTimeLastFrameMs += amountMs;
    this.droppedSimulationTimeMs += amountMs;
  }

  private recordFrameDelta(frameDeltaMs: number): void {
    this.lastFrameDeltaMs = frameDeltaMs;
    this.peakFrameDeltaMs = Math.max(this.peakFrameDeltaMs, frameDeltaMs);
    if (frameDeltaMs > 33) this.longFramesOver33Ms += 1;
    if (frameDeltaMs > 50) this.longFramesOver50Ms += 1;
    if (frameDeltaMs > 100) this.longFramesOver100Ms += 1;
  }

  private getPreparationDurationMs(): number {
    return this.level.initialPreparationSeconds * 1_000;
  }

  private getAbsoluteWaveStartTimeMs(waveIndex: number): number {
    const wave = this.level.waves[waveIndex];
    if (wave === undefined) {
      throw new RangeError(`波次索引超出范围：${waveIndex}`);
    }
    return this.getPreparationDurationMs() + wave.startTimeMs;
  }

  private getCurrentWaveIndex(): number | null {
    if (this.state === BattleState.Ready) return null;
    let currentWaveIndex: number | null = null;
    for (let index = 0; index < this.level.waves.length; index += 1) {
      if (this.elapsedMs >= this.getAbsoluteWaveStartTimeMs(index)) {
        currentWaveIndex = index;
      }
    }
    return currentWaveIndex;
  }

  private getUpcomingWavePreview(): WavePreviewSnapshot | null {
    if (
      this.state === BattleState.Ready ||
      this.state === BattleState.Victory ||
      this.state === BattleState.Defeat
    ) {
      return null;
    }
    const previewDurationMs = this.level.wavePreviewSeconds * 1_000;
    for (let index = 0; index < this.level.waves.length; index += 1) {
      const wave = this.level.waves[index];
      if (wave === undefined) continue;
      const startTimeMs = this.getAbsoluteWaveStartTimeMs(index);
      const startsInMs = startTimeMs - this.elapsedMs;
      if (startsInMs <= 0 || startsInMs > previewDurationMs) continue;
      const primaryEnemyNames = Array.from(
        new Set(
          wave.spawns.flatMap((spawn) =>
            spawn.enemyPool.map((enemyId) =>
              this.enemyDefinitions.get(enemyId)?.name ?? enemyId,
            ),
          ),
        ),
      );
      return {
        waveIndex: index,
        waveId: wave.id,
        title: wave.preview.title,
        threat: wave.preview.threat,
        formation: wave.preview.formation,
        primaryEnemyNames,
        startsInMs,
        startTimeMs,
      };
    }
    return null;
  }

  private getClosestEnemyToCore(): RuntimeEnemy | undefined {
    let closest: RuntimeEnemy | undefined;
    for (const enemy of this.enemies.values()) {
      if (
        closest === undefined ||
        enemy.pathProgress > closest.pathProgress ||
        (enemy.pathProgress === closest.pathProgress &&
          this.hasHigherStablePriority(enemy, closest))
      ) {
        closest = enemy;
      }
    }
    return closest;
  }

  private getFormationWidth(
    spawn: LevelDefinition['waves'][number]['spawns'][number],
  ): number {
    if (spawn.spawnFormation !== 'line') return 1;
    if (spawn.laneMode === 'wings' || spawn.laneMode === 'boss-center-wings') {
      return 2;
    }
    return getEligibleLaneIndices(this.laneGeometry.laneCount, spawn).length;
  }

  private getWaveRandomState(waveId: string): RuntimeWaveRandomState {
    const state = this.waveRandomStates.get(waveId);
    if (state === undefined) {
      throw new Error(`找不到波次随机流：${waveId}`);
    }
    return state;
  }

  private hasHigherStablePriority(
    candidate: RuntimeEnemy,
    selected: RuntimeEnemy | undefined,
  ): boolean {
    if (selected === undefined) return true;
    const priority = { normal: 0, heavy: 1, elite: 2, boss: 3 } as const;
    const candidatePriority = priority[candidate.definition.kind];
    const selectedPriority = priority[selected.definition.kind];
    return candidatePriority > selectedPriority ||
      (candidatePriority === selectedPriority &&
        candidate.spawnOrder < selected.spawnOrder);
  }
}

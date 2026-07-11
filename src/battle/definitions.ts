import type { HeroStar } from './HeroStar';
import type { CombatStatsInput } from './combat/CombatStats';
import type { DamageType } from './combat/DamageTypes';

export type BattleTimeScale = 1 | 2;

export type EnemyKind = 'normal' | 'heavy' | 'elite' | 'boss';

export type LaneMode =
  | 'random'
  | 'uniform'
  | 'center-assault'
  | 'wings'
  | 'full-line'
  | 'boss-center-wings';

export type SpawnFormation = 'stream' | 'line';

export type WaveThreat = 'normal' | 'horde' | 'elite' | 'boss';

export type TargetingMode = 'closest-to-core';

export type HeroRole =
  | 'marksman'
  | 'mage'
  | 'support'
  | 'warrior'
  | 'summoner';

export interface PointDefinition {
  readonly x: number;
  readonly y: number;
}

export interface LaneLayoutDefinition {
  /** 标准关卡使用 5；允许关卡在 3～7 条之间配置。 */
  readonly laneCount: number;
  readonly corridorWidthStart: number;
  readonly corridorWidthMiddle: number;
  readonly corridorWidthEnd: number;
  readonly laneSpacing: number;
  readonly localJitter: number;
}

export interface BattleConfig {
  readonly fixedStepMs: number;
  readonly maxFrameDeltaMs: number;
  readonly defaultTimeScale: BattleTimeScale;
  readonly supportedTimeScales: readonly BattleTimeScale[];
  readonly projectileRadius: number;
  readonly energy: EnergyConfig;
  readonly summon: SummonConfig;
}

export interface EnergyConfig {
  readonly initialEnergy: number;
}

export interface SummonCostTier {
  readonly minSuccessfulSummons: number;
  readonly cost: number;
}

export interface SlotUnlockTier {
  readonly successfulSummons: number;
  readonly unlockedSlots: number;
}

export interface SummonConfig {
  readonly heroCopiesPerBag: number;
  readonly initialStarLevel: HeroStar;
  readonly costTiers: readonly SummonCostTier[];
  readonly slotUnlockTiers: readonly SlotUnlockTier[];
}

export interface HeroDefinition {
  readonly id: string;
  readonly name: string;
  readonly role: HeroRole;
  readonly color: number;
  readonly radius: number;
  readonly attackDamage: number;
  /** 基础攻击伤害类型；未配置时由战斗内核安全使用 physical。 */
  readonly damageType?: DamageType;
  /** 静态基础属性覆盖；运行时聚合不得修改该对象。 */
  readonly combatStats?: CombatStatsInput;
  readonly attackIntervalMs: number;
  /** 敌人达到该道路进度后，英雄的普通攻击才可选择该目标。 */
  readonly minimumAttackPathProgress: number;
  readonly projectileSpeed: number;
  readonly projectileColor: number;
  readonly targeting: TargetingMode;
}

export interface EnemyDefinition {
  readonly id: string;
  readonly name: string;
  readonly kind: EnemyKind;
  readonly color: number;
  readonly maxHealth: number;
  /** 静态防御属性覆盖；当前原型未配置时护甲和抗性均为0。 */
  readonly combatStats?: CombatStatsInput;
  /** 1 倍速下从 pathProgress 0 推进到 1 所需的权威秒数。 */
  readonly traversalTimeSeconds: number;
  readonly coreDamage: number;
  readonly killEnergyReward: number;
  readonly radius: number;
}

export interface WavePreviewDefinition {
  readonly title: string;
  readonly threat: WaveThreat;
  readonly formation: string;
}

export interface WaveSpawnDefinition {
  readonly enemyPool: readonly string[];
  readonly count: number;
  readonly intervalMs: number;
  readonly startDelayMs: number;
  readonly laneMode?: LaneMode;
  readonly laneIndices?: readonly number[];
  readonly laneWeights?: readonly number[];
  readonly spawnFormation?: SpawnFormation;
}

export interface WaveDefinition {
  readonly id: string;
  readonly startTimeMs: number;
  readonly completionEnergyReward: number;
  readonly preview: WavePreviewDefinition;
  readonly spawns: readonly WaveSpawnDefinition[];
}

export interface LevelDefinition {
  readonly id: string;
  readonly name: string;
  /** 仅决定背景、环境与音频表现，不参与道路或战斗规则。 */
  readonly themeId?: string;
  readonly defaultSeed: string;
  readonly coreMaxHealth: number;
  readonly coreRadius: number;
  readonly coreColor: number;
  /** 点击开始后、第一波时间轴启动前的准备时长。 */
  readonly initialPreparationSeconds: number;
  /** 每波正式开始前显示预告的时长。 */
  readonly wavePreviewSeconds: number;
  readonly path: readonly PointDefinition[];
  readonly laneLayout: LaneLayoutDefinition;
  readonly heroPool: readonly string[];
  readonly heroSlots: readonly PointDefinition[];
  readonly waves: readonly WaveDefinition[];
}

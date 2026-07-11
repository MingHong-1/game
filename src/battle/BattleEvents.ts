import type { EnemyKind } from './definitions';
import type { DamageResult } from './combat/DamageResult';

export interface DamageAppliedBattleEvent {
  readonly type: 'damage-applied';
  readonly result: DamageResult;
}

export interface EnemyKilledBattleEvent {
  readonly type: 'enemy-killed';
  readonly enemyInstanceId: string;
  readonly enemyDefinitionId: string;
  readonly enemyKind: EnemyKind;
  readonly energyReward: number;
}

export interface WaveCompletedBattleEvent {
  readonly type: 'wave-completed';
  readonly waveId: string;
  readonly energyReward: number;
}

export interface HeroAttackedBattleEvent {
  readonly type: 'hero-attacked';
  readonly heroInstanceId: string;
  readonly targetEnemyInstanceId: string;
  readonly projectileInstanceId: string;
}

export interface EnemyReachedCoreBattleEvent {
  readonly type: 'enemy-reached-core';
  readonly enemyInstanceId: string;
  readonly enemyDefinitionId: string;
}

export type BattleEvent =
  | DamageAppliedBattleEvent
  | EnemyKilledBattleEvent
  | WaveCompletedBattleEvent
  | HeroAttackedBattleEvent
  | EnemyReachedCoreBattleEvent;

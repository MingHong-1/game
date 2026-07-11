import type { BattleEvent } from '../battle/BattleEvents';
import type { DamageTag, DamageType } from '../battle/combat/DamageTypes';
import type { AudioEventId } from '../audio/GameAudioManager';

export type BattlePresentationEvent =
  | {
      readonly type: 'enemy-hit';
      readonly enemyInstanceId: string;
      readonly damageType: DamageType;
      readonly appliedDamage: number;
      readonly isCritical: boolean;
      readonly isLethal: boolean;
      readonly tags: readonly DamageTag[];
      readonly simulationTimeMs: number;
      readonly audioEvent: AudioEventId;
    }
  | {
      readonly type: 'hero-attack';
      readonly heroInstanceId: string;
      readonly projectileInstanceId: string;
      readonly audioEvent: AudioEventId;
    }
  | {
      readonly type: 'enemy-death';
      readonly enemyInstanceId: string;
      readonly audioEvent: AudioEventId;
    }
  | {
      readonly type: 'enemy-reach-core';
      readonly enemyInstanceId: string;
      readonly audioEvent: AudioEventId;
    }
  | {
      readonly type: 'wave-complete';
      readonly waveId: string;
    };

/** 将已结算战斗事件翻译为表现指令；不反向调用战斗逻辑。 */
export class BattlePresentationEventBridge {
  public translate(
    events: readonly BattleEvent[],
  ): readonly BattlePresentationEvent[] {
    return events.map((event): BattlePresentationEvent => {
      if (event.type === 'damage-applied') {
        return {
          type: 'enemy-hit',
          enemyInstanceId: event.result.target.instanceId,
          damageType: event.result.damageType,
          appliedDamage: event.result.appliedDamage,
          isCritical: event.result.isCritical,
          isLethal: event.result.isLethal,
          tags: event.result.tags,
          simulationTimeMs: event.result.simulationTimeMs,
          audioEvent: 'enemy.hit',
        };
      }
      if (event.type === 'hero-attacked') {
        return {
          type: 'hero-attack',
          heroInstanceId: event.heroInstanceId,
          projectileInstanceId: event.projectileInstanceId,
          audioEvent: 'hero.attack',
        };
      }
      if (event.type === 'enemy-killed') {
        return {
          type: 'enemy-death',
          enemyInstanceId: event.enemyInstanceId,
          audioEvent: 'enemy.death',
        };
      }
      if (event.type === 'enemy-reached-core') {
        return {
          type: 'enemy-reach-core',
          enemyInstanceId: event.enemyInstanceId,
          audioEvent: 'core.hit',
        };
      }
      return { type: 'wave-complete', waveId: event.waveId };
    });
  }
}

import type { BattleSessionSnapshot } from '../../battle/BattleSession';
import type {
  EnemyDefinition,
  EnemyKind,
  LevelDefinition,
  WaveThreat,
} from '../../battle/definitions';
import { createCombatStats } from '../../battle/combat/CombatStats';

export interface WaveEnemySummary {
  readonly enemyDefinitionId: string;
  readonly name: string;
  readonly kindLabel: string;
  readonly aliveCount: number;
  readonly configuredCount: number | null;
  readonly armor: number;
  readonly resistance: number;
  readonly traversalTimeSeconds: number;
}

export interface WaveEnemyIntel {
  readonly waveIndex: number;
  readonly title: string;
  readonly threatLabel: string;
  readonly formation: string;
  readonly totalConfigured: number;
  readonly activeEnemies: number;
  readonly remainingToSpawn: number;
  readonly enemies: readonly WaveEnemySummary[];
}

export interface SelectedEnemyIntel {
  readonly enemyInstanceId: string;
  readonly name: string;
  readonly kindLabel: string;
  readonly health: number;
  readonly maxHealth: number;
  readonly armor: number;
  readonly resistance: number;
  readonly traversalTimeSeconds: number;
  readonly boss: boolean;
  readonly recommendation: string | null;
}

export interface EnemyIntelViewModel {
  readonly currentWave: WaveEnemyIntel | null;
  readonly selectedEnemy: SelectedEnemyIntel | null;
}

const KIND_LABELS: Readonly<Record<EnemyKind, string>> = Object.freeze({
  normal: '普通',
  heavy: '重甲',
  elite: '精英',
  boss: 'Boss',
});

const THREAT_LABELS: Readonly<Record<WaveThreat, string>> = Object.freeze({
  normal: '普通波',
  horde: '怪潮',
  elite: '精英波',
  boss: 'Boss波',
});

export function createEnemyIntel(
  snapshot: BattleSessionSnapshot,
  level: LevelDefinition,
  enemyDefinitions: ReadonlyMap<string, EnemyDefinition>,
  selectedEnemyInstanceId: string | null,
): EnemyIntelViewModel {
  return Object.freeze({
    currentWave: createWaveIntel(snapshot, level, enemyDefinitions),
    selectedEnemy: createSelectedEnemyIntel(
      snapshot,
      enemyDefinitions,
      selectedEnemyInstanceId,
    ),
  });
}

function createWaveIntel(
  snapshot: BattleSessionSnapshot,
  level: LevelDefinition,
  enemyDefinitions: ReadonlyMap<string, EnemyDefinition>,
): WaveEnemyIntel | null {
  if (snapshot.currentWaveIndex === null) return null;
  const wave = level.waves[snapshot.currentWaveIndex];
  if (wave === undefined) return null;
  const runtime = snapshot.waves.find((candidate) => candidate.waveId === wave.id);
  const ids = Array.from(
    new Set(wave.spawns.flatMap((spawn) => spawn.enemyPool)),
  );
  const enemies = ids.map((enemyDefinitionId): WaveEnemySummary => {
    const definition = enemyDefinitions.get(enemyDefinitionId);
    if (definition === undefined) {
      throw new Error(`波次情报引用未知敌人：${enemyDefinitionId}`);
    }
    const stats = createCombatStats(definition.combatStats);
    const exactSpawns = wave.spawns.filter(
      (spawn) => spawn.enemyPool.length === 1 && spawn.enemyPool[0] === enemyDefinitionId,
    );
    const hasMixedPool = wave.spawns.some(
      (spawn) => spawn.enemyPool.length > 1 && spawn.enemyPool.includes(enemyDefinitionId),
    );
    return Object.freeze({
      enemyDefinitionId,
      name: definition.name,
      kindLabel: KIND_LABELS[definition.kind],
      aliveCount: snapshot.enemies.filter(
        (enemy) =>
          enemy.waveId === wave.id && enemy.definitionId === enemyDefinitionId,
      ).length,
      configuredCount: hasMixedPool
        ? null
        : exactSpawns.reduce((total, spawn) => total + spawn.count, 0),
      armor: stats.armor,
      resistance: stats.resistance,
      traversalTimeSeconds: definition.traversalTimeSeconds,
    });
  });
  return Object.freeze({
    waveIndex: snapshot.currentWaveIndex,
    title: wave.preview.title,
    threatLabel: THREAT_LABELS[wave.preview.threat],
    formation: wave.preview.formation,
    totalConfigured: wave.spawns.reduce((total, spawn) => total + spawn.count, 0),
    activeEnemies: runtime?.activeEnemies ?? 0,
    remainingToSpawn: runtime?.remainingToSpawn ?? 0,
    enemies: Object.freeze(enemies),
  });
}

function createSelectedEnemyIntel(
  snapshot: BattleSessionSnapshot,
  enemyDefinitions: ReadonlyMap<string, EnemyDefinition>,
  selectedEnemyInstanceId: string | null,
): SelectedEnemyIntel | null {
  if (selectedEnemyInstanceId === null) return null;
  const enemy = snapshot.enemies.find(
    (candidate) => candidate.id === selectedEnemyInstanceId,
  );
  if (enemy === undefined) return null;
  const definition = enemyDefinitions.get(enemy.definitionId);
  if (definition === undefined) return null;
  return Object.freeze({
    enemyInstanceId: enemy.id,
    name: enemy.name,
    kindLabel: KIND_LABELS[enemy.kind],
    health: enemy.health,
    maxHealth: enemy.maxHealth,
    armor: enemy.armor,
    resistance: enemy.resistance,
    traversalTimeSeconds: enemy.traversalTimeSeconds,
    boss: enemy.kind === 'boss',
    recommendation: createRecommendation(definition, enemy.armor, enemy.resistance),
  });
}

function createRecommendation(
  definition: EnemyDefinition,
  armor: number,
  resistance: number,
): string | null {
  if (armor >= 50) return '护甲较高，优先考虑元素伤害或穿甲。';
  if (resistance >= 50) return '抗性较高，优先考虑物理伤害。';
  if (definition.traversalTimeSeconds <= 14) return '推进较快，优先考虑控制或高频输出。';
  if (definition.maxHealth >= 400) return '生命较高，需要持续稳定输出。';
  return null;
}

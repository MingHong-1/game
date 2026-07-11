import type {
  EnemyKind,
  LaneMode,
  WaveSpawnDefinition,
} from './definitions';
import { SeededRandom } from './SeededRandom';

export interface LaneSelectionInput {
  readonly spawn: WaveSpawnDefinition;
  readonly spawnIndex: number;
  readonly enemyKind: EnemyKind;
}

export function getEligibleLaneIndices(
  laneCount: number,
  spawn: WaveSpawnDefinition,
): readonly number[] {
  if (!Number.isSafeInteger(laneCount) || laneCount < 3 || laneCount > 7) {
    throw new RangeError('通道生成器只支持 3～7 条通道');
  }
  const configured = spawn.laneIndices ??
    Array.from({ length: laneCount }, (_, index) => index);
  if (configured.length === 0 || new Set(configured).size !== configured.length) {
    throw new RangeError('通道索引必须非空且不能重复');
  }
  for (const laneIndex of configured) {
    if (
      !Number.isSafeInteger(laneIndex) ||
      laneIndex < 0 ||
      laneIndex >= laneCount
    ) {
      throw new RangeError(`波次通道索引超出范围：${laneIndex}`);
    }
  }
  if (
    spawn.laneWeights !== undefined &&
    spawn.laneWeights.length !== configured.length
  ) {
    throw new RangeError('通道权重数量必须与候选通道数量一致');
  }
  if (spawn.laneWeights !== undefined) {
    let totalWeight = 0;
    for (const weight of spawn.laneWeights) {
      if (!Number.isFinite(weight) || weight < 0) {
        throw new RangeError('通道权重必须是非负有限数字');
      }
      totalWeight += weight;
    }
    if (totalWeight <= 0) throw new RangeError('通道权重总和必须大于 0');
  }
  return configured;
}

export class LaneSpawnPlanner {
  public constructor(
    private readonly laneCount: number,
    private readonly random: SeededRandom,
  ) {
    if (!Number.isSafeInteger(laneCount) || laneCount < 3 || laneCount > 7) {
      throw new RangeError('通道生成器只支持 3～7 条通道');
    }
  }

  public get centerLaneIndex(): number {
    return Math.floor(this.laneCount / 2);
  }

  public getEligibleLaneIndices(spawn: WaveSpawnDefinition): readonly number[] {
    return getEligibleLaneIndices(this.laneCount, spawn);
  }

  public selectLane(input: LaneSelectionInput): number {
    const mode: LaneMode = input.spawn.laneMode ?? 'random';
    const eligible = this.getEligibleLaneIndices(input.spawn);
    if (mode === 'boss-center-wings') {
      return input.enemyKind === 'boss'
        ? this.centerLaneIndex
        : this.selectWing(input.spawnIndex);
    }
    if (mode === 'wings') return this.selectWing(input.spawnIndex);
    if (mode === 'uniform' || mode === 'full-line') {
      return eligible[input.spawnIndex % eligible.length] ?? eligible[0]!;
    }
    if (mode === 'center-assault') {
      if (this.random.nextFloat() < 0.72 && eligible.includes(this.centerLaneIndex)) {
        return this.centerLaneIndex;
      }
      return this.random.pick(eligible);
    }
    return this.pickWeighted(eligible, input.spawn.laneWeights);
  }

  private selectWing(spawnIndex: number): number {
    return spawnIndex % 2 === 0 ? 0 : this.laneCount - 1;
  }

  private pickWeighted(
    lanes: readonly number[],
    weights: readonly number[] | undefined,
  ): number {
    if (weights === undefined) return this.random.pick(lanes);
    let totalWeight = 0;
    for (const weight of weights) {
      if (!Number.isFinite(weight) || weight < 0) {
        throw new RangeError('通道权重必须是非负有限数字');
      }
      totalWeight += weight;
    }
    if (totalWeight <= 0) throw new RangeError('通道权重总和必须大于 0');
    let cursor = this.random.nextFloat() * totalWeight;
    for (let index = 0; index < lanes.length; index += 1) {
      cursor -= weights[index] ?? 0;
      if (cursor < 0) return lanes[index] ?? lanes[0]!;
    }
    return lanes.at(-1) ?? lanes[0]!;
  }
}

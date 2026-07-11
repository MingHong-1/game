import { type RandomSeed, SeededRandom } from './SeededRandom';

export const RUN_RANDOM_STREAM_NAMES = [
  'waveRng',
  'summonRng',
  'combatRng',
  'mergeRng',
  'skillRng',
] as const;

export type RunRandomStreamName = (typeof RUN_RANDOM_STREAM_NAMES)[number];

/**
 * 从单局种子派生彼此隔离的随机流。
 * 每次 create 都返回该流初始状态的新实例，供同种子重演使用。
 */
export class RunRandomStreams {
  public readonly runSeed: string;

  public constructor(seed: RandomSeed) {
    this.runSeed = new SeededRandom(seed).seed;
  }

  public getSeed(streamName: RunRandomStreamName): string {
    return `${this.runSeed}:${streamName}`;
  }

  public create(streamName: RunRandomStreamName): SeededRandom {
    return new SeededRandom(this.getSeed(streamName));
  }
}

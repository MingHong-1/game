import { type RandomSeed, SeededRandom } from './SeededRandom';

export const WAVE_RANDOM_PURPOSES = [
  'composition',
  'lanes',
  'jitter',
] as const;

export type WaveRandomPurpose = (typeof WAVE_RANDOM_PURPOSES)[number];

/** 为每个关卡、波次和用途派生互不推进的确定性随机流。 */
export class WaveRandomStreams {
  public readonly runSeed: string;

  public constructor(
    seed: RandomSeed,
    private readonly levelId: string,
  ) {
    this.runSeed = new SeededRandom(seed).seed;
    if (levelId.trim().length === 0) {
      throw new RangeError('关卡 id 不能为空');
    }
  }

  public getSeed(waveId: string, purpose: WaveRandomPurpose): string {
    if (waveId.trim().length === 0) {
      throw new RangeError('波次 id 不能为空');
    }
    return `${this.runSeed}:level:${this.levelId}:wave:${waveId}:${purpose}`;
  }

  public create(waveId: string, purpose: WaveRandomPurpose): SeededRandom {
    return new SeededRandom(this.getSeed(waveId, purpose));
  }
}

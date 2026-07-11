export type RandomSeed = string | number;

const UINT32_RANGE = 4_294_967_296;

function normalizeSeed(seed: RandomSeed): string {
  if (typeof seed === 'number' && !Number.isFinite(seed)) {
    throw new RangeError('随机种子必须是有限数字或字符串');
  }

  const normalized = String(seed).trim();
  if (normalized.length === 0) {
    throw new RangeError('随机种子不能为空');
  }

  return normalized;
}

function hashSeed(seed: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export class SeededRandom {
  public readonly seed: string;

  private state: number;

  public constructor(seed: RandomSeed) {
    this.seed = normalizeSeed(seed);
    this.state = hashSeed(this.seed);
  }

  public nextFloat(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
  }

  public nextInt(minInclusive: number, maxExclusive: number): number {
    if (
      !Number.isInteger(minInclusive) ||
      !Number.isInteger(maxExclusive) ||
      maxExclusive <= minInclusive
    ) {
      throw new RangeError('随机整数范围必须是有效的左闭右开整数区间');
    }

    return (
      minInclusive +
      Math.floor(this.nextFloat() * (maxExclusive - minInclusive))
    );
  }

  public pick<T>(values: readonly T[]): T {
    if (values.length === 0) {
      throw new RangeError('不能从空集合中随机选择');
    }

    const value = values[this.nextInt(0, values.length)];
    if (value === undefined) {
      throw new Error('随机索引超出集合范围');
    }
    return value;
  }

  public shuffle<T>(values: readonly T[]): T[] {
    const shuffled = [...values];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = this.nextInt(0, index + 1);
      const current = shuffled[index];
      const swapTarget = shuffled[swapIndex];
      if (current === undefined || swapTarget === undefined) {
        throw new Error('洗牌索引超出集合范围');
      }
      shuffled[index] = swapTarget;
      shuffled[swapIndex] = current;
    }

    return shuffled;
  }
}

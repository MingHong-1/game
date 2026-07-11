import { SeededRandom } from './SeededRandom';

export class HeroBag {
  private readonly heroPool: readonly string[];
  private readonly copiesPerHero: number;
  private random: SeededRandom;
  private remainingHeroes: string[] = [];

  public constructor(
    heroPool: readonly string[],
    copiesPerHero: number,
    random: SeededRandom,
  ) {
    if (heroPool.length === 0 || new Set(heroPool).size !== heroPool.length) {
      throw new RangeError('英雄袋需要非空且不重复的英雄池');
    }
    if (!Number.isSafeInteger(copiesPerHero) || copiesPerHero <= 0) {
      throw new RangeError('英雄袋的每英雄份数必须是正整数');
    }
    this.heroPool = heroPool;
    this.copiesPerHero = copiesPerHero;
    this.random = random;
  }

  public get remainingCount(): number {
    return this.remainingHeroes.length;
  }

  public draw(): string {
    if (this.remainingHeroes.length === 0) {
      this.refill();
    }
    const heroId = this.remainingHeroes.shift();
    if (heroId === undefined) {
      throw new Error('英雄袋补充后仍为空');
    }
    return heroId;
  }

  public reset(random: SeededRandom): void {
    this.random = random;
    this.remainingHeroes = [];
  }

  private refill(): void {
    const nextBag: string[] = [];
    for (const heroId of this.heroPool) {
      for (let copy = 0; copy < this.copiesPerHero; copy += 1) {
        nextBag.push(heroId);
      }
    }
    this.remainingHeroes = this.random.shuffle(nextBag);
  }
}

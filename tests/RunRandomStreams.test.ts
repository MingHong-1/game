import { describe, expect, it } from 'vitest';

import { HeroBag } from '../src/battle/HeroBag';
import { RunRandomStreams } from '../src/battle/RunRandomStreams';
import {
  generateRunSeed,
  readSeedFromSearch,
  resolveInitialRunSeed,
  type RunSeedEntropySource,
} from '../src/battle/RunSeed';

class SequentialEntropy implements RunSeedEntropySource {
  private nextWord = 1;

  public getRandomValues<T extends ArrayBufferView<ArrayBuffer>>(values: T): T {
    if (!(values instanceof Uint32Array)) {
      throw new TypeError('测试随机源只支持 Uint32Array');
    }
    for (let index = 0; index < values.length; index += 1) {
      values[index] = this.nextWord;
      this.nextWord += 1;
    }
    return values;
  }
}

const HERO_POOL = ['gale', 'ember', 'stone', 'starlight'] as const;

describe('正式单局随机种子', () => {
  it('URL 显式 seed 优先且相同参数解析为相同种子', () => {
    expect(readSeedFromSearch('?seed=my-seed')).toBe('my-seed');
    expect(resolveInitialRunSeed('?seed=my-seed', () => 'generated')).toBe(
      'my-seed',
    );
    expect(readSeedFromSearch('?seed=%20%20')).toBeNull();
  });

  it('无 URL seed 时每次新随机战斗生成新的 run seed', () => {
    const entropy = new SequentialEntropy();
    const first = generateRunSeed(entropy);
    const second = generateRunSeed(entropy);

    expect(first).not.toBe(second);
    expect(first).toMatch(/^run-(?:[0-9a-f]{8}-){3}[0-9a-f]{8}$/);
  });

  it('不同 run seed 通常产生不同召唤袋顺序', () => {
    const firstStreams = new RunRandomStreams('run-alpha');
    const secondStreams = new RunRandomStreams('run-beta');
    const firstBag = new HeroBag(
      HERO_POOL,
      2,
      firstStreams.create('summonRng'),
    );
    const secondBag = new HeroBag(
      HERO_POOL,
      2,
      secondStreams.create('summonRng'),
    );

    const firstOrder = Array.from({ length: 8 }, () => firstBag.draw());
    const secondOrder = Array.from({ length: 8 }, () => secondBag.draw());
    expect(firstOrder).not.toEqual(secondOrder);
  });

  it('waveRng 与 summonRng 互不推进，并预留独立战斗、合成和技能流', () => {
    const first = new RunRandomStreams('isolated-streams');
    const second = new RunRandomStreams('isolated-streams');

    const consumedSummon = first.create('summonRng');
    Array.from({ length: 20 }, () => consumedSummon.nextFloat());
    const firstWave = first.create('waveRng');
    const secondWave = second.create('waveRng');
    expect(Array.from({ length: 12 }, () => firstWave.nextFloat())).toEqual(
      Array.from({ length: 12 }, () => secondWave.nextFloat()),
    );

    const streamSeeds = [
      'waveRng',
      'summonRng',
      'combatRng',
      'mergeRng',
      'skillRng',
    ] as const;
    expect(new Set(streamSeeds.map((name) => first.getSeed(name))).size).toBe(5);
  });
});

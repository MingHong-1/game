import { describe, expect, it } from 'vitest';

import { SeededRandom } from '../src/battle/SeededRandom';

describe('SeededRandom', () => {
  it('同一种子生成完全相同的序列', () => {
    const first = new SeededRandom('repeatable-seed');
    const second = new SeededRandom('repeatable-seed');

    const firstSequence = Array.from({ length: 12 }, () => first.nextFloat());
    const secondSequence = Array.from({ length: 12 }, () => second.nextFloat());

    expect(firstSequence).toEqual(secondSequence);
  });

  it('通过统一接口完成整数和集合选择', () => {
    const random = new SeededRandom(20260711);
    const integer = random.nextInt(3, 8);
    const selected = random.pick(['alpha', 'beta', 'gamma']);

    expect(integer).toBeGreaterThanOrEqual(3);
    expect(integer).toBeLessThan(8);
    expect(['alpha', 'beta', 'gamma']).toContain(selected);
  });

  it('拒绝空种子和空集合', () => {
    expect(() => new SeededRandom('  ')).toThrow('随机种子不能为空');
    expect(() => new SeededRandom('seed').pick([])).toThrow(
      '不能从空集合中随机选择',
    );
  });
});

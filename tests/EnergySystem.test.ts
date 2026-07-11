import { describe, expect, it } from 'vitest';

import { EnergySystem } from '../src/battle/EnergySystem';

describe('EnergySystem', () => {
  it('使用初始能量并支持无上限奖励累计', () => {
    const energy = new EnergySystem({ initialEnergy: 15 });

    expect(energy.energy).toBe(15);
    expect(energy.spend(5)).toBe(true);
    energy.credit(1);
    energy.credit(2);
    energy.credit(5);
    energy.credit(2);
    energy.credit(1_000_000);

    expect(energy.energy).toBe(1_000_020);
  });

  it('能量不足时拒绝消费且余额不变', () => {
    const energy = new EnergySystem({ initialEnergy: 4 });

    expect(energy.spend(5)).toBe(false);
    expect(energy.energy).toBe(4);
  });
});

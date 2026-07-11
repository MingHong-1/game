import type { EnergyConfig } from './definitions';

function assertEnergyValue(value: number, fieldName: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${fieldName}必须是非负安全整数`);
  }
}

export class EnergySystem {
  private readonly initialEnergy: number;
  private currentEnergy: number;

  public constructor(config: EnergyConfig) {
    assertEnergyValue(config.initialEnergy, '初始能量');
    this.initialEnergy = config.initialEnergy;
    this.currentEnergy = config.initialEnergy;
  }

  public get energy(): number {
    return this.currentEnergy;
  }

  public canSpend(cost: number): boolean {
    assertEnergyValue(cost, '能量费用');
    return this.currentEnergy >= cost;
  }

  public spend(cost: number): boolean {
    if (!this.canSpend(cost)) {
      return false;
    }
    this.currentEnergy -= cost;
    return true;
  }

  public credit(amount: number): void {
    assertEnergyValue(amount, '能量奖励');
    const nextEnergy = this.currentEnergy + amount;
    if (!Number.isSafeInteger(nextEnergy)) {
      throw new RangeError('能量累计超过安全整数范围');
    }
    this.currentEnergy = nextEnergy;
  }

  public reset(): void {
    this.currentEnergy = this.initialEnergy;
  }
}

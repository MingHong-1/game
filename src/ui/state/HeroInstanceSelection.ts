/**
 * 英雄选择只保存稳定的局内实例 ID，不使用 heroId 或格位数组位置推断。
 * 该对象不持有 Phaser 节点，也不改变格位和战斗状态。
 */
export class HeroInstanceSelection {
  private selectedInstanceId: string | null = null;

  public get current(): string | null {
    return this.selectedInstanceId;
  }

  public select(instanceId: string): void {
    assertInstanceId(instanceId);
    this.selectedInstanceId = instanceId;
  }

  public toggle(instanceId: string): void {
    assertInstanceId(instanceId);
    this.selectedInstanceId = this.selectedInstanceId === instanceId
      ? null
      : instanceId;
  }

  public isSelected(instanceId: string | null | undefined): boolean {
    return instanceId !== null && instanceId !== undefined &&
      instanceId === this.selectedInstanceId;
  }

  public reconcile(availableInstanceIds: Iterable<string>): boolean {
    if (this.selectedInstanceId === null) return false;
    for (const instanceId of availableInstanceIds) {
      if (instanceId === this.selectedInstanceId) return false;
    }
    this.selectedInstanceId = null;
    return true;
  }

  public clear(): void {
    this.selectedInstanceId = null;
  }

  public destroy(): void {
    this.clear();
  }
}

function assertInstanceId(instanceId: string): void {
  if (instanceId.trim().length === 0) {
    throw new RangeError('英雄实例 ID 不能为空');
  }
}

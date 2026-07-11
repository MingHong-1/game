interface StableViewEntry<TView> {
  readonly view: TView;
  lastSeenFrame: number;
}

/**
 * 以稳定实例 ID 绑定显示对象。数组顺序、删除和插入都不会改变已有视图身份。
 */
export class StableViewRegistry<TView> {
  private readonly entries = new Map<string, StableViewEntry<TView>>();
  private currentFrame = 0;

  public beginFrame(): void {
    this.currentFrame += 1;
  }

  public getOrCreate(instanceId: string, create: () => TView): TView {
    const existing = this.entries.get(instanceId);
    if (existing !== undefined) {
      existing.lastSeenFrame = this.currentFrame;
      return existing.view;
    }
    const view = create();
    this.entries.set(instanceId, {
      view,
      lastSeenFrame: this.currentFrame,
    });
    return view;
  }

  public sweep(destroy: (view: TView, instanceId: string) => void): void {
    for (const [instanceId, entry] of this.entries) {
      if (entry.lastSeenFrame === this.currentFrame) continue;
      destroy(entry.view, instanceId);
      this.entries.delete(instanceId);
    }
  }

  public clear(destroy: (view: TView, instanceId: string) => void): void {
    for (const [instanceId, entry] of this.entries) {
      destroy(entry.view, instanceId);
    }
    this.entries.clear();
  }

  public get(instanceId: string): TView | undefined {
    return this.entries.get(instanceId)?.view;
  }

  public get size(): number {
    return this.entries.size;
  }
}

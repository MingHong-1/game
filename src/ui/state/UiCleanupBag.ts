export class UiCleanupBag {
  private readonly cleanups = new Map<string, () => void>();
  private destroyed = false;

  public get size(): number {
    return this.cleanups.size;
  }

  public set(key: string, cleanup: () => void): void {
    if (this.destroyed) {
      cleanup();
      return;
    }
    this.clear(key);
    this.cleanups.set(key, cleanup);
  }

  public clear(key: string): void {
    const cleanup = this.cleanups.get(key);
    if (cleanup !== undefined) {
      cleanup();
      this.cleanups.delete(key);
    }
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const cleanup of this.cleanups.values()) cleanup();
    this.cleanups.clear();
  }
}

export class ButtonStateController {
  private enabled = true;
  private destroyed = false;
  private lastTriggerAt = Number.NEGATIVE_INFINITY;

  public constructor(
    private readonly onPress: () => void,
    private readonly repeatGuardMs: number,
  ) {}

  public get isEnabled(): boolean {
    return this.enabled && !this.destroyed;
  }

  public setEnabled(enabled: boolean): void {
    if (!this.destroyed) this.enabled = enabled;
  }

  public trigger(nowMs: number): boolean {
    if (
      !this.isEnabled ||
      nowMs - this.lastTriggerAt < this.repeatGuardMs
    ) {
      return false;
    }
    this.lastTriggerAt = nowMs;
    this.onPress();
    return true;
  }

  public destroy(): void {
    this.destroyed = true;
    this.enabled = false;
  }
}

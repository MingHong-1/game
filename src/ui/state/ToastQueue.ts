import type { UiTone } from '../theme/uiTheme';

export interface ToastMessage {
  readonly text: string;
  readonly tone: UiTone;
  readonly durationMs: number;
}

export class ToastQueue {
  private readonly queue: ToastMessage[] = [];
  private destroyed = false;

  public constructor(private readonly maximumSize: number) {
    if (!Number.isSafeInteger(maximumSize) || maximumSize <= 0) {
      throw new RangeError('提示队列上限必须是正整数');
    }
  }

  public get size(): number {
    return this.queue.length;
  }

  public enqueue(message: ToastMessage): void {
    if (this.destroyed) return;
    const duplicateIndex = this.queue.findIndex(
      (queued) => queued.text === message.text,
    );
    if (duplicateIndex >= 0) this.queue.splice(duplicateIndex, 1);
    this.queue.push(message);
    while (this.queue.length > this.maximumSize) this.queue.shift();
  }

  public dequeue(): ToastMessage | undefined {
    return this.destroyed ? undefined : this.queue.shift();
  }

  public clear(): void {
    this.queue.length = 0;
  }

  public destroy(): void {
    this.destroyed = true;
    this.clear();
  }
}

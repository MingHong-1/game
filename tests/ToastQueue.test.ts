import { describe, expect, it } from 'vitest';

import { ToastQueue } from '../src/ui/state/ToastQueue';

describe('ToastQueue', () => {
  it('队列有固定上限且重复提示复用最新位置', () => {
    const queue = new ToastQueue(3);
    for (const text of ['A', 'B', 'C', 'D', 'C']) {
      queue.enqueue({ text, tone: 'normal', durationMs: 500 });
    }

    expect(queue.size).toBe(3);
    expect(queue.dequeue()?.text).toBe('B');
    expect(queue.dequeue()?.text).toBe('D');
    expect(queue.dequeue()?.text).toBe('C');
  });

  it('销毁后清空队列并忽略新提示', () => {
    const queue = new ToastQueue(2);
    queue.enqueue({ text: 'A', tone: 'normal', durationMs: 500 });
    queue.destroy();
    queue.enqueue({ text: 'B', tone: 'danger', durationMs: 500 });

    expect(queue.size).toBe(0);
    expect(queue.dequeue()).toBeUndefined();
  });
});

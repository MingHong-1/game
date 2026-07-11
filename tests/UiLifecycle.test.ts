import { describe, expect, it, vi } from 'vitest';

import { ButtonStateController } from '../src/ui/state/ButtonStateController';
import { UiCleanupBag } from '../src/ui/state/UiCleanupBag';

describe('UI 生命周期', () => {
  it('禁用按钮不会触发操作，销毁后也不能重新触发', () => {
    const onPress = vi.fn();
    const button = new ButtonStateController(onPress, 180);
    button.setEnabled(false);

    expect(button.trigger(1_000)).toBe(false);
    expect(onPress).not.toHaveBeenCalled();
    button.setEnabled(true);
    expect(button.trigger(1_000)).toBe(true);
    expect(button.trigger(1_100)).toBe(false);
    expect(onPress).toHaveBeenCalledTimes(1);
    button.destroy();
    expect(button.trigger(2_000)).toBe(false);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('相同动画键只保留一个清理项，销毁时清理事件和 Tween', () => {
    const firstCleanup = vi.fn();
    const latestCleanup = vi.fn();
    const eventCleanup = vi.fn();
    const cleanup = new UiCleanupBag();
    cleanup.set('tween', firstCleanup);
    cleanup.set('tween', latestCleanup);
    cleanup.set('event', eventCleanup);

    expect(firstCleanup).toHaveBeenCalledTimes(1);
    expect(cleanup.size).toBe(2);
    cleanup.destroy();
    expect(latestCleanup).toHaveBeenCalledTimes(1);
    expect(eventCleanup).toHaveBeenCalledTimes(1);
    expect(cleanup.size).toBe(0);
  });

  it('同种子重演和新随机战斗入口只会提交一个重开动作', () => {
    const actions: string[] = [];
    let replay!: ButtonStateController;
    let newRandom!: ButtonStateController;
    const finishRestart = (mode: string): void => {
      actions.push(mode);
      replay.destroy();
      newRandom.destroy();
    };
    replay = new ButtonStateController(() => finishRestart('replay'), 180);
    newRandom = new ButtonStateController(
      () => finishRestart('new-random'),
      180,
    );

    expect(replay.trigger(1_000)).toBe(true);
    expect(newRandom.trigger(1_000)).toBe(false);
    expect(actions).toEqual(['replay']);
  });
});

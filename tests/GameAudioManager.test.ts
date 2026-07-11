import { describe, expect, it } from 'vitest';

import type { AssetManifestEntry } from '../src/assets/AssetManifest';
import { AssetRegistry } from '../src/assets/AssetRegistry';
import {
  type AudioPlaybackBackend,
  GameAudioManager,
} from '../src/audio/GameAudioManager';

class FakeAudioBackend implements AudioPlaybackBackend {
  public readonly played: Array<{ key: string; volume: number; loop: boolean }> = [];
  public readonly stopped: string[] = [];
  public pauseCount = 0;
  public resumeCount = 0;
  public stopAllCount = 0;

  public play(key: string, options: { volume: number; loop: boolean }): void {
    this.played.push({ key, ...options });
  }
  public stop(key: string): void { this.stopped.push(key); }
  public stopAll(): void { this.stopAllCount += 1; }
  public pauseAll(): void { this.pauseCount += 1; }
  public resumeAll(): void { this.resumeCount += 1; }
}

function audioEntry(assetId: string, type: 'music' | 'soundEffect'): AssetManifestEntry {
  return {
    assetId,
    assetType: type,
    filePath: `assets/audio/${assetId}.ogg`,
    phaserKey: `audio:${assetId}`,
    enabled: true,
    preloadGroup: 'audio',
    owner: { kind: 'audio', id: assetId },
    required: false,
    fallback: 'silent',
  };
}

function availableAudioRegistry(): AssetRegistry {
  const registry = new AssetRegistry({
    version: 1,
    entries: [audioEntry('music', 'music'), audioEntry('click', 'soundEffect')],
  });
  for (const id of ['music', 'click']) {
    registry.markQueued(id);
    registry.markAvailable(id);
  }
  return registry;
}

describe('GameAudioManager', () => {
  it('无音频资源时安全静默', () => {
    const backend = new FakeAudioBackend();
    const audio = new GameAudioManager(
      new AssetRegistry({ version: 1, entries: [] }),
      backend,
      { 'ui.click': 'missing' },
    );
    expect(audio.playEvent('ui.click')).toBe(false);
    expect(audio.playMusic('missing')).toBe(false);
    expect(backend.played).toEqual([]);
  });

  it('静音阻止播放且音量限制在0～1', () => {
    const backend = new FakeAudioBackend();
    const audio = new GameAudioManager(
      availableAudioRegistry(),
      backend,
      { 'ui.click': 'click' },
      {
        masterVolume: 2,
        musicVolume: -1,
        soundVolume: 0.5,
        ambienceVolume: 0.5,
        muted: true,
      },
    );
    expect(audio.currentSettings).toMatchObject({
      masterVolume: 1,
      musicVolume: 0,
    });
    expect(audio.playEvent('ui.click')).toBe(false);
    expect(backend.played).toEqual([]);
  });

  it('背景音乐不重复叠加，切换时停止旧轨道', () => {
    const backend = new FakeAudioBackend();
    const audio = new GameAudioManager(availableAudioRegistry(), backend);
    expect(audio.playMusic('music')).toBe(true);
    expect(audio.playMusic('music')).toBe(true);
    expect(backend.played).toHaveLength(1);
    audio.reset();
    expect(backend.stopAllCount).toBe(1);
  });

  it('暂停恢复和销毁只影响音频后端，不触发玩法', () => {
    const backend = new FakeAudioBackend();
    const audio = new GameAudioManager(availableAudioRegistry(), backend);
    audio.setPaused(true);
    audio.setPaused(false);
    audio.destroy();
    expect(backend.pauseCount).toBe(1);
    expect(backend.resumeCount).toBe(1);
    expect(backend.stopAllCount).toBe(1);
  });
});

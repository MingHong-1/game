import type Phaser from 'phaser';

import type { AudioPlaybackBackend } from './GameAudioManager';

export class PhaserAudioBackend implements AudioPlaybackBackend {
  private readonly loopSounds = new Map<string, Phaser.Sound.BaseSound>();

  public constructor(private readonly scene: Phaser.Scene) {}

  public play(
    key: string,
    options: { readonly volume: number; readonly loop: boolean },
  ): void {
    if (!options.loop) {
      this.scene.sound.play(key, options);
      return;
    }
    this.stop(key);
    const sound = this.scene.sound.add(key, options);
    sound.play();
    this.loopSounds.set(key, sound);
  }

  public stop(key: string): void {
    const sound = this.loopSounds.get(key);
    if (sound !== undefined) {
      this.scene.tweens.killTweensOf(sound);
      sound.stop();
      sound.destroy();
      this.loopSounds.delete(key);
      return;
    }
    this.scene.sound.stopByKey(key);
  }

  public stopAll(): void {
    for (const key of [...this.loopSounds.keys()]) this.stop(key);
    this.scene.sound.stopAll();
  }

  public pauseAll(): void {
    this.scene.sound.pauseAll();
  }

  public resumeAll(): void {
    this.scene.sound.resumeAll();
  }

  public crossFade(
    fromKey: string,
    toKey: string,
    options: { readonly volume: number; readonly loop: boolean },
    durationMs: number,
  ): void {
    const previous = this.loopSounds.get(fromKey);
    const next = this.scene.sound.add(toKey, { ...options, volume: 0 });
    next.play();
    this.loopSounds.set(toKey, next);
    const nextWithVolume = next as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;
    this.scene.tweens.add({
      targets: nextWithVolume,
      volume: options.volume,
      duration: durationMs,
    });
    if (previous === undefined) return;
    const previousWithVolume = previous as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;
    this.scene.tweens.add({
      targets: previousWithVolume,
      volume: 0,
      duration: durationMs,
      onComplete: () => this.stop(fromKey),
    });
  }
}

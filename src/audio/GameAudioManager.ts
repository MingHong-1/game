import type { AssetRegistry } from '../assets/AssetRegistry';

export type AudioEventId =
  | 'ui.click'
  | 'ui.hover'
  | 'battle.prepare'
  | 'battle.start'
  | 'battle.wavePreview'
  | 'battle.waveStart'
  | 'battle.bossAppear'
  | 'battle.victory'
  | 'battle.defeat'
  | 'summon.success'
  | 'slot.unlock'
  | 'hero.attack'
  | 'hero.cast'
  | 'enemy.hit'
  | 'enemy.death'
  | 'core.hit';

export interface AudioSettings {
  readonly masterVolume: number;
  readonly musicVolume: number;
  readonly soundVolume: number;
  readonly ambienceVolume: number;
  readonly muted: boolean;
}

export interface AudioPlaybackBackend {
  play(
    key: string,
    options: { readonly volume: number; readonly loop: boolean },
  ): void;
  stop(key: string): void;
  stopAll(): void;
  pauseAll(): void;
  resumeAll(): void;
  crossFade?(
    fromKey: string,
    toKey: string,
    options: { readonly volume: number; readonly loop: boolean },
    durationMs: number,
  ): void;
}

export type AudioEventMap = Readonly<Partial<Record<AudioEventId, string>>>;

const DEFAULT_AUDIO_SETTINGS: AudioSettings = Object.freeze({
  masterVolume: 1,
  musicVolume: 0.7,
  soundVolume: 0.85,
  ambienceVolume: 0.55,
  muted: false,
});

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('音量必须是有限数字');
  return Math.min(1, Math.max(0, value));
}

export class GameAudioManager {
  private settings: AudioSettings;
  private activeMusicKey: string | null = null;
  private activeAmbienceKey: string | null = null;

  public constructor(
    private readonly assets: AssetRegistry,
    private readonly backend: AudioPlaybackBackend,
    private readonly eventMap: AudioEventMap = {},
    settings: AudioSettings = DEFAULT_AUDIO_SETTINGS,
  ) {
    this.settings = this.normalizeSettings(settings);
  }

  public get currentSettings(): AudioSettings {
    return this.settings;
  }

  public setSettings(settings: AudioSettings): void {
    this.settings = this.normalizeSettings(settings);
    if (this.settings.muted) this.backend.pauseAll();
    else this.backend.resumeAll();
  }

  public playEvent(eventId: AudioEventId): boolean {
    if (this.settings.muted) return false;
    const key = this.assets.getAvailablePhaserKey(this.eventMap[eventId]);
    if (key === null) return false;
    this.backend.play(key, {
      volume: this.settings.masterVolume * this.settings.soundVolume,
      loop: false,
    });
    return true;
  }

  public playMusic(assetId: string | undefined): boolean {
    return this.playLoop('music', assetId, 350);
  }

  public playAmbience(assetId: string | undefined): boolean {
    return this.playLoop('ambience', assetId, 300);
  }

  public setPaused(paused: boolean): void {
    if (paused) this.backend.pauseAll();
    else if (!this.settings.muted) this.backend.resumeAll();
  }

  public reset(): void {
    this.backend.stopAll();
    this.activeMusicKey = null;
    this.activeAmbienceKey = null;
  }

  public destroy(): void {
    this.reset();
  }

  private playLoop(
    channel: 'music' | 'ambience',
    assetId: string | undefined,
    fadeDurationMs: number,
  ): boolean {
    if (this.settings.muted) return false;
    const key = this.assets.getAvailablePhaserKey(assetId);
    if (key === null) return false;
    const activeKey = channel === 'music'
      ? this.activeMusicKey
      : this.activeAmbienceKey;
    if (activeKey === key) return true;
    const options = {
      volume: this.settings.masterVolume *
        (channel === 'music'
          ? this.settings.musicVolume
          : this.settings.ambienceVolume),
      loop: true,
    } as const;
    if (activeKey !== null && this.backend.crossFade !== undefined) {
      this.backend.crossFade(activeKey, key, options, fadeDurationMs);
    } else {
      if (activeKey !== null) this.backend.stop(activeKey);
      this.backend.play(key, options);
    }
    if (channel === 'music') this.activeMusicKey = key;
    else this.activeAmbienceKey = key;
    return true;
  }

  private normalizeSettings(settings: AudioSettings): AudioSettings {
    return {
      masterVolume: clampVolume(settings.masterVolume),
      musicVolume: clampVolume(settings.musicVolume),
      soundVolume: clampVolume(settings.soundVolume),
      ambienceVolume: clampVolume(settings.ambienceVolume),
      muted: settings.muted,
    };
  }
}

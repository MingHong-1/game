import Phaser from 'phaser';

import { AssetLoader } from '../assets/AssetLoader';
import { GAME_ASSET_REGISTRY } from '../assets/GameAssetRegistry';
import { GAME_HEIGHT, GAME_WIDTH, SceneKey } from '../core/gameConstants';
import {
  ENEMY_VISUAL_DEFINITIONS,
  HERO_VISUAL_DEFINITIONS,
} from '../data/visualDefinitions';
import { registerPhaserAnimations } from '../presentation/PhaserAnimationRegistrar';
import { UI_COLORS, toCssColor } from '../ui/theme/uiTheme';
import { UI_FONT_FAMILY, UI_FONT_SIZES } from '../ui/theme/uiTypography';

const BOOT_DELAY_MS = 300;

export class BootScene extends Phaser.Scene {
  private readonly assetLoader = new AssetLoader(GAME_ASSET_REGISTRY);
  private queuedAssetCount = 0;
  private loadingText: Phaser.GameObjects.Text | undefined;

  public constructor() {
    super(SceneKey.Boot);
  }

  public preload(): void {
    this.cameras.main.setBackgroundColor(toCssColor(UI_COLORS.pageBackground));
    this.loadingText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '检查星核资源…', {
        color: toCssColor(UI_COLORS.textSecondary),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.body}px`,
      })
      .setOrigin(0.5);
    GAME_ASSET_REGISTRY.resetAvailability();
    const queued = this.assetLoader.queueEnabled(this.load);
    this.queuedAssetCount = queued.length;
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => {
      GAME_ASSET_REGISTRY.markAvailableByPhaserKey(key);
    });
    this.load.on(Phaser.Loader.Events.PROGRESS, (progress: number) => {
      this.loadingText?.setText(`加载星核资源 · ${Math.round(progress * 100)}%`);
    });
    this.load.on(
      Phaser.Loader.Events.FILE_LOAD_ERROR,
      (file: { readonly key: string }) => {
        const status = GAME_ASSET_REGISTRY.markFailedByPhaserKey(
          file.key,
          `加载失败：${file.key}`,
        );
        if (import.meta.env.DEV && status !== undefined && !status.entry.required) {
          GAME_ASSET_REGISTRY.reportFailureOnce(status.entry.assetId, (failure) => {
            console.warn('[OptionalAssetLoadFailure]', failure);
          });
        }
      },
    );
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      GAME_ASSET_REGISTRY.markQueuedEntriesAvailable();
    });
  }

  public create(): void {
    this.loadingText?.destroy();
    this.loadingText = undefined;
    this.cameras.main.setBackgroundColor(toCssColor(UI_COLORS.pageBackground));

    this.add.circle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - 36,
      72,
      UI_COLORS.energy,
      0.08,
    );

    this.add
      .star(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 36,
        6,
        22,
        46,
        UI_COLORS.energy,
      )
      .setStrokeStyle(3, UI_COLORS.star, 0.9);

    const requiredFailures = GAME_ASSET_REGISTRY.getRequiredFailures();
    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 46,
        requiredFailures.length > 0
          ? `必需资源加载失败：${requiredFailures.map((status) => status.entry.assetId).join('、')}`
          : this.queuedAssetCount === 0
            ? '程序视觉已就绪'
            : `星核资源已加载 · ${this.queuedAssetCount}`,
        {
        color: toCssColor(UI_COLORS.textSecondary),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.heading}px`,
        align: 'center',
        wordWrap: { width: 800 },
      },
      )
      .setOrigin(0.5);

    if (requiredFailures.length > 0) return;

    registerPhaserAnimations(
      this,
      [
        ...HERO_VISUAL_DEFINITIONS.map((definition) => definition.animations),
        ...ENEMY_VISUAL_DEFINITIONS.map((definition) => definition.animations),
      ],
      GAME_ASSET_REGISTRY,
    );

    // 正式资源按 Manifest 显式启用；任何可选失败都继续使用程序 fallback。
    this.time.delayedCall(BOOT_DELAY_MS, () => {
      this.scene.start(SceneKey.MainMenu);
    });
  }
}

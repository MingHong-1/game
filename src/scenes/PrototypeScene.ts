import Phaser from 'phaser';

import { GAME_ASSET_REGISTRY } from '../assets/GameAssetRegistry';
import { GameAudioManager } from '../audio/GameAudioManager';
import { PhaserAudioBackend } from '../audio/PhaserAudioBackend';
import {
  BattleSession,
  type BattleSessionSnapshot,
} from '../battle/BattleSession';
import { BATTLE_STATE_LABELS, BattleState } from '../battle/BattleState';
import type { BattleTimeScale } from '../battle/definitions';
import { EnemyProgressRegressionMonitor } from '../battle/EnemyProgressRegressionMonitor';
import { generateRunSeed, resolveInitialRunSeed } from '../battle/RunSeed';
import { SceneKey } from '../core/gameConstants';
import { BATTLE_CONFIG } from '../data/battleConfig';
import { GAME_AUDIO_EVENT_MAP } from '../data/audioDefinitions';
import { BATTLE_THEME_REGISTRY } from '../data/battleThemes';
import { ENEMY_DEFINITIONS_BY_ID } from '../data/enemyDefinitions';
import { HERO_DEFINITIONS_BY_ID } from '../data/heroDefinitions';
import { PROTOTYPE_LEVEL } from '../data/levelDefinitions';
import { BattlefieldView } from '../ui/BattlefieldView';
import {
  BattlePresentationEventBridge,
  type BattlePresentationEvent,
} from '../presentation/BattlePresentationEventBridge';
import { BattleNotice } from '../ui/components/BattleNotice';
import { GameButton } from '../ui/components/GameButton';
import { HealthBar } from '../ui/components/HealthBar';
import { HeroSlotView } from '../ui/components/HeroSlotView';
import { Panel } from '../ui/components/Panel';
import { ResourceDisplay } from '../ui/components/ResourceDisplay';
import { deriveBattleUiState } from '../ui/state/BattleUiState';
import { UI_METRICS } from '../ui/theme/uiMetrics';
import {
  UI_COLORS,
  UI_CSS_COLORS,
  toCssColor,
} from '../ui/theme/uiTheme';
import {
  UI_FONT_FAMILY,
  UI_FONT_SIZES,
  UI_MONO_FONT_FAMILY,
} from '../ui/theme/uiTypography';

const DEBUG_REFRESH_MS = 200;

interface PrototypeSceneData {
  readonly seed?: string;
}

function formatBattleTime(elapsedMs: number): string {
  const totalSeconds = elapsedMs / 1_000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1).padStart(4, '0');
  return `${minutes.toString().padStart(2, '0')}:${seconds}`;
}

export class PrototypeScene extends Phaser.Scene {
  private battle!: BattleSession;
  private battlefieldView!: BattlefieldView;
  private topPanel!: Panel;
  private commandPanel!: Panel;
  private coreHealthBar!: HealthBar;
  private energyDisplay!: ResourceDisplay;
  private costDisplay!: ResourceDisplay;
  private progressDisplay!: ResourceDisplay;
  private formationDisplay!: ResourceDisplay;
  private notice!: BattleNotice;
  private summonButton!: GameButton;
  private pauseButton!: GameButton;
  private speedOneButton!: GameButton;
  private speedTwoButton!: GameButton;
  private skillButton!: GameButton;
  private debugToggleButton?: GameButton;
  private readonly heroSlots: HeroSlotView[] = [];
  private readonly persistentButtons: GameButton[] = [];
  private statePanel: Panel | undefined;
  private readonly statePanelButtons: GameButton[] = [];
  private stateBlocker: Phaser.GameObjects.Rectangle | undefined;
  private waveText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private enemyText!: Phaser.GameObjects.Text;
  private summonHintText!: Phaser.GameObjects.Text;
  private debugText?: Phaser.GameObjects.Text;
  private debugVisible = import.meta.env.DEV;
  private debugElapsedMs = 0;
  private previousWaveIndex = -1;
  private previousPreviewWaveId: string | null = null;
  private previousBossVisible = false;
  private previousBattleState: BattleState | undefined;
  private previousExpansionReady = false;
  private renderedOverlayState: BattleState | null = null;
  private requestedSeed: string | undefined;
  private visibilitySuspended = false;
  private windowBlurred = false;
  private readonly enemyProgressMonitor = new EnemyProgressRegressionMonitor();
  private readonly presentationBridge = new BattlePresentationEventBridge();
  private audio!: GameAudioManager;
  private readonly handleVisibilityChange = (): void => {
    this.visibilitySuspended = document.hidden;
    this.applyFrameInputSuspension();
  };
  private readonly handleWindowBlur = (): void => {
    this.windowBlurred = true;
    this.applyFrameInputSuspension();
  };
  private readonly handleWindowFocus = (): void => {
    this.windowBlurred = false;
    this.applyFrameInputSuspension();
  };

  public constructor() {
    super(SceneKey.Prototype);
  }

  public init(data: PrototypeSceneData = {}): void {
    this.requestedSeed = data.seed;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(toCssColor(UI_COLORS.pageBackground));
    this.resetViewReferences();
    this.battle = this.createBattleSession(
      this.requestedSeed ?? resolveInitialRunSeed(window.location.search),
    );
    this.installFrameResyncListeners();

    this.audio = new GameAudioManager(
      GAME_ASSET_REGISTRY,
      new PhaserAudioBackend(this),
      GAME_AUDIO_EVENT_MAP,
    );
    this.startThemeAudio();
    this.battlefieldView = new BattlefieldView(this, PROTOTYPE_LEVEL);
    this.createTopBar();
    this.createCommandDeck();
    this.notice = new BattleNotice(this, 640, 142);
    this.createDebugPanel();

    const snapshot = this.battle.getSnapshot();
    this.enemyProgressMonitor.snap(snapshot);
    this.battlefieldView.update(snapshot);
    this.refreshUi(snapshot, true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroyUi, this);
  }

  public update(_time: number, delta: number): void {
    this.battle.update(delta);
    const presentationEvents = this.presentationBridge.translate(
      this.battle.drainPresentationEvents(),
    );
    const snapshot = this.battle.getSnapshot();
    if (import.meta.env.DEV) this.reportEnemyProgressRegressions(snapshot);
    this.handlePresentationEvents(presentationEvents, snapshot);
    this.battlefieldView.handlePresentationEvents(presentationEvents);
    this.battlefieldView.update(snapshot);
    this.refreshUi(snapshot);
    if (this.debugVisible && this.debugText !== undefined) {
      this.debugElapsedMs += delta;
      if (this.debugElapsedMs >= DEBUG_REFRESH_MS) {
        this.debugElapsedMs = 0;
        this.updateDebugPanel(snapshot);
      }
    }
  }

  private createBattleSession(seed: string): BattleSession {
    return new BattleSession({
      config: BATTLE_CONFIG,
      level: PROTOTYPE_LEVEL,
      heroDefinitions: HERO_DEFINITIONS_BY_ID,
      enemyDefinitions: ENEMY_DEFINITIONS_BY_ID,
      seed,
      combatDebug:
        new URLSearchParams(window.location.search).get('combatDebug') === '1',
    });
  }

  private createTopBar(): void {
    const area = UI_METRICS.layout.topBar;
    this.topPanel = new Panel(this, area.x, area.y, {
      width: area.width,
      height: area.height,
      strong: true,
      alpha: 0.96,
    });
    this.topPanel.container.setDepth(UI_METRICS.depth.hud);
    const coreIcon = this.add
      .star(24, 31, 6, 8, 16, UI_COLORS.energy)
      .setStrokeStyle(2, UI_COLORS.star, 0.9);
    const coreLabel = this.add
      .text(48, 18, '星核生命', {
        color: toCssColor(UI_COLORS.textSecondary),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.caption}px`,
      })
      .setOrigin(0, 0.5);
    this.coreHealthBar = new HealthBar(this, 150, 40, {
      width: 208,
      height: 18,
      showValue: true,
    });
    this.waveText = this.add
      .text(292, 31, '', {
        color: toCssColor(UI_COLORS.textPrimary),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.body}px`,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);
    this.timeText = this.add
      .text(426, 31, '', {
        color: toCssColor(UI_COLORS.textSecondary),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.body}px`,
      })
      .setOrigin(0, 0.5);
    this.enemyText = this.add
      .text(558, 31, '', {
        color: toCssColor(UI_COLORS.textSecondary),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.small}px`,
      })
      .setOrigin(0, 0.5);
    this.topPanel.content.add([
      coreIcon,
      coreLabel,
      this.coreHealthBar.container,
      this.waveText,
      this.timeText,
      this.enemyText,
    ]);

    this.pauseButton = this.addTopButton(770, '开始', 108, () => {
      this.handlePrimaryBattleAction();
    });
    this.speedOneButton = this.addTopButton(862, '1×', 58, () => {
      this.setBattleSpeed(1);
    });
    this.speedTwoButton = this.addTopButton(928, '2×', 58, () => {
      this.setBattleSpeed(2);
    });
    if (import.meta.env.DEV) {
      this.debugToggleButton = this.addTopButton(1_020, '收起调试', 110, () => {
        this.toggleDebugPanel();
      }, 'ghost');
    }
    this.addTopButton(1_165, '返回菜单', 126, () => {
      this.scene.start(SceneKey.MainMenu);
    }, 'ghost');
  }

  private addTopButton(
    x: number,
    label: string,
    width: number,
    onPress: () => void,
    variant: 'secondary' | 'ghost' = 'secondary',
  ): GameButton {
    const button = new GameButton(this, x, 31, {
      label,
      width,
      height: 40,
      fontSize: UI_FONT_SIZES.small,
      variant,
      onPress,
    });
    this.topPanel.content.add(button.container);
    this.persistentButtons.push(button);
    return button;
  }

  private createCommandDeck(): void {
    const area = UI_METRICS.layout.commandDeck;
    this.commandPanel = new Panel(this, area.x, area.y, {
      width: area.width,
      height: area.height,
      strong: true,
      alpha: 0.97,
    });
    this.commandPanel.container.setDepth(UI_METRICS.depth.commandDeck);
    const controls = UI_METRICS.layout.commandDeckContent;
    const deckTitle = this.add
      .text(area.width / 2, 9, '星核指挥台 · 英雄编队', {
        color: toCssColor(UI_COLORS.star),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.small}px`,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);
    this.commandPanel.content.add(deckTitle);

    for (let index = 0; index < PROTOTYPE_LEVEL.heroSlots.length; index += 1) {
      const position = PROTOTYPE_LEVEL.heroSlots[index];
      if (position === undefined) continue;
      const slotView = new HeroSlotView(
        this,
        index,
        position.x - area.x,
        position.y - area.y,
      );
      this.commandPanel.content.add(slotView.container);
      this.heroSlots.push(slotView);
    }

    this.energyDisplay = new ResourceDisplay(this, controls.energyX, controls.resourceY, {
      label: '战斗能量',
      icon: '✦',
      width: 150,
      accentColor: UI_COLORS.energy,
    });
    this.costDisplay = new ResourceDisplay(this, controls.costX, controls.resourceY, {
      label: '召唤费用',
      icon: '◇',
      width: 150,
      accentColor: UI_COLORS.star,
    });
    this.formationDisplay = new ResourceDisplay(this, controls.formationX, controls.resourceY, {
      label: '英雄编制',
      icon: '◆',
      width: 150,
      accentColor: UI_COLORS.primary,
    });
    this.progressDisplay = new ResourceDisplay(this, controls.progressX, controls.resourceY, {
      label: '扩格进度',
      icon: '⬡',
      width: 190,
      accentColor: UI_COLORS.star,
    });
    this.commandPanel.content.add([
      this.energyDisplay.container,
      this.costDisplay.container,
      this.formationDisplay.container,
      this.progressDisplay.container,
    ]);

    this.summonButton = new GameButton(this, controls.summonX, controls.actionY, {
      label: '召唤英雄',
      subtitle: '消耗：5',
      icon: '✦',
      width: 220,
      height: UI_METRICS.button.primaryHeight,
      variant: 'primary',
      keyboardKeyCode: Phaser.Input.Keyboard.KeyCodes.S,
      onPress: () => this.handleSummon(),
    });
    this.skillButton = this.createReservedButton(controls.skillX, '技能预览', () => {
      this.battle.openSkillSelection();
      this.audio.setPaused(true);
      this.refreshUi(this.battle.getSnapshot());
    });
    const mergeButton = this.createReservedButton(controls.mergeX, '合成', () => undefined);
    const rebuildButton = this.createReservedButton(controls.rebuildX, '重构', () => undefined);
    mergeButton.setEnabled(false);
    rebuildButton.setEnabled(false);
    this.commandPanel.content.add([
      this.summonButton.container,
      this.skillButton.container,
      mergeButton.container,
      rebuildButton.container,
    ]);
    this.persistentButtons.push(
      this.summonButton,
      this.skillButton,
      mergeButton,
      rebuildButton,
    );
    this.summonHintText = this.add
      .text(area.width / 2, controls.hintY, '', {
        color: toCssColor(UI_COLORS.textHint),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.small}px`,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);
    this.commandPanel.content.add(this.summonHintText);
  }

  private createReservedButton(
    x: number,
    label: string,
    onPress: () => void,
  ): GameButton {
    return new GameButton(this, x, 101, {
      label,
      subtitle: label === '技能预览' ? '状态占位' : '后续开放',
      width: 144,
      height: 58,
      variant: 'ghost',
      onPress,
    });
  }

  private createDebugPanel(): void {
    if (!import.meta.env.DEV) {
      this.debugVisible = false;
      return;
    }
    this.debugText = this.add
      .text(1_038, 88, '', {
        backgroundColor: UI_CSS_COLORS.debugBackground,
        color: toCssColor(UI_COLORS.textSecondary),
        fontFamily: UI_MONO_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.caption}px`,
        lineSpacing: 3,
        padding: { x: 9, y: 7 },
      })
      .setDepth(UI_METRICS.depth.debug)
      .setVisible(this.debugVisible);
  }

  private handlePrimaryBattleAction(): void {
    if (this.battle.state === BattleState.Ready) this.battle.start();
    else if (this.battle.state === BattleState.Running) this.battle.pause();
    else if (this.battle.state === BattleState.Paused) this.battle.resume();
    this.audio.setPaused(
      this.battle.state === BattleState.Paused ||
        this.battle.state === BattleState.SkillSelection,
    );
    this.refreshUi(this.battle.getSnapshot());
  }

  private handleSummon(): void {
    const before = this.battle.getSnapshot();
    const result = this.battle.attemptSummon();
    const snapshot = this.battle.getSnapshot();
    if (!result.success) {
      this.notice.enqueue({
        text: result.message,
        tone: 'warning',
        durationMs: UI_METRICS.animation.noticeHold,
      });
    } else {
      const hero = HERO_DEFINITIONS_BY_ID.get(result.heroDefinitionId);
      this.notice.enqueue({
        text: `✦ ${hero?.name ?? result.heroDefinitionId} 加入编队`,
        tone: 'success',
        durationMs: UI_METRICS.animation.noticeHold,
      });
      this.heroSlots[result.slot.index]?.flash();
      this.summonButton.pulse();
      this.audio.playEvent('summon.success');
      if (snapshot.unlockedSlots > before.unlockedSlots) {
        this.audio.playEvent('slot.unlock');
        this.notice.enqueue({
          text: `新格位已解锁 · 编制上限 ${snapshot.unlockedSlots}`,
          tone: 'warning',
          durationMs: UI_METRICS.animation.waveNotice,
        });
      }
    }
    this.battlefieldView.update(snapshot);
    this.refreshUi(snapshot);
  }

  private setBattleSpeed(timeScale: BattleTimeScale): void {
    this.battle.setTimeScale(timeScale);
    this.refreshUi(this.battle.getSnapshot());
  }

  private replaySameSeed(): void {
    this.battle.reset();
    this.audio.reset();
    this.startThemeAudio();
    this.resetBattlePresentation();
  }

  private startNewRandomBattle(): void {
    this.audio.reset();
    this.battle = this.createBattleSession(generateRunSeed());
    this.startThemeAudio();
    this.applyFrameInputSuspension();
    this.resetBattlePresentation();
  }

  private installFrameResyncListeners(): void {
    this.visibilitySuspended = document.hidden;
    this.windowBlurred = false;
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('focus', this.handleWindowFocus);
    this.applyFrameInputSuspension();
  }

  private applyFrameInputSuspension(): void {
    this.battle.setFrameInputSuspended(
      this.visibilitySuspended || this.windowBlurred,
    );
    if (import.meta.env.DEV) {
      this.enemyProgressMonitor.snap(this.battle.getSnapshot());
    }
  }

  private resetBattlePresentation(): void {
    this.notice.clear();
    this.battlefieldView.resetFeedback();
    this.previousWaveIndex = -1;
    this.previousPreviewWaveId = null;
    this.previousBossVisible = false;
    this.previousBattleState = undefined;
    this.previousExpansionReady = false;
    this.renderedOverlayState = null;
    const snapshot = this.battle.getSnapshot();
    this.enemyProgressMonitor.reset();
    this.enemyProgressMonitor.snap(snapshot);
    this.battlefieldView.update(snapshot);
    this.refreshUi(snapshot, true);
  }

  private refreshUi(snapshot: BattleSessionSnapshot, force = false): void {
    const uiState = deriveBattleUiState(snapshot);
    this.coreHealthBar.setValue(snapshot.coreHealth, snapshot.coreMaxHealth, !force);
    this.waveText.setText(
      snapshot.state === BattleState.Ready
        ? '战斗阶段 · 尚未开始'
        : snapshot.isPreparing
          ? `准备阶段 · ${Math.ceil(snapshot.preparationRemainingMs / 1_000)} 秒`
          : snapshot.currentWaveIndex === null
            ? '战斗阶段 · 等待敌袭'
            : `战斗阶段 · 第 ${snapshot.currentWaveIndex + 1}/${PROTOTYPE_LEVEL.waves.length} 波`,
    );
    this.timeText.setText(`战斗 ${formatBattleTime(snapshot.battleElapsedMs)}`);
    this.enemyText.setText(
      `敌人 ${snapshot.enemies.length}  ·  待命 ${snapshot.pendingSpawnCount}`,
    );
    this.energyDisplay.setValue(uiState.energy, !force);
    this.costDisplay.setValue(uiState.summonCost, !force);
    this.costDisplay.setInsufficient(snapshot.energy < snapshot.currentSummonCost);
    this.formationDisplay.setValue(
      `${snapshot.heroCount} / ${snapshot.unlockedSlots}`,
      false,
    );
    this.progressDisplay.setValue(uiState.summonProgress, false);

    const remaining =
      snapshot.nextSlotUnlockAt === null
        ? null
        : snapshot.nextSlotUnlockAt - snapshot.successfulSummons;
    for (const slot of snapshot.slots) {
      const view = this.heroSlots[slot.index];
      if (view === undefined) continue;
      view.update(slot, {
        hero:
          slot.occupant === null
            ? undefined
            : HERO_DEFINITIONS_BY_ID.get(slot.occupant.heroDefinitionId),
        isNextLockedSlot: slot.index === snapshot.unlockedSlots,
        summonsUntilUnlock: remaining,
        animate: !force,
      });
    }

    this.summonButton.setEnabled(uiState.summonEnabled);
    this.summonButton.setSelected(uiState.expansionReady);
    this.summonButton.setSubtitle(
      uiState.expansionReady
        ? `消耗：${uiState.summonCost} · 即将扩格`
        : uiState.summonDisabledReason === 'insufficient-energy'
          ? '能量不足'
          : uiState.summonDisabledReason === 'slots-full'
            ? '格位已满'
            : uiState.summonDisabledReason === 'battle-not-running'
              ? '战斗开始后开放'
              : `消耗：${uiState.summonCost}`,
    );
    this.summonHintText
      .setText(this.getSummonHint(uiState.summonDisabledReason, remaining, uiState.expansionReady))
      .setColor(
        toCssColor(
          uiState.summonDisabledReason === 'slots-full' ||
          uiState.summonDisabledReason === 'insufficient-energy'
            ? UI_COLORS.coreWarning
            : UI_COLORS.textSecondary,
        ),
      );
    if (uiState.expansionReady && !this.previousExpansionReady && !force) {
      this.summonButton.pulse();
    }
    this.previousExpansionReady = uiState.expansionReady;

    const canChangeSpeed =
      snapshot.state === BattleState.Ready ||
      snapshot.state === BattleState.Running ||
      snapshot.state === BattleState.Paused;
    this.speedOneButton.setEnabled(canChangeSpeed);
    this.speedTwoButton.setEnabled(canChangeSpeed);
    this.speedOneButton.setSelected(snapshot.timeScale === 1);
    this.speedTwoButton.setSelected(snapshot.timeScale === 2);
    this.skillButton.setEnabled(snapshot.state === BattleState.Running);
    if (snapshot.state === BattleState.Ready) {
      this.pauseButton.setLabel('开始');
      this.pauseButton.setEnabled(true);
      this.pauseButton.setSelected(false);
    } else if (snapshot.state === BattleState.Running) {
      this.pauseButton.setLabel('暂停');
      this.pauseButton.setEnabled(true);
      this.pauseButton.setSelected(false);
    } else if (snapshot.state === BattleState.Paused) {
      this.pauseButton.setLabel('继续');
      this.pauseButton.setEnabled(true);
      this.pauseButton.setSelected(true);
    } else {
      this.pauseButton.setLabel('锁定');
      this.pauseButton.setEnabled(false);
    }

    this.handleSnapshotNotices(snapshot, force);
    if (force || this.renderedOverlayState !== snapshot.state) {
      this.renderedOverlayState = snapshot.state;
      this.renderStateOverlay(snapshot.state);
    }
  }

  private getSummonHint(
    reason: ReturnType<typeof deriveBattleUiState>['summonDisabledReason'],
    remaining: number | null,
    expansionReady: boolean,
  ): string {
    if (reason === 'slots-full') return '请先合成或重构英雄';
    if (reason === 'insufficient-energy') return '能量不足，击败敌人可补充能量';
    if (reason === 'battle-not-running') return '开始战斗后可以召唤英雄';
    if (expansionReady) return '本次召唤将先解锁新格位，再让英雄加入编队';
    return remaining === null
      ? '全部格位已解锁'
      : `再成功召唤 ${remaining} 次解锁新格位`;
  }

  private handleSnapshotNotices(
    snapshot: BattleSessionSnapshot,
    force: boolean,
  ): void {
    if (force) {
      this.previousWaveIndex = snapshot.currentWaveIndex ?? -1;
      this.previousPreviewWaveId = snapshot.upcomingWave?.waveId ?? null;
      this.previousBossVisible = snapshot.enemies.some((enemy) => enemy.kind === 'boss');
      this.previousBattleState = snapshot.state;
      return;
    }
    if (
      snapshot.state === BattleState.Running &&
      snapshot.isPreparing &&
      this.previousBattleState === BattleState.Ready
    ) {
      this.audio.playEvent('battle.prepare');
      this.notice.enqueue({
        text: `准备阶段 · ${PROTOTYPE_LEVEL.initialPreparationSeconds} 秒内可召唤英雄`,
        tone: 'accent',
        durationMs: UI_METRICS.animation.waveNotice,
      });
    }
    const preview = snapshot.upcomingWave;
    if (
      preview !== null &&
      preview.waveId !== this.previousPreviewWaveId
    ) {
      this.audio.playEvent('battle.wavePreview');
      const threatLabel = {
        normal: '常规敌袭',
        horde: '怪潮',
        elite: '精英威胁',
        boss: 'Boss 警报',
      }[preview.threat];
      this.notice.enqueue({
        text: `第 ${preview.waveIndex + 1} 波预告 · ${threatLabel} · ${preview.primaryEnemyNames.slice(0, 2).join(' / ')} · ${preview.formation}`,
        tone: preview.threat === 'boss' ? 'danger' : 'warning',
        durationMs: UI_METRICS.animation.waveNotice,
      });
    }
    const waveIndex = snapshot.currentWaveIndex ?? -1;
    if (waveIndex >= 0 && waveIndex !== this.previousWaveIndex) {
      this.audio.playEvent('battle.waveStart');
      const wave = PROTOTYPE_LEVEL.waves[waveIndex];
      this.notice.enqueue({
        text: waveIndex === PROTOTYPE_LEVEL.waves.length - 1
          ? `最终波 · ${wave?.preview.title ?? '裂隙震荡'}`
          : `第 ${waveIndex + 1} 波 · ${wave?.preview.title ?? '敌袭'}`,
        tone: wave?.preview.threat === 'boss' ? 'danger' : 'accent',
        durationMs: UI_METRICS.animation.waveNotice,
      });
    }
    const bossVisible = snapshot.enemies.some((enemy) => enemy.kind === 'boss');
    if (bossVisible && !this.previousBossVisible) {
      this.audio.playEvent('battle.bossAppear');
      this.notice.enqueue({
        text: '警告 · BOSS 正在接近星核',
        tone: 'danger',
        durationMs: UI_METRICS.animation.waveNotice,
      });
      this.cameras.main.flash(180, 110, 24, 38, false);
    }
    this.previousWaveIndex = waveIndex;
    this.previousPreviewWaveId = preview?.waveId ?? null;
    this.previousBossVisible = bossVisible;
    if (
      snapshot.state !== this.previousBattleState &&
      snapshot.state === BattleState.Victory
    ) {
      this.audio.playEvent('battle.victory');
    } else if (
      snapshot.state !== this.previousBattleState &&
      snapshot.state === BattleState.Defeat
    ) {
      this.audio.playEvent('battle.defeat');
    }
    this.previousBattleState = snapshot.state;
  }

  private handlePresentationEvents(
    events: readonly BattlePresentationEvent[],
    snapshot: BattleSessionSnapshot,
  ): void {
    for (const event of events) {
      if ('audioEvent' in event) this.audio.playEvent(event.audioEvent);
      if (event.type !== 'hero-attack') continue;
      const slotIndex = snapshot.slots.findIndex(
        (slot) => slot.occupant?.instanceId === event.heroInstanceId,
      );
      if (slotIndex >= 0) this.heroSlots[slotIndex]?.playAttack();
    }
  }

  private startThemeAudio(): void {
    const theme = BATTLE_THEME_REGISTRY.get(
      PROTOTYPE_LEVEL.themeId ?? 'mistwood-border',
    );
    this.audio.playMusic(theme.battleMusicAssetId);
    this.audio.playAmbience(theme.ambienceAssetId);
  }

  private renderStateOverlay(state: BattleState): void {
    this.destroyStateOverlay();
    if (state === BattleState.Running) return;
    const content = this.getOverlayContent(state);
    this.stateBlocker = this.add
      .rectangle(640, 285, 1_060, 370, UI_COLORS.pageDeep, 0.48)
      .setInteractive()
      .setDepth(UI_METRICS.depth.overlay - 1);
    this.statePanel = new Panel(
      this,
      content.actions.length >= 3 ? 310 : 380,
      176,
      {
        width: content.actions.length >= 3 ? 660 : 520,
        height: 240,
        tone:
          state === BattleState.Defeat
            ? 'danger'
            : state === BattleState.Victory
              ? 'success'
              : 'accent',
        strong: true,
        alpha: 0.97,
      },
    );
    this.statePanel.container.setDepth(UI_METRICS.depth.overlay);
    const title = this.add
      .text(content.actions.length >= 3 ? 330 : 260, 54, content.title, {
        color: toCssColor(
          state === BattleState.Defeat
            ? UI_COLORS.coreDanger
            : state === BattleState.Victory
              ? UI_COLORS.star
              : UI_COLORS.textPrimary,
        ),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.title}px`,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const description = this.add
      .text(content.actions.length >= 3 ? 330 : 260, 104, content.description, {
        align: 'center',
        color: toCssColor(UI_COLORS.textSecondary),
        fontFamily: UI_FONT_FAMILY,
        fontSize: `${UI_FONT_SIZES.body}px`,
        wordWrap: { width: content.actions.length >= 3 ? 580 : 440 },
      })
      .setOrigin(0.5);
    this.statePanel.content.add([title, description]);
    const panelCenterX = content.actions.length >= 3 ? 330 : 260;
    const gap = content.actions.length >= 3 ? 194 : 204;
    const firstX = panelCenterX - ((content.actions.length - 1) * gap) / 2;
    content.actions.forEach((action, index) => {
      const button = new GameButton(this, firstX + index * gap, 184, {
        label: action.label,
        width: content.actions.length >= 3 ? 178 : 190,
        height: 48,
        variant: index === 0 ? 'primary' : 'ghost',
        onPress: action.action,
      });
      this.statePanel?.content.add(button.container);
      this.statePanelButtons.push(button);
    });
  }

  private getOverlayContent(state: BattleState): {
    readonly title: string;
    readonly description: string;
    readonly actions: readonly {
      readonly label: string;
      readonly action: () => void;
    }[];
  } {
    if (state === BattleState.Ready) {
      return {
        title: '星核防线待命',
        description: '初始能量 15。召集守卫，阻止雾林裂隙中的敌人抵达星核。',
        actions: [
          { label: '开始战斗', action: () => this.handlePrimaryBattleAction() },
        ],
      };
    }
    if (state === BattleState.Paused) {
      return {
        title: '战斗暂停',
        description: '战斗模拟与弹道已停止，界面反馈不会改变真实战斗状态。',
        actions: [
          { label: '继续战斗', action: () => this.handlePrimaryBattleAction() },
        ],
      };
    }
    if (state === BattleState.SkillSelection) {
      return {
        title: '技能入口预留',
        description: '正式技能购买尚未实现，本阶段仅保留原有状态入口。',
        actions: [
          {
            label: '返回战斗',
            action: () => {
              this.battle.closeSkillSelection();
              this.audio.setPaused(false);
              this.refreshUi(this.battle.getSnapshot());
            },
          },
        ],
      };
    }
    if (state === BattleState.Victory) {
      return {
        title: '星核守住了',
        description: '裂隙监军已被击败。本阶段暂不结算正式奖励。',
        actions: [
          { label: '同种子重演', action: () => this.replaySameSeed() },
          { label: '新随机战斗', action: () => this.startNewRandomBattle() },
          {
            label: '返回主菜单',
            action: () => this.scene.start(SceneKey.MainMenu),
          },
        ],
      };
    }
    return {
      title: '星核失守',
      description: '星核生命已归零。调整召唤节奏后再次守望。',
      actions: [
        { label: '同种子重演', action: () => this.replaySameSeed() },
        { label: '新随机战斗', action: () => this.startNewRandomBattle() },
        {
          label: '返回主菜单',
          action: () => this.scene.start(SceneKey.MainMenu),
        },
      ],
    };
  }

  private destroyStateOverlay(): void {
    for (const button of this.statePanelButtons.splice(0)) button.destroy();
    this.statePanel?.destroy();
    this.statePanel = undefined;
    this.stateBlocker?.destroy();
    this.stateBlocker = undefined;
  }

  private toggleDebugPanel(): void {
    this.debugVisible = !this.debugVisible;
    this.debugText?.setVisible(this.debugVisible);
    this.debugToggleButton?.setLabel(this.debugVisible ? '收起调试' : '打开调试');
    if (this.debugVisible) this.updateDebugPanel(this.battle.getSnapshot());
  }

  private updateDebugPanel(snapshot: BattleSessionSnapshot): void {
    const stats = snapshot.timingStats;
    const frame = snapshot.frameDiagnostics;
    const formatOptionalSeconds = (milliseconds: number | null): string =>
      milliseconds === null ? '--' : `${(milliseconds / 1_000).toFixed(2)}s`;
    this.debugText?.setText([
      `DEV · FPS ${Math.round(this.game.loop.actualFps)}`,
      `FRAME   ${frame.lastFrameDeltaMs.toFixed(2)}ms / PEAK ${frame.peakFrameDeltaMs.toFixed(1)}`,
      `STEP    ${frame.simulationStepsLastFrame}/${frame.maxSimulationStepsPerFrame}`,
      `ALPHA   ${frame.interpolationAlpha.toFixed(3)}`,
      `ACCUM   ${frame.accumulatorMs.toFixed(2)}ms`,
      `DROP    ${frame.droppedSimulationTimeMs.toFixed(1)}ms (+${frame.droppedSimulationTimeLastFrameMs.toFixed(1)})`,
      `LONG    >33 ${frame.longFramesOver33Ms}  >50 ${frame.longFramesOver50Ms}  >100 ${frame.longFramesOver100Ms}`,
      `RESYNC  ${frame.visibilityResyncCount} ${frame.frameInputSuspended ? 'SUSPENDED' : 'ACTIVE'}`,
      `TIME    ${formatBattleTime(snapshot.elapsedMs)}`,
      `PREP    ${formatOptionalSeconds(snapshot.preparationRemainingMs)}`,
      `ENEMY   ${snapshot.enemies.length} / PEAK ${stats.peakAliveEnemyCount}`,
      `SHOT    ${snapshot.projectiles.length} / TWEEN ${this.tweens.getTweens().length}`,
      `TRAVEL  ${stats.closestEnemyTraversalTimeSeconds?.toFixed(1) ?? '--'}s`,
      `ETA     ${stats.closestEnemyEstimatedRemainingSeconds?.toFixed(2) ?? '--'}s`,
      `FIRST   ${formatOptionalSeconds(stats.firstCoreArrivalTraversalMs)}`,
      `AVG     ${stats.averageTraversalTimeSeconds?.toFixed(2) ?? '--'}s`,
      `WAVE@   ${formatOptionalSeconds(stats.currentWaveStartTimeMs)}`,
      `ENERGY  ${snapshot.energy}`,
      `SUMMON  ${snapshot.successfulSummons}`,
      `BAG     ${snapshot.bagRemainingCount}`,
      `SEED    ${snapshot.seed}`,
      `STATE   ${BATTLE_STATE_LABELS[snapshot.state]}`,
    ]);
  }

  private reportEnemyProgressRegressions(snapshot: BattleSessionSnapshot): void {
    for (const diagnostic of this.enemyProgressMonitor.observe(snapshot)) {
      console.error('[EnemyProgressRegression]', diagnostic);
    }
  }

  private destroyUi(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('focus', this.handleWindowFocus);
    this.destroyStateOverlay();
    for (const button of this.persistentButtons.splice(0)) button.destroy();
    for (const slot of this.heroSlots.splice(0)) slot.destroy();
    this.coreHealthBar?.destroy();
    this.energyDisplay?.destroy();
    this.costDisplay?.destroy();
    this.progressDisplay?.destroy();
    this.formationDisplay?.destroy();
    this.notice?.destroy();
    this.battlefieldView?.destroy();
    this.audio?.destroy();
    this.topPanel?.destroy();
    this.commandPanel?.destroy();
  }

  private resetViewReferences(): void {
    this.heroSlots.length = 0;
    this.persistentButtons.length = 0;
    this.statePanelButtons.length = 0;
    this.previousWaveIndex = -1;
    this.previousPreviewWaveId = null;
    this.previousBossVisible = false;
    this.previousBattleState = undefined;
    this.previousExpansionReady = false;
    this.renderedOverlayState = null;
    this.debugElapsedMs = 0;
    this.visibilitySuspended = false;
    this.windowBlurred = false;
    this.enemyProgressMonitor.reset();
  }
}

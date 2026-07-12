import Phaser from 'phaser';

import type { EnemyIntelViewModel } from '../viewmodels/EnemyIntelProvider';
import type { DamageStatisticsViewModel } from '../viewmodels/DamageStatisticsViewModel';
import {
  BattleRightDrawerState,
  getAvailableDrawerTabs,
  type BattleRightDrawerTab,
} from '../state/BattleRightDrawerState';
import { UI_METRICS } from '../theme/uiMetrics';
import { UI_COLORS, toCssColor } from '../theme/uiTheme';
import { UI_FONT_FAMILY, UI_FONT_SIZES, UI_MONO_FONT_FAMILY } from '../theme/uiTypography';
import { GameButton } from './GameButton';
import { Panel } from './Panel';

const TAB_LABELS: Readonly<Record<BattleRightDrawerTab, string>> = Object.freeze({
  'enemy-intel': '怪物情报',
  'damage-statistics': '伤害统计',
  'simulation-debug': '模拟调试',
});

export class BattleRightDrawer {
  private readonly state: BattleRightDrawerState;
  private readonly entryButton: GameButton;
  private readonly panel: Panel;
  private readonly tabButtons = new Map<BattleRightDrawerTab, GameButton>();
  private readonly closeButton: GameButton;
  private readonly contentText: Phaser.GameObjects.Text;
  private enemyIntel: EnemyIntelViewModel = { currentWave: null, selectedEnemy: null };
  private damageStatistics: DamageStatisticsViewModel = {
    teamTotalDamage: 0,
    elapsedBattleTimeMs: 0,
    heroes: [],
  };
  private debugLines: readonly string[] = [];
  private lastRenderedContent = '';
  private lastRenderedTab: BattleRightDrawerTab | null = null;

  public constructor(
    scene: Phaser.Scene,
    debugEnabled: boolean,
    private readonly onActiveTabChanged?: (tab: BattleRightDrawerTab | null) => void,
  ) {
    const metrics = UI_METRICS.layout.rightDrawer;
    this.state = new BattleRightDrawerState(debugEnabled);
    this.entryButton = new GameButton(
      scene,
      metrics.collapsedX + metrics.collapsedWidth / 2,
      metrics.collapsedY + metrics.collapsedHeight / 2,
      {
        label: '情报',
        width: metrics.collapsedWidth,
        height: metrics.collapsedHeight,
        fontSize: UI_FONT_SIZES.helper,
        variant: 'tertiary',
        onPress: () => this.toggle('enemy-intel'),
      },
    );
    this.entryButton.container.setDepth(UI_METRICS.depth.overlay);
    this.panel = new Panel(scene, metrics.x, metrics.y, {
      width: metrics.width,
      height: metrics.height,
      strong: true,
      alpha: 0.97,
    });
    this.panel.container.setDepth(UI_METRICS.depth.overlay);
    const blocker = scene.add
      .rectangle(
        metrics.width / 2,
        metrics.height / 2,
        metrics.width,
        metrics.height,
        UI_COLORS.pageDeep,
        0.001,
      )
      .setInteractive();
    this.panel.content.add(blocker);

    const tabs = getAvailableDrawerTabs(debugEnabled);
    const closeWidth = 40;
    const tabGap = UI_METRICS.spacing.micro;
    const availableWidth = metrics.width - metrics.bodyPadding * 2 - closeWidth - tabGap;
    const tabWidth = (availableWidth - tabGap * Math.max(0, tabs.length - 1)) / tabs.length;
    tabs.forEach((tab, index) => {
      const button = new GameButton(
        scene,
        metrics.bodyPadding + tabWidth / 2 + index * (tabWidth + tabGap),
        metrics.tabTop + metrics.tabHeight / 2,
        {
          label: TAB_LABELS[tab],
          width: tabWidth,
          height: metrics.tabHeight,
          fontSize: UI_FONT_SIZES.helper,
          variant: 'tertiary',
          onPress: () => this.toggle(tab),
        },
      );
      this.tabButtons.set(tab, button);
      this.panel.content.add(button.container);
    });
    this.closeButton = new GameButton(
      scene,
      metrics.width - metrics.bodyPadding - closeWidth / 2,
      metrics.tabTop + metrics.tabHeight / 2,
      {
        label: '×',
        width: closeWidth,
        height: metrics.tabHeight,
        variant: 'ghost',
        onPress: () => {
          this.state.close();
          this.renderState();
        },
      },
    );
    this.panel.content.add(this.closeButton.container);
    this.contentText = scene.add
      .text(
        metrics.bodyPadding,
        metrics.bodyTop,
        '',
        {
          color: toCssColor(UI_COLORS.textSecondary),
          fontFamily: UI_FONT_FAMILY,
          fontSize: `${UI_FONT_SIZES.helper}px`,
          lineSpacing: 4,
          wordWrap: { width: metrics.width - metrics.bodyPadding * 2 },
        },
      )
      .setOrigin(0, 0);
    this.panel.content.add(this.contentText);
    this.renderState();
  }

  public get activeTab(): BattleRightDrawerTab | null {
    return this.state.snapshot.activeTab;
  }

  public toggle(tab: BattleRightDrawerTab): void {
    this.state.toggle(tab);
    this.renderState();
  }

  public open(tab: BattleRightDrawerTab): void {
    if (this.state.snapshot.activeTab !== tab) this.state.toggle(tab);
    this.renderState();
  }

  public update(
    enemyIntel: EnemyIntelViewModel,
    statistics: DamageStatisticsViewModel,
    debugLines: readonly string[],
  ): void {
    this.enemyIntel = enemyIntel;
    this.damageStatistics = statistics;
    this.debugLines = debugLines;
    this.renderContent();
  }

  public reset(): void {
    this.state.reset();
    this.enemyIntel = { currentWave: null, selectedEnemy: null };
    this.damageStatistics = { teamTotalDamage: 0, elapsedBattleTimeMs: 0, heroes: [] };
    this.debugLines = [];
    this.renderState();
  }

  public destroy(): void {
    this.entryButton.destroy();
    for (const button of new Set(this.tabButtons.values())) button.destroy();
    this.closeButton.destroy();
    this.tabButtons.clear();
    this.panel.destroy();
  }

  private renderState(): void {
    const snapshot = this.state.snapshot;
    this.entryButton.setVisible(!snapshot.expanded);
    this.panel.container.setVisible(snapshot.expanded);
    for (const [tab, button] of this.tabButtons) {
      button.setSelected(tab === snapshot.activeTab);
    }
    this.renderContent();
    this.onActiveTabChanged?.(snapshot.activeTab);
  }

  private renderContent(): void {
    const active = this.state.snapshot.activeTab;
    if (active === null) return;
    this.contentText.setFontFamily(
      active === 'simulation-debug' ? UI_MONO_FONT_FAMILY : UI_FONT_FAMILY,
    );
    const content = active === 'enemy-intel'
        ? formatEnemyIntel(this.enemyIntel)
        : active === 'damage-statistics'
          ? formatDamageStatistics(this.damageStatistics)
          : this.debugLines.join('\n');
    if (active === this.lastRenderedTab && content === this.lastRenderedContent) return;
    this.lastRenderedTab = active;
    this.lastRenderedContent = content;
    this.contentText.setText(content);
  }
}

function formatEnemyIntel(model: EnemyIntelViewModel): string {
  const selected = model.selectedEnemy;
  if (selected !== null) {
    return [
      `已选中 · ${selected.name}　${selected.kindLabel}`,
      `生命 ${formatNumber(selected.health)} / ${formatNumber(selected.maxHealth)}`,
      `护甲 ${formatNumber(selected.armor)}　抗性 ${formatNumber(selected.resistance)}`,
      `推进类型 ${selected.traversalTimeSeconds.toFixed(0)} 秒抵达`,
      selected.boss ? '标记：Boss' : '',
      selected.recommendation ?? '',
      '',
      '点击其他怪物可切换；目标消失后自动返回波次概览。',
    ].filter(Boolean).join('\n');
  }
  const wave = model.currentWave;
  if (wave === null) return '当前尚无进行中的波次。';
  const enemyLines = wave.enemies.map((enemy) => {
    const total = enemy.configuredCount === null ? '?' : enemy.configuredCount;
    return `${enemy.name} · ${enemy.kindLabel}　存活 ${enemy.aliveCount}/${total}`;
  });
  return [
    `第 ${wave.waveIndex + 1} 波 · ${wave.title}`,
    `${wave.threatLabel}　${wave.formation}`,
    `场上 ${wave.activeEnemies}　待出现 ${wave.remainingToSpawn}`,
    '',
    ...enemyLines,
    '',
    '怪物能力系统尚未接入。',
  ].join('\n');
}

function formatDamageStatistics(model: DamageStatisticsViewModel): string {
  if (model.heroes.length === 0) {
    return '全队总伤害 0\n\n英雄造成伤害后，这里会按英雄汇总本局统计。';
  }
  return [
    `全队总伤害 ${formatNumber(model.teamTotalDamage)}`,
    '',
    ...model.heroes.flatMap((hero) => [
      `${hero.name}${hero.instanceCount > 1 ? ` ×${hero.instanceCount}` : ''}`,
      `总伤 ${formatNumber(hero.totalDamage)}　占比 ${(hero.teamShare * 100).toFixed(1)}%`,
      `普攻 ${formatNumber(hero.basicAttackDamage)}　暴击 ${formatNumber(hero.criticalDamage)}`,
      `命中 ${hero.hitCount}　暴击 ${hero.criticalHits}　DPS ${formatNumber(hero.dps)}`,
      '',
    ]),
  ].join('\n');
}

function formatNumber(value: number): string {
  return value >= 1_000
    ? value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
    : Number.isInteger(value)
      ? String(value)
      : value.toFixed(1);
}

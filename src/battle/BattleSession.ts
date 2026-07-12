import {
  BattleSimulation,
  type BattleSimulationOptions,
  type BattleSnapshot,
} from './BattleSimulation';
import { BattleState } from './BattleState';
import { EnergySystem } from './EnergySystem';
import type {
  BattleConfig,
  BattleTimeScale,
  EnemyDefinition,
  HeroDefinition,
  LevelDefinition,
} from './definitions';
import { type RandomSeed, SeededRandom } from './SeededRandom';
import { RunRandomStreams } from './RunRandomStreams';
import { SlotSystem, type HeroSlotSnapshot } from './SlotSystem';
import {
  SummonSystem,
  type SummonResult,
} from './SummonSystem';
import type { BattleEvent } from './BattleEvents';
import {
  BattleStatisticsTracker,
  type BattleStatisticsSnapshot,
} from './statistics/BattleStatisticsTracker';

export interface BattleSessionSnapshot extends BattleSnapshot {
  readonly energy: number;
  readonly currentSummonCost: number;
  readonly successfulSummons: number;
  readonly heroCount: number;
  readonly unlockedSlots: number;
  readonly maximumSlots: number;
  readonly nextSlotUnlockAt: number | null;
  readonly bagRemainingCount: number;
  readonly canSummonIntoSlot: boolean;
  readonly slots: readonly HeroSlotSnapshot[];
  readonly statistics: BattleStatisticsSnapshot;
}

export interface BattleSessionOptions {
  readonly config: BattleConfig;
  readonly level: LevelDefinition;
  readonly heroDefinitions: ReadonlyMap<string, HeroDefinition>;
  readonly enemyDefinitions: ReadonlyMap<string, EnemyDefinition>;
  readonly heroPool?: readonly string[];
  readonly seed?: RandomSeed;
  readonly combatDebug?: boolean;
}

export class BattleSession {
  private readonly config: BattleConfig;
  private readonly level: LevelDefinition;
  private readonly rootSeed: string;
  private readonly randomStreams: RunRandomStreams;
  private readonly combat: BattleSimulation;
  private readonly energy: EnergySystem;
  private readonly slots: SlotSystem;
  private readonly summoning: SummonSystem;
  private readonly presentationEvents: BattleEvent[] = [];
  private readonly statistics = new BattleStatisticsTracker();

  public constructor(options: BattleSessionOptions) {
    this.config = options.config;
    this.level = options.level;
    this.rootSeed = new SeededRandom(
      options.seed ?? options.level.defaultSeed,
    ).seed;
    this.randomStreams = new RunRandomStreams(this.rootSeed);

    const heroPool = options.heroPool ?? options.level.heroPool;
    this.validateHeroPool(heroPool, options.heroDefinitions);

    this.energy = new EnergySystem(options.config.energy);
    this.slots = new SlotSystem(
      options.level.heroSlots,
      options.config.summon,
    );
    this.summoning = new SummonSystem(
      options.config.summon,
      this.energy,
      this.slots,
      heroPool,
      this.randomStreams.create('summonRng'),
    );

    const combatOptions: BattleSimulationOptions = {
      config: options.config,
      level: options.level,
      heroDefinitions: options.heroDefinitions,
      enemyDefinitions: options.enemyDefinitions,
      seed: this.rootSeed,
      combatDebug: options.combatDebug === true,
    };
    this.combat = new BattleSimulation(combatOptions);
  }

  public get state(): BattleState {
    return this.combat.state;
  }

  public start(): boolean {
    return this.combat.start();
  }

  public pause(): boolean {
    return this.combat.pause();
  }

  public resume(): boolean {
    return this.combat.resume();
  }

  public openSkillSelection(): boolean {
    return this.combat.openSkillSelection();
  }

  public closeSkillSelection(): boolean {
    return this.combat.closeSkillSelection();
  }

  public setTimeScale(timeScale: BattleTimeScale): void {
    this.combat.setTimeScale(timeScale);
  }

  public setFrameInputSuspended(suspended: boolean): void {
    this.combat.setFrameInputSuspended(suspended);
  }

  public update(frameDeltaMs: number): void {
    this.combat.update(frameDeltaMs);
    for (const event of this.combat.drainEvents()) {
      if (event.type === 'damage-applied') {
        this.statistics.recordDamage(event.result);
      }
      this.presentationEvents.push(event);
      if (event.type === 'enemy-killed' || event.type === 'wave-completed') {
        this.energy.credit(event.energyReward);
      }
    }
  }

  public drainPresentationEvents(): readonly BattleEvent[] {
    const events = [...this.presentationEvents];
    this.presentationEvents.length = 0;
    return events;
  }

  public attemptSummon(): SummonResult {
    if (this.state !== BattleState.Running) {
      return {
        success: false,
        reason: 'battle-not-running',
        message: '战斗开始后才能召唤',
        cost: this.summoning.currentCost,
        successfulSummons: this.summoning.successfulSummons,
      };
    }

    const result = this.summoning.attemptSummon();
    if (!result.success) {
      return result;
    }

    this.combat.addHero(
      result.heroInstanceId,
      result.heroDefinitionId,
      result.slot,
      result.starLevel,
    );
    return result;
  }

  public reset(): void {
    this.presentationEvents.length = 0;
    this.statistics.reset();
    this.energy.reset();
    this.slots.reset();
    this.summoning.reset(this.randomStreams.create('summonRng'));
    this.combat.reset(this.rootSeed);
  }

  public getSnapshot(): BattleSessionSnapshot {
    const combatSnapshot = this.combat.getSnapshot();
    return {
      ...combatSnapshot,
      seed: this.rootSeed,
      energy: this.energy.energy,
      currentSummonCost: this.summoning.currentCost,
      successfulSummons: this.summoning.successfulSummons,
      heroCount: this.slots.heroCount,
      unlockedSlots: this.slots.unlockedCount,
      maximumSlots: this.slots.maximumCount,
      nextSlotUnlockAt: this.summoning.nextSlotUnlockAt,
      bagRemainingCount: this.summoning.bagRemainingCount,
      canSummonIntoSlot: this.summoning.canSummonIntoSlot,
      slots: this.slots.getSnapshot(),
      statistics: this.statistics.getSnapshot(combatSnapshot.battleElapsedMs),
    };
  }

  private validateHeroPool(
    heroPool: readonly string[],
    heroDefinitions: ReadonlyMap<string, HeroDefinition>,
  ): void {
    if (heroPool.length !== 4 || new Set(heroPool).size !== 4) {
      throw new RangeError('每局英雄池必须包含 4 名不重复英雄');
    }
    for (const heroId of heroPool) {
      if (!heroDefinitions.has(heroId)) {
        throw new Error(`英雄池引用了未知英雄：${heroId}`);
      }
    }

    const maximumSlots =
      this.config.summon.slotUnlockTiers.at(-1)?.unlockedSlots;
    if (
      maximumSlots === undefined ||
      this.level.heroSlots.length !== maximumSlots
    ) {
      throw new RangeError('关卡英雄格位数量必须等于最大解锁格位数');
    }
  }
}

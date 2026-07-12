import type {
  EnemyVisualDefinition,
  HeroVisualDefinition,
} from '../presentation/VisualDefinitions';
import {
  EnemyVisualRegistry,
  HeroVisualRegistry,
} from '../presentation/VisualDefinitions';
import { HERO_BATTLE_1_STAR_ASSET_IDS } from '../assets/AssetManifest';

export const HERO_VISUAL_DEFINITIONS: readonly HeroVisualDefinition[] =
  Object.freeze([
    createHeroVisual('gale-hunter', 'marksman', 0x55d9ff, 'triangle', {
      battle1StarAssetId: HERO_BATTLE_1_STAR_ASSET_IDS.galeHunter,
      defaultScale: 0.056,
      footAnchor: { x: 0.5, y: 0.86 },
      slotOffset: { x: 0, y: 0 },
    }),
    createHeroVisual('ember-mage', 'mage', 0xff815d, 'octagram', {
      battle1StarAssetId: HERO_BATTLE_1_STAR_ASSET_IDS.emberMage,
      defaultScale: 0.055,
      footAnchor: { x: 0.5, y: 0.88 },
      slotOffset: { x: 0, y: 0 },
    }),
    createHeroVisual('stone-vanguard', 'warrior', 0xd1a66c, 'diamond', {
      battle1StarAssetId: HERO_BATTLE_1_STAR_ASSET_IDS.stoneVanguard,
      defaultScale: 0.053,
      footAnchor: { x: 0.5, y: 0.85 },
      slotOffset: { x: 1, y: 0 },
    }),
    createHeroVisual('starlight-priest', 'support', 0xb998ff, 'star', {
      battle1StarAssetId: HERO_BATTLE_1_STAR_ASSET_IDS.starlightPriest,
      defaultScale: 0.054,
      footAnchor: { x: 0.5, y: 0.88 },
      slotOffset: { x: 1, y: 0 },
    }),
    // 仅为后续资源扩展位，不加入当前战斗英雄池。
    createHeroVisual('forest-summoner', 'summoner', 0x72c98b, 'circle', {
      defaultScale: 0.043,
      footAnchor: { x: 0.5, y: 0.87 },
      slotOffset: { x: 0, y: 0 },
    }),
  ]);

interface HeroVisualOverrides {
  readonly battle1StarAssetId?: string;
  readonly defaultScale: number;
  readonly footAnchor: HeroVisualDefinition['footAnchor'];
  readonly slotOffset: HeroVisualDefinition['slotOffset'];
}

function createHeroVisual(
  heroId: string,
  role: HeroVisualDefinition['role'],
  fallbackColor: number,
  fallbackShape: HeroVisualDefinition['fallbackShape'],
  overrides: HeroVisualOverrides,
): HeroVisualDefinition {
  return {
    heroId,
    role,
    ...(overrides.battle1StarAssetId === undefined
      ? {}
      : { battle1StarAssetId: overrides.battle1StarAssetId }),
    fallbackColor,
    fallbackShape,
    defaultScale: overrides.defaultScale,
    footAnchor: overrides.footAnchor,
    portraitAnchor: { x: 0.5, y: 0.42 },
    slotOffset: overrides.slotOffset,
    defaultFacing: 'right',
    depth: 1,
    showName: true,
    idle: { scaleAmount: 0.025, durationMs: 1_400 },
    statusAttachPoints: Object.freeze({
      head: { x: 0, y: -22 },
      center: { x: 0, y: -8 },
      feet: { x: 0, y: 12 },
    }),
  };
}

export const ENEMY_VISUAL_DEFINITIONS: readonly EnemyVisualDefinition[] =
  Object.freeze([
    createEnemyVisual('void-scout', 0x65d49a, 'circle', 'small', false, false, -27),
    createEnemyVisual('crystal-crawler', 0x6bb7e8, 'circle', 'medium', false, false, -29),
    createEnemyVisual('armored-heavy', 0xd49a5b, 'diamond', 'large', false, false, -34),
    createEnemyVisual('void-elite', 0xf2c35f, 'star', 'large', true, false, -38),
    createEnemyVisual('rift-overseer', 0xff668f, 'hexagon', 'boss', true, true, -49),
  ]);

function createEnemyVisual(
  enemyId: string,
  fallbackColor: number,
  fallbackShape: EnemyVisualDefinition['fallbackShape'],
  bodySize: EnemyVisualDefinition['bodySize'],
  elite: boolean,
  boss: boolean,
  healthBarOffsetY: number,
): EnemyVisualDefinition {
  return {
    enemyId,
    fallbackShape,
    fallbackColor,
    displayScale: 1,
    footAnchor: { x: 0.5, y: 1 },
    healthBarOffsetY,
    bodySize,
    elite,
    boss,
    depth: boss ? 3 : elite ? 2 : 1,
    statusAttachPoints: Object.freeze({
      head: { x: 0, y: healthBarOffsetY + 8 },
      center: { x: 0, y: 0 },
      feet: { x: 0, y: Math.abs(healthBarOffsetY) * 0.45 },
    }),
  };
}

export const HERO_VISUAL_REGISTRY = new HeroVisualRegistry(
  HERO_VISUAL_DEFINITIONS,
);
export const ENEMY_VISUAL_REGISTRY = new EnemyVisualRegistry(
  ENEMY_VISUAL_DEFINITIONS,
);

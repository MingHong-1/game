import {
  type BattleThemeDefinition,
  BattleThemeRegistry,
} from '../presentation/BattleTheme';

export const MISTWOOD_BORDER_THEME = Object.freeze({
  themeId: 'mistwood-border',
  roadVisualStyle: 'mistwood-starstone',
  coreVisualStyle: 'blue-white-star-core',
  ambientEffectStyle: 'soft-mist',
  background: {
    fit: 'cover',
    alignX: 0.5,
    alignY: 0.5,
    depth: 0,
  },
  foregroundDepth: 7,
} satisfies BattleThemeDefinition);

export const BATTLE_THEME_REGISTRY = new BattleThemeRegistry([
  MISTWOOD_BORDER_THEME,
]);

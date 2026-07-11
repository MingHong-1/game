import type { HeroDefinition } from '../battle/definitions';
import { createDefinitionMap } from './definitionRegistry';

export const HERO_DEFINITIONS: readonly HeroDefinition[] = Object.freeze([
  {
    id: 'gale-hunter',
    name: '疾风猎手',
    role: 'marksman',
    color: 0x55d9ff,
    radius: 18,
    attackDamage: 22,
    combatStats: { critChance: 0.1 },
    attackIntervalMs: 360,
    minimumAttackPathProgress: 0.05,
    projectileSpeed: 900,
    projectileColor: 0xcaf7ff,
    targeting: 'closest-to-core',
  },
  {
    id: 'ember-mage',
    name: '余烬法师',
    role: 'mage',
    color: 0xff815d,
    radius: 20,
    attackDamage: 58,
    attackIntervalMs: 880,
    minimumAttackPathProgress: 0.2,
    projectileSpeed: 700,
    projectileColor: 0xffd09d,
    targeting: 'closest-to-core',
  },
  {
    id: 'stone-vanguard',
    name: '岩盾先锋',
    role: 'warrior',
    color: 0xd1a66c,
    radius: 22,
    attackDamage: 40,
    attackIntervalMs: 720,
    minimumAttackPathProgress: 0.7,
    projectileSpeed: 620,
    projectileColor: 0xf3d6ad,
    targeting: 'closest-to-core',
  },
  {
    id: 'starlight-priest',
    name: '星辉祭司',
    role: 'support',
    color: 0xb998ff,
    radius: 19,
    attackDamage: 30,
    attackIntervalMs: 560,
    minimumAttackPathProgress: 0.35,
    projectileSpeed: 820,
    projectileColor: 0xeee2ff,
    targeting: 'closest-to-core',
  },
]);

export const HERO_DEFINITIONS_BY_ID = createDefinitionMap(
  HERO_DEFINITIONS,
  '英雄配置',
);

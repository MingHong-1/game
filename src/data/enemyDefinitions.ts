import type { EnemyDefinition } from '../battle/definitions';
import { createDefinitionMap } from './definitionRegistry';

export const ENEMY_DEFINITIONS: readonly EnemyDefinition[] = Object.freeze([
  {
    id: 'void-scout',
    name: '虚空斥候',
    kind: 'normal',
    color: 0x65d49a,
    maxHealth: 72,
    traversalTimeSeconds: 14,
    coreDamage: 12,
    killEnergyReward: 1,
    radius: 14,
  },
  {
    id: 'crystal-crawler',
    name: '晶簇爬行者',
    kind: 'normal',
    color: 0x6bb7e8,
    maxHealth: 104,
    traversalTimeSeconds: 22,
    coreDamage: 15,
    killEnergyReward: 1,
    radius: 16,
  },
  {
    id: 'armored-heavy',
    name: '重甲卫兵',
    kind: 'heavy',
    color: 0xd49a5b,
    maxHealth: 260,
    traversalTimeSeconds: 30,
    coreDamage: 25,
    killEnergyReward: 2,
    radius: 21,
  },
  {
    id: 'void-elite',
    name: '虚空精英',
    kind: 'elite',
    color: 0xf2c35f,
    maxHealth: 430,
    traversalTimeSeconds: 28,
    coreDamage: 35,
    killEnergyReward: 5,
    radius: 25,
  },
  {
    id: 'rift-overseer',
    name: '裂隙监军',
    kind: 'boss',
    color: 0xff668f,
    maxHealth: 1_150,
    traversalTimeSeconds: 45,
    coreDamage: 100,
    killEnergyReward: 0,
    radius: 36,
  },
]);

export const ENEMY_DEFINITIONS_BY_ID = createDefinitionMap(
  ENEMY_DEFINITIONS,
  '敌人配置',
);

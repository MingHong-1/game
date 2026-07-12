import type { BattleSessionSnapshot } from '../../battle/BattleSession';
import type { HeroDefinition, HeroRole } from '../../battle/definitions';
import { createCombatStats } from '../../battle/combat/CombatStats';
import { getHeroStarDamageMultiplier } from '../../battle/combat/HeroStarCombat';

export interface SelectedHeroInfoViewModel {
  readonly heroInstanceId: string;
  readonly name: string;
  readonly starLevel: number;
  readonly roleLabel: string;
  readonly effectiveBasicAttack: number;
  readonly critChance: number;
  readonly statusSummary: string;
}

const ROLE_LABELS: Readonly<Record<HeroRole, string>> = Object.freeze({
  marksman: '射手',
  mage: '法师',
  support: '辅助',
  warrior: '战士',
  summoner: '召唤',
});

export function createSelectedHeroInfo(
  selectedHeroInstanceId: string | null,
  snapshot: BattleSessionSnapshot,
  heroDefinitions: ReadonlyMap<string, HeroDefinition>,
): SelectedHeroInfoViewModel | null {
  if (selectedHeroInstanceId === null) return null;
  const hero = snapshot.heroes.find(
    (candidate) => candidate.id === selectedHeroInstanceId,
  );
  if (hero === undefined) return null;
  const definition = heroDefinitions.get(hero.definitionId);
  if (definition === undefined) return null;
  const stats = createCombatStats({
    ...definition.combatStats,
    attackPower: definition.attackDamage,
  });
  return Object.freeze({
    heroInstanceId: hero.id,
    name: definition.name,
    starLevel: hero.starLevel,
    roleLabel: ROLE_LABELS[definition.role],
    effectiveBasicAttack:
      stats.attackPower * getHeroStarDamageMultiplier(hero.starLevel),
    critChance: stats.critChance,
    statusSummary: '状态正常',
  });
}

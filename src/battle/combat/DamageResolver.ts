import { assertHeroStar } from '../HeroStar';
import { assertCombatStats } from './CombatStats';
import { resolveDamageMitigation } from './DamageMitigation';
import type { DamageRequest } from './DamageRequest';
import type { DamageResult } from './DamageResult';
import {
  assertDamageTags,
  assertDamageType,
  hasDamageTag,
} from './DamageTypes';
import { getHeroStarDamageMultiplier } from './HeroStarCombat';

export interface RandomFloatSource {
  nextFloat(): number;
}

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) throw new RangeError(`${label}不能为空`);
}

function validateDamageRequest(request: DamageRequest): void {
  assertNonEmpty(request.requestId, 'requestId');
  if (!Number.isSafeInteger(request.requestSequence) || request.requestSequence <= 0) {
    throw new RangeError('requestSequence必须是正安全整数');
  }
  assertNonEmpty(request.source.instanceId, 'sourceInstanceId');
  assertNonEmpty(request.source.definitionId, 'sourceDefinitionId');
  assertNonEmpty(request.target.instanceId, 'targetInstanceId');
  assertNonEmpty(request.target.definitionId, 'targetDefinitionId');
  if (!Number.isFinite(request.baseAmount) || request.baseAmount < 0) {
    throw new RangeError('baseAmount必须是非负有限数字');
  }
  if (!Number.isFinite(request.simulationTimeMs) || request.simulationTimeMs < 0) {
    throw new RangeError('simulationTime必须是非负有限数字');
  }
  if (!Number.isFinite(request.targetHpBefore) || request.targetHpBefore <= 0) {
    throw new RangeError('已死亡或非法目标不能结算伤害');
  }
  if (typeof request.canCrit !== 'boolean' || typeof request.targetIsBoss !== 'boolean') {
    throw new TypeError('伤害请求布尔字段无效');
  }
  assertDamageType(request.damageType);
  assertDamageTags(request.tags);
  assertHeroStar(request.sourceStar);
  assertCombatStats(request.sourceStats);
  assertCombatStats(request.targetStats);
}

function canRequestCriticallyHit(request: DamageRequest): boolean {
  if (!request.canCrit || request.sourceStats.critChance === 0) return false;
  if (hasDamageTag(request.tags, 'dot')) return false;
  if (request.damageType === 'true' && request.allowTrueDamageCritical !== true) {
    return false;
  }
  return true;
}

export function resolveDamage(
  request: DamageRequest,
  random: RandomFloatSource,
): DamageResult {
  // 所有输入校验必须发生在首次随机消费之前。
  validateDamageRequest(request);

  const starDamageMultiplier = getHeroStarDamageMultiplier(
    request.sourceStar,
  );
  let damageBeforeCritical =
    request.baseAmount *
    starDamageMultiplier *
    request.sourceStats.outgoingDamageMultiplier;
  if (hasDamageTag(request.tags, 'skill')) {
    damageBeforeCritical *= request.sourceStats.skillDamageMultiplier;
  }
  if (hasDamageTag(request.tags, 'summon')) {
    damageBeforeCritical *= request.sourceStats.summonDamageMultiplier;
  }
  if (request.targetIsBoss) {
    damageBeforeCritical *= request.sourceStats.bossDamageMultiplier;
  }

  const eligibleForCritical = canRequestCriticallyHit(request);
  const isCritical = eligibleForCritical
    ? random.nextFloat() < request.sourceStats.critChance
    : false;
  const criticalMultiplier = isCritical
    ? request.sourceStats.critDamageMultiplier
    : 1;
  const damageAfterCritical = damageBeforeCritical * criticalMultiplier;
  const mitigation = resolveDamageMitigation(
    request.damageType,
    request.sourceStats,
    request.targetStats,
  );
  const mitigatedDamage =
    damageAfterCritical * (1 - mitigation.damageReduction);
  const calculatedDamage =
    mitigatedDamage * request.targetStats.damageTakenMultiplier;
  const appliedDamage = Math.min(calculatedDamage, request.targetHpBefore);
  const overkillDamage = Math.max(0, calculatedDamage - appliedDamage);
  const targetHpAfter = Math.max(0, request.targetHpBefore - appliedDamage);

  return Object.freeze({
    requestId: request.requestId,
    requestSequence: request.requestSequence,
    source: request.source,
    target: request.target,
    damageType: request.damageType,
    tags: Object.freeze([...request.tags]),
    simulationTimeMs: request.simulationTimeMs,
    baseDamage: request.baseAmount,
    starDamageMultiplier,
    damageBeforeCritical,
    isCritical,
    criticalMultiplier,
    damageAfterCritical,
    ...mitigation,
    mitigatedDamage,
    damageTakenMultiplier: request.targetStats.damageTakenMultiplier,
    calculatedDamage,
    appliedDamage,
    overkillDamage,
    targetHpBefore: request.targetHpBefore,
    targetHpAfter,
    isLethal: targetHpAfter === 0,
  });
}

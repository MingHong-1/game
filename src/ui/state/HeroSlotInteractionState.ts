import type { UiRect } from '../layout/BottomCommandLayout';
import { UI_METRICS } from '../theme/uiMetrics';
import { UI_COLORS } from '../theme/uiTheme';

export type HeroSlotInteractionState =
  | 'normal'
  | 'hovered'
  | 'selected'
  | 'dragging'
  | 'mergeEligible'
  | 'mergeHovered'
  | 'mergeInvalid'
  | 'maximumStar'
  | 'locked'
  | 'disabled';

export interface HeroSlotInteractionStyle {
  readonly borderColor: number;
  readonly borderWidth: number;
  readonly borderAlpha: number;
  readonly overlayColor: number;
  readonly overlayAlpha: number;
}

export interface HeroSlotPersistentText {
  readonly name: string;
  readonly detail: string;
}

export interface HeroSlotInteractionContext {
  readonly unlocked: boolean;
  readonly occupied: boolean;
  readonly selected: boolean;
  readonly hovered: boolean;
  readonly maximumStar: boolean;
  readonly requestedState: HeroSlotInteractionState;
}

export interface HeroSlotInteractionVisualState {
  readonly frameState: HeroSlotInteractionState;
  readonly showHoverVisual: boolean;
  readonly showSelectedOutline: boolean;
  readonly showSelectedMarker: boolean;
  readonly showMaximumStar: boolean;
}

export const HERO_SLOT_INTERACTION_PRIORITY = Object.freeze([
  'locked',
  'disabled',
  'dragging',
  'mergeInvalid',
  'mergeHovered',
  'mergeEligible',
  'selected',
  'maximumStar',
  'hovered',
  'normal',
] as const satisfies readonly HeroSlotInteractionState[]);

const OVERRIDING_STATES = new Set<HeroSlotInteractionState>([
  'disabled',
  'dragging',
  'mergeInvalid',
  'mergeHovered',
  'mergeEligible',
]);

const STATES_SUPPRESSING_SELECTION = new Set<HeroSlotInteractionState>([
  'locked',
  'disabled',
  'dragging',
  'mergeInvalid',
  'mergeHovered',
  'mergeEligible',
]);

const STYLES: Readonly<Record<HeroSlotInteractionState, HeroSlotInteractionStyle>> =
  Object.freeze({
    normal: style(UI_COLORS.primary, 2, 0.82),
    hovered: style(UI_COLORS.energy, 1, 0.4),
    selected: style(UI_COLORS.slotSelectedOutline, 2, 1),
    dragging: style(UI_COLORS.energy, 3, 0.92, UI_COLORS.pageDeep, 0.34),
    mergeEligible: style(UI_COLORS.coreHealthy, 3, 0.96, UI_COLORS.coreHealthy, 0.08),
    mergeHovered: style(UI_COLORS.star, 4, 1, UI_COLORS.star, 0.14),
    mergeInvalid: style(UI_COLORS.coreDanger, 3, 0.9, UI_COLORS.coreDanger, 0.1),
    maximumStar: style(UI_COLORS.star, 3, 0.96),
    locked: style(UI_COLORS.locked, 2, 0.62, UI_COLORS.pageDeep, 0.12),
    disabled: style(UI_COLORS.textMuted, 2, 0.48, UI_COLORS.pageDeep, 0.24),
  });

export function getHeroSlotInteractionStyle(
  state: HeroSlotInteractionState,
): HeroSlotInteractionStyle {
  return STYLES[state];
}

/**
 * 组合格位视觉状态。实例选择使用独立外框表达，因此可与 hovered / maximumStar
 * 同时存在；锁定、禁用和未来合成操作拥有更高语义优先级。
 */
export function deriveHeroSlotInteractionVisualState(
  context: HeroSlotInteractionContext,
): HeroSlotInteractionVisualState {
  const unavailableState = !context.unlocked
    ? 'locked'
    : context.requestedState === 'disabled'
      ? 'disabled'
      : null;
  const overridingState = unavailableState ??
    (OVERRIDING_STATES.has(context.requestedState)
      ? context.requestedState
      : null);
  const frameState = overridingState ??
    (context.maximumStar ? 'maximumStar' : 'normal');
  const showSelected = context.occupied && context.selected &&
    !STATES_SUPPRESSING_SELECTION.has(frameState);
  const showHover = context.occupied && context.hovered &&
    overridingState === null;
  return Object.freeze({
    frameState,
    showHoverVisual: showHover,
    showSelectedOutline: showSelected,
    showSelectedMarker: showSelected,
    showMaximumStar: context.occupied && context.maximumStar &&
      frameState !== 'locked' && frameState !== 'disabled',
  });
}

/** 命中区域只由格位矩形决定，与英雄 PNG 的透明像素无关。 */
export function getHeroSlotHitArea(): UiRect {
  return Object.freeze({
    x: -UI_METRICS.slot.width / 2,
    y: UI_METRICS.slot.backgroundTop,
    width: UI_METRICS.slot.width,
    height: UI_METRICS.slot.height,
  });
}

/** 默认格位不常驻显示英雄名或完整星级；仅锁定格保留必要进度。 */
export function deriveHeroSlotPersistentText(
  unlocked: boolean,
  isNextLockedSlot: boolean,
  summonsUntilUnlock: number | null,
): HeroSlotPersistentText {
  if (unlocked) return Object.freeze({ name: '', detail: '' });
  return Object.freeze({
    name: '',
    detail:
      isNextLockedSlot && summonsUntilUnlock !== null
        ? `再召唤 ${summonsUntilUnlock} 次`
        : '等待解锁',
  });
}

function style(
  borderColor: number,
  borderWidth: number,
  borderAlpha: number,
  overlayColor: number = UI_COLORS.pageDeep,
  overlayAlpha = 0,
): HeroSlotInteractionStyle {
  return Object.freeze({
    borderColor,
    borderWidth,
    borderAlpha,
    overlayColor,
    overlayAlpha,
  });
}

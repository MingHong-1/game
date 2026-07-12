import type { HeroVisualDefinition } from '../../presentation/VisualDefinitions';
import type { UiPoint, UiRect } from '../layout/BottomCommandLayout';
import { UI_METRICS } from '../theme/uiMetrics';

export const HERO_SLOT_LAYER_ORDER = Object.freeze([
  'slotBackplate',
  'heroVisual',
  'slotForegroundLip',
  'slotStateOverlay',
  'lockOverlay',
  'interactionHitArea',
] as const);

export const HERO_VISUAL_LAYER_ORDER = Object.freeze([
  'heroEcho',
  'heroMain',
] as const);

export const HERO_SLOT_STATE_LAYER_ORDER = Object.freeze([
  'professionOrStarFrame',
  'hoverVisual',
  'selectedOuterFrame',
  'selectedMarker',
  'unlockSparkle',
  'interactionOverlay',
  'dragOverlay',
] as const);

export type HeroSlotLayerName = (typeof HERO_SLOT_LAYER_ORDER)[number];
export type HeroVisualLayerName = (typeof HERO_VISUAL_LAYER_ORDER)[number];

export interface HeroSlotLayerPolicy {
  readonly usesHeroClipMask: false;
  readonly foregroundLipHeight: number;
  readonly maximumFootCoverage: number;
  readonly selectedOutlineGap: number;
  readonly selectedOutlineWidth: number;
}

export const HERO_SLOT_LAYER_POLICY: HeroSlotLayerPolicy = Object.freeze({
  usesHeroClipMask: false,
  foregroundLipHeight: UI_METRICS.slot.foregroundLipHeight,
  maximumFootCoverage: 2,
  selectedOutlineGap: UI_METRICS.slot.selectedOutlineGap,
  selectedOutlineWidth: UI_METRICS.slot.selectedOutlineWidth,
});

// 256px 运行纹理经资源验证保证四边至少有 15px 透明安全边距。
export const HERO_RUNTIME_TEXTURE_SIZE = 256;
export const HERO_RUNTIME_MINIMUM_ALPHA_MARGIN = 15;

export function shouldShowLockOverlay(unlocked: boolean): boolean {
  return !unlocked;
}

export function shouldShowForegroundLip(
  unlocked: boolean,
  occupied: boolean,
): boolean {
  return unlocked && occupied;
}

export function getHeroVisualBounds(
  slotCenter: UiPoint,
  definition: HeroVisualDefinition,
  displaySize: number,
): UiRect {
  return Object.freeze({
    x: slotCenter.x + definition.slotOffset.x - displaySize * definition.footAnchor.x,
    y: slotCenter.y + definition.slotOffset.y - displaySize * definition.footAnchor.y,
    width: displaySize,
    height: displaySize,
  });
}

/** 返回基于运行纹理最小透明边距的保守可见主体边界。 */
export function getHeroRuntimeVisibleBounds(visualBounds: UiRect): UiRect {
  const insetX = visualBounds.width *
    HERO_RUNTIME_MINIMUM_ALPHA_MARGIN / HERO_RUNTIME_TEXTURE_SIZE;
  const insetY = visualBounds.height *
    HERO_RUNTIME_MINIMUM_ALPHA_MARGIN / HERO_RUNTIME_TEXTURE_SIZE;
  return Object.freeze({
    x: visualBounds.x + insetX,
    y: visualBounds.y + insetY,
    width: visualBounds.width - insetX * 2,
    height: visualBounds.height - insetY * 2,
  });
}

export function getHeroForegroundLipBounds(
  slotCenter: UiPoint,
): UiRect {
  const slotBottom = slotCenter.y + UI_METRICS.slot.backgroundTop +
    UI_METRICS.slot.height;
  return Object.freeze({
    x: slotCenter.x - UI_METRICS.slot.foregroundLipWidth / 2,
    y: slotBottom - UI_METRICS.slot.foregroundLipBottomInset -
      HERO_SLOT_LAYER_POLICY.foregroundLipHeight,
    width: UI_METRICS.slot.foregroundLipWidth,
    height: HERO_SLOT_LAYER_POLICY.foregroundLipHeight,
  });
}

export function getHeroSlotCoreBounds(slotRect: UiRect): UiRect {
  const horizontalInset = UI_METRICS.spacing.internal;
  // 格位上下边缘允许英雄和状态边框受控溢出；核心区只表示不可侵入的主体内容。
  const verticalInset = UI_METRICS.spacing.module - 1;
  return Object.freeze({
    x: slotRect.x + horizontalInset,
    y: slotRect.y + verticalInset,
    width: slotRect.width - horizontalInset * 2,
    height: slotRect.height - verticalInset * 2,
  });
}

export function getHeroSlotSelectedOutlineBounds(slotRect: UiRect): UiRect {
  const outset = HERO_SLOT_LAYER_POLICY.selectedOutlineGap +
    HERO_SLOT_LAYER_POLICY.selectedOutlineWidth / 2;
  return Object.freeze({
    x: slotRect.x - outset,
    y: slotRect.y,
    width: slotRect.width + outset * 2,
    height: slotRect.height,
  });
}

export function getHeroSlotSelectedMarkerBounds(slotRect: UiRect): UiRect {
  const size = UI_METRICS.slot.selectedMarkerSize;
  return Object.freeze({
    x: slotRect.x + slotRect.width - UI_METRICS.slot.selectedMarkerInsetX - size,
    y: slotRect.y + UI_METRICS.slot.selectedMarkerInsetY,
    width: size,
    height: size,
  });
}

export function getHeroSlotHoverBounds(slotRect: UiRect): UiRect {
  const inset = UI_METRICS.slot.hoverFrameInset;
  return Object.freeze({
    x: slotRect.x + inset,
    y: slotRect.y + inset,
    width: slotRect.width - inset * 2,
    height: slotRect.height - inset * 2,
  });
}

export function getHeroBaseAuraBounds(
  slotCenter: UiPoint,
  footBaselineY: number,
  maximumStar: boolean,
): UiRect {
  const radius = maximumStar ? 23 : 19;
  const offsetY = maximumStar
    ? UI_METRICS.slot.maximumStarAuraOffsetY
    : UI_METRICS.slot.baseAuraOffsetY;
  return Object.freeze({
    x: slotCenter.x - radius,
    y: slotCenter.y + footBaselineY + offsetY - radius,
    width: radius * 2,
    height: radius * 2,
  });
}

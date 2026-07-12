import { describe, expect, it } from 'vitest';

import { deriveHeroStarPresentation } from '../src/presentation/HeroStarPresentationModel';
import {
  deriveHeroSlotPersistentText,
  deriveHeroSlotInteractionVisualState,
  getHeroSlotHitArea,
  getHeroSlotInteractionStyle,
  HERO_SLOT_INTERACTION_PRIORITY,
  type HeroSlotInteractionState,
} from '../src/ui/state/HeroSlotInteractionState';
import { UI_METRICS } from '../src/ui/theme/uiMetrics';
import {
  HERO_SLOT_LAYER_ORDER,
  HERO_SLOT_LAYER_POLICY,
  HERO_SLOT_STATE_LAYER_ORDER,
  HERO_VISUAL_LAYER_ORDER,
  getHeroSlotHoverBounds,
  getHeroSlotSelectedMarkerBounds,
  getHeroSlotSelectedOutlineBounds,
  shouldShowForegroundLip,
  shouldShowLockOverlay,
} from '../src/ui/state/HeroSlotLayerModel';
import { HeroInstanceSelection } from '../src/ui/state/HeroInstanceSelection';
import { UI_COLORS } from '../src/ui/theme/uiTheme';
import { formatSelectedHeroInfoLabel } from '../src/ui/components/SelectedHeroInfoBar';

describe('英雄星级纯表现模型', () => {
  it('1～4星使用规定的主视觉、分身和满星表现', () => {
    expect(deriveHeroStarPresentation(1)).toMatchObject({
      mainSizeScale: 1,
      echoes: [],
      showMaximumStarAura: false,
    });
    expect(deriveHeroStarPresentation(2).echoes).toHaveLength(1);
    expect(deriveHeroStarPresentation(3).echoes).toHaveLength(2);
    expect(deriveHeroStarPresentation(4)).toMatchObject({
      mainSizeScale: 1.1,
      echoes: [],
      showMaximumStarAura: true,
    });
  });

  it('分身仅包含显示参数，不携带实例、攻击或输入字段', () => {
    const echo = deriveHeroStarPresentation(3).echoes[0];
    expect(echo).toBeDefined();
    expect(Object.keys(echo!)).toEqual(['offsetX', 'offsetY', 'sizeScale', 'alpha']);
    expect(echo).not.toHaveProperty('instanceId');
    expect(echo).not.toHaveProperty('attack');
    expect(echo).not.toHaveProperty('interactive');
  });
});

describe('格位简化和拖拽状态预留', () => {
  it('显示树严格保持底板、英雄、薄前唇、状态、锁和HitArea顺序', () => {
    expect(HERO_SLOT_LAYER_ORDER).toEqual([
      'slotBackplate',
      'heroVisual',
      'slotForegroundLip',
      'slotStateOverlay',
      'lockOverlay',
      'interactionHitArea',
    ]);
    expect(HERO_VISUAL_LAYER_ORDER).toEqual(['heroEcho', 'heroMain']);
    expect(HERO_SLOT_STATE_LAYER_ORDER).toEqual([
      'professionOrStarFrame',
      'hoverVisual',
      'selectedOuterFrame',
      'selectedMarker',
      'unlockSparkle',
      'interactionOverlay',
      'dragOverlay',
    ]);
    expect(HERO_SLOT_LAYER_POLICY).toEqual({
      usesHeroClipMask: false,
      foregroundLipHeight: 2,
      maximumFootCoverage: 2,
      selectedOutlineGap: 2,
      selectedOutlineWidth: 2,
    });
  });

  it('锁定遮罩只用于锁定格位', () => {
    expect(shouldShowLockOverlay(false)).toBe(true);
    expect(shouldShowLockOverlay(true)).toBe(false);
    expect(shouldShowForegroundLip(false, false)).toBe(false);
    expect(shouldShowForegroundLip(true, false)).toBe(false);
    expect(shouldShowForegroundLip(true, true)).toBe(true);
  });

  it('开放格位默认不常驻显示英雄名和完整星级文案', () => {
    expect(deriveHeroSlotPersistentText(true, false, null)).toEqual({
      name: '',
      detail: '',
    });
    expect(deriveHeroSlotPersistentText(false, true, 3)).toEqual({
      name: '',
      detail: '再召唤 3 次',
    });
  });

  it('选中信息条使用紧凑单行文案并可安全截断', () => {
    const model = {
      heroInstanceId: 'hero-1',
      name: '疾风猎手',
      starLevel: 1,
      roleLabel: '射手',
      effectiveBasicAttack: 12,
      critChance: 0.1,
      statusSummary: '状态正常',
    };
    expect(formatSelectedHeroInfoLabel(model)).toBe(
      '疾风猎手 · 1星 · 射手 · 攻击12 · 暴击10%',
    );
    expect(formatSelectedHeroInfoLabel({ ...model, name: '超长名称'.repeat(20) }, 20))
      .toHaveLength(20);
    expect(formatSelectedHeroInfoLabel({ ...model, name: '超长名称'.repeat(20) }, 20))
      .toMatch(/…$/);
  });

  it('HitArea只由完整格位矩形决定', () => {
    expect(getHeroSlotHitArea()).toEqual({
      x: -UI_METRICS.slot.width / 2,
      y: UI_METRICS.slot.backgroundTop,
      width: UI_METRICS.slot.width,
      height: UI_METRICS.slot.height,
    });
  });

  it('所有预留交互状态都具有统一视觉定义', () => {
    const states: readonly HeroSlotInteractionState[] = [
      'normal',
      'hovered',
      'selected',
      'dragging',
      'mergeEligible',
      'mergeHovered',
      'mergeInvalid',
      'maximumStar',
      'locked',
      'disabled',
    ];
    for (const state of states) {
      expect(getHeroSlotInteractionStyle(state)).toMatchObject({
        borderColor: expect.any(Number),
        borderWidth: expect.any(Number),
        overlayAlpha: expect.any(Number),
      });
    }
  });

  it('实例级选中使用独立青白外框和标记，不使用整块遮罩', () => {
    const selectedStyle = getHeroSlotInteractionStyle('selected');
    expect(UI_COLORS.slotSelectedOutline).not.toBe(UI_COLORS.star);
    expect(UI_COLORS.slotSelectedMarker).not.toBe(UI_COLORS.locked);
    expect(selectedStyle.overlayAlpha).toBe(0);
    expect(UI_METRICS.slot.selectedOutlineWidth).toBe(2);
    expect(UI_METRICS.slot.selectedOutlineGap).toBe(2);
    expect(UI_METRICS.slot.selectedMarkerSize).toBe(6);
    expect(UI_METRICS.slot.selectedMarkerInsetX).toBe(5);
    expect(UI_METRICS.slot.selectedMarkerInsetY).toBe(5);
    const slot = { x: 0, y: 0, width: 80, height: 76 };
    expect(getHeroSlotHoverBounds(slot)).toEqual({
      x: 3,
      y: 3,
      width: 74,
      height: 70,
    });
    expect(getHeroSlotSelectedOutlineBounds(slot)).toEqual({
      x: -3,
      y: 0,
      width: 86,
      height: 76,
    });
    expect(getHeroSlotSelectedMarkerBounds(slot)).toEqual({
      x: 69,
      y: 5,
      width: 6,
      height: 6,
    });
  });

  it('Hover是低强度内层反馈，视觉强度明确低于SelectedOuterFrame', () => {
    const hoverStyle = getHeroSlotInteractionStyle('hovered');
    const selectedStyle = getHeroSlotInteractionStyle('selected');
    expect(hoverStyle.borderWidth).toBe(1);
    expect(hoverStyle.borderAlpha).toBeGreaterThanOrEqual(0.3);
    expect(hoverStyle.borderAlpha).toBeLessThanOrEqual(0.45);
    expect(hoverStyle.borderWidth).toBeLessThanOrEqual(
      UI_METRICS.slot.selectedOutlineWidth,
    );
    expect(hoverStyle.borderAlpha).toBeLessThan(1);
    expect(selectedStyle.borderAlpha).toBeGreaterThan(hoverStyle.borderAlpha);
    expect(selectedStyle.borderWidth).toBeGreaterThanOrEqual(
      hoverStyle.borderWidth,
    );
    expect(hoverStyle.overlayAlpha).toBe(0);
    expect(deriveHeroSlotInteractionVisualState({
      unlocked: true,
      occupied: true,
      selected: false,
      hovered: true,
      maximumStar: false,
      requestedState: 'normal',
    })).toEqual({
      frameState: 'normal',
      showHoverVisual: true,
      showSelectedOutline: false,
      showSelectedMarker: false,
      showMaximumStar: false,
    });
  });

  it('selected可与hovered和maximumStar组合，锁定和禁用会抑制实例选中', () => {
    const base = {
      unlocked: true,
      occupied: true,
      selected: true,
      hovered: false,
      maximumStar: false,
      requestedState: 'normal' as const,
    };
    expect(deriveHeroSlotInteractionVisualState({ ...base, hovered: true }))
      .toEqual({
        frameState: 'normal',
        showHoverVisual: true,
        showSelectedOutline: true,
        showSelectedMarker: true,
        showMaximumStar: false,
      });
    expect(deriveHeroSlotInteractionVisualState({ ...base, maximumStar: true }))
      .toEqual({
        frameState: 'maximumStar',
        showHoverVisual: false,
        showSelectedOutline: true,
        showSelectedMarker: true,
        showMaximumStar: true,
      });
    expect(deriveHeroSlotInteractionVisualState(base)).toMatchObject({
      frameState: 'normal',
      showHoverVisual: false,
      showSelectedOutline: true,
      showSelectedMarker: true,
    });
    expect(deriveHeroSlotInteractionVisualState({ ...base, unlocked: false }))
      .toMatchObject({
        frameState: 'locked',
        showHoverVisual: false,
        showSelectedOutline: false,
        showSelectedMarker: false,
      });
    expect(deriveHeroSlotInteractionVisualState({
      ...base,
      requestedState: 'disabled',
    })).toMatchObject({
      frameState: 'disabled',
      showHoverVisual: false,
      showSelectedOutline: false,
      showSelectedMarker: false,
    });
    expect(deriveHeroSlotInteractionVisualState({ ...base, occupied: false }))
      .toMatchObject({
        showSelectedOutline: false,
        showSelectedMarker: false,
      });
  });

  it('未来合成状态优先于selected且不改变统一状态优先级', () => {
    expect(HERO_SLOT_INTERACTION_PRIORITY).toEqual([
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
    ]);
    expect(deriveHeroSlotInteractionVisualState({
      unlocked: true,
      occupied: true,
      selected: true,
      hovered: true,
      maximumStar: false,
      requestedState: 'mergeHovered',
    })).toMatchObject({
      frameState: 'mergeHovered',
      showHoverVisual: false,
      showSelectedOutline: false,
      showSelectedMarker: false,
    });
  });
});

describe('英雄实例级选择', () => {
  it('同heroId的不同实例只会选中稳定instanceId对应的格位', () => {
    const selection = new HeroInstanceSelection();
    const first = 'gale-hunter:instance-1';
    const second = 'gale-hunter:instance-2';
    selection.select(first);
    expect(selection.isSelected(first)).toBe(true);
    expect(selection.isSelected(second)).toBe(false);
    selection.toggle(second);
    expect(selection.isSelected(first)).toBe(false);
    expect(selection.isSelected(second)).toBe(true);
  });

  it('再次点击可取消，实例移除、重开和销毁都会清空选择', () => {
    const selection = new HeroInstanceSelection();
    selection.toggle('hero-instance-1');
    selection.toggle('hero-instance-1');
    expect(selection.current).toBeNull();
    selection.select('hero-instance-2');
    expect(selection.reconcile(['hero-instance-1'])).toBe(true);
    expect(selection.current).toBeNull();
    selection.select('hero-instance-3');
    selection.clear();
    expect(selection.current).toBeNull();
    selection.select('hero-instance-4');
    selection.destroy();
    expect(selection.current).toBeNull();
  });

  it('格位重新绑定的新实例不会继承旧实例选择', () => {
    const selection = new HeroInstanceSelection();
    selection.select('old-instance');
    expect(selection.isSelected('new-instance')).toBe(false);
    expect(selection.reconcile(['new-instance'])).toBe(true);
    expect(selection.current).toBeNull();
    expect(() => selection.select('   ')).toThrow('英雄实例 ID 不能为空');
  });
});

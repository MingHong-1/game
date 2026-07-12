import { describe, expect, it } from 'vitest';

import { PROTOTYPE_LEVEL } from '../src/data/levelDefinitions';
import { HERO_VISUAL_DEFINITIONS } from '../src/data/visualDefinitions';
import { resolveHeroBodyScale } from '../src/presentation/VisualDefinitions';
import { isUiDebugEnabled } from '../src/ui/debug/UiDebugOverlay';
import {
  centerOf,
  containsRect,
  createBottomCommandLayout,
  rectsOverlap,
  type UiRect,
} from '../src/ui/layout/BottomCommandLayout';
import { UI_METRICS } from '../src/ui/theme/uiMetrics';
import { resolveActionButtonVisualStyle } from '../src/ui/theme/uiTheme';

const layout = createBottomCommandLayout(PROTOTYPE_LEVEL.heroSlots);

describe('底部三栏指挥台布局', () => {
  it('三栏互不重叠且全部位于指挥台内部', () => {
    const columns = [
      layout.columns.left,
      layout.columns.center,
      layout.columns.right,
    ];
    for (const column of columns) {
      expect(containsRect(layout.bounds, column)).toBe(true);
    }
    for (let first = 0; first < columns.length; first += 1) {
      for (let second = first + 1; second < columns.length; second += 1) {
        expect(rectsOverlap(columns[first]!, columns[second]!)).toBe(false);
      }
    }
    expect(layout.columns.left.width).toBe(296);
    expect(layout.columns.center.width).toBe(592);
    expect(layout.columns.right.width).toBe(296);
  });

  it('同一行卡片和按钮共享顶部基线与高度', () => {
    expectAligned(layout.left.energy, layout.left.summonCost);
    expectAligned(layout.right.formation, layout.right.expansionProgress);
    expectAligned(layout.right.merge, layout.right.rebuild);
    expect(layout.left.energy.height).toBe(UI_METRICS.statCard.height);
    expect(layout.right.summon.height).toBe(UI_METRICS.button.primaryHeight);
    expect(layout.left.skillPreview.height).toBe(UI_METRICS.button.height);
  });

  it('技能预览、英雄棋盘和主召唤分别归属左中右栏', () => {
    expect(containsRect(layout.columns.left, layout.left.skillPreview)).toBe(true);
    expect(containsRect(layout.columns.right, layout.right.summon)).toBe(true);
    for (const slot of layout.heroBoard.slotRects) {
      expect(containsRect(layout.columns.center, slot)).toBe(true);
    }
    expect(centerOf(layout.right.summon).x).toBeGreaterThan(
      centerOf(layout.columns.center).x,
    );
  });

  it('十格保持上下各五格且卡片不重叠', () => {
    expect(layout.heroBoard.slotRects).toHaveLength(10);
    expect(new Set(layout.heroBoard.slotCenters.slice(0, 5).map((slot) => slot.y)))
      .toEqual(new Set([134]));
    expect(new Set(layout.heroBoard.slotCenters.slice(5).map((slot) => slot.y)))
      .toEqual(new Set([42]));
    for (let first = 0; first < layout.heroBoard.slotRects.length; first += 1) {
      for (let second = first + 1; second < layout.heroBoard.slotRects.length; second += 1) {
        expect(
          rectsOverlap(
            layout.heroBoard.slotRects[first]!,
            layout.heroBoard.slotRects[second]!,
          ),
        ).toBe(false);
      }
    }
  });

  it('四名正式英雄的最大视觉范围位于棋盘允许区且避开自身文字安全区', () => {
    const runtimeVisuals = HERO_VISUAL_DEFINITIONS.filter(
      (definition) => definition.heroId !== 'forest-summoner',
    );
    for (const definition of runtimeVisuals) {
      const scale = resolveHeroBodyScale(
        'texture',
        definition.defaultScale,
        1_254,
        1_254,
        UI_METRICS.slot.heroMaximumDisplaySize,
      );
      const size = 1_254 * scale;
      for (const center of layout.heroBoard.slotCenters) {
        const visualBounds = {
          x: center.x + definition.slotOffset.x - size * definition.footAnchor.x,
          y: center.y + definition.slotOffset.y - size * definition.footAnchor.y,
          width: size,
          height: size,
        };
        expect(containsRect(layout.heroBoard.visualBounds, visualBounds)).toBe(true);
        expect(visualBounds.y + visualBounds.height).toBeLessThanOrEqual(
          center.y + UI_METRICS.slot.heroTextSafeTop,
        );
      }
    }
  });
});

describe('统一动作按钮和UI调试', () => {
  it('不同按钮变体在禁用时使用同一低权重样式', () => {
    const state = {
      enabled: false,
      selected: false,
      focused: false,
      pressed: false,
    };
    expect(resolveActionButtonVisualStyle('primary', state)).toEqual(
      resolveActionButtonVisualStyle('secondary', state),
    );
    expect(resolveActionButtonVisualStyle('tertiary', state).containerAlpha)
      .toBeLessThan(0.5);
  });

  it('程序fallback尺寸不随72px正式纹理上限放大', () => {
    expect(
      resolveHeroBodyScale(
        'programmatic',
        0.056,
        28,
        28,
        UI_METRICS.slot.heroMaximumDisplaySize,
      ),
    ).toBe(1);
  });

  it('uiDebug默认关闭且只在开发环境显式开启', () => {
    expect(isUiDebugEnabled('', true)).toBe(false);
    expect(isUiDebugEnabled('?uiDebug=0', true)).toBe(false);
    expect(isUiDebugEnabled('?uiDebug=1', false)).toBe(false);
    expect(isUiDebugEnabled('?uiDebug=1', true)).toBe(true);
  });
});

function expectAligned(first: UiRect, second: UiRect): void {
  expect(first.y).toBe(second.y);
  expect(first.height).toBe(second.height);
}

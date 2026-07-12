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
import { deriveHeroStarPresentation } from '../src/presentation/HeroStarPresentationModel';
import { getHeroSlotHitArea } from '../src/ui/state/HeroSlotInteractionState';
import {
  getHeroForegroundLipBounds,
  getHeroBaseAuraBounds,
  getHeroRuntimeVisibleBounds,
  getHeroSlotCoreBounds,
  getHeroSlotSelectedMarkerBounds,
  getHeroSlotSelectedOutlineBounds,
  getHeroVisualBounds,
} from '../src/ui/state/HeroSlotLayerModel';

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
      .toEqual(new Set([153]));
    expect(new Set(layout.heroBoard.slotCenters.slice(5).map((slot) => slot.y)))
      .toEqual(new Set([71]));
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

  it('下排统一上移5px并为底板、英雄、光圈和选中外框保留底部安全区', () => {
    const lowerCenters = layout.heroBoard.slotCenters.slice(0, 5);
    const upperCenters = layout.heroBoard.slotCenters.slice(5);
    expect(new Set(lowerCenters.map((center) => center.y))).toEqual(new Set([153]));
    expect(new Set(upperCenters.map((center) => center.y))).toEqual(new Set([71]));
    expect(UI_METRICS.layout.bottomCommand.secondRowVerticalAdjustment).toBe(-5);
    expect(layout.heroBoard.bottomSafeArea.height).toBe(4);

    const runtimeVisuals = HERO_VISUAL_DEFINITIONS.filter(
      (definition) => definition.heroId !== 'forest-summoner',
    );
    for (let index = 0; index < 5; index += 1) {
      const center = lowerCenters[index]!;
      const slot = layout.heroBoard.slotRects[index]!;
      expect(slot.y + slot.height).toBeLessThanOrEqual(
        layout.heroBoard.bottomSafeArea.y,
      );
      expect(rectsOverlap(
        getHeroSlotSelectedOutlineBounds(slot),
        layout.heroBoard.bottomSafeArea,
      )).toBe(false);
      expect(containsRect(slot, getHeroSlotSelectedMarkerBounds(slot))).toBe(true);
      expect(rectsOverlap(
        getHeroSlotSelectedOutlineBounds(slot),
        getHeroSlotSelectedOutlineBounds(layout.heroBoard.slotRects[index + 5]!),
      )).toBe(false);
      for (const definition of runtimeVisuals) {
        const maximumDisplaySize = Math.min(
          Math.round(
            definition.displaySize * deriveHeroStarPresentation(4).mainSizeScale,
          ),
          UI_METRICS.slot.heroMaximumDisplaySize,
        );
        expect(rectsOverlap(
          getHeroVisualBounds(center, definition, maximumDisplaySize),
          layout.heroBoard.bottomSafeArea,
        )).toBe(false);
        expect(rectsOverlap(
          getHeroBaseAuraBounds(center, definition.slotOffset.y, false),
          layout.heroBoard.bottomSafeArea,
        )).toBe(false);
        expect(rectsOverlap(
          getHeroBaseAuraBounds(center, definition.slotOffset.y, true),
          layout.heroBoard.bottomSafeArea,
        )).toBe(false);
      }
    }
  });

  it('SlotForegroundLip统一降低到距格位底边8px且仅保留2px弱前景边', () => {
    const previousLipCenters = HERO_VISUAL_DEFINITIONS
      .filter((definition) => definition.heroId !== 'forest-summoner')
      .map((definition) => definition.slotOffset.y);
    for (const [index, center] of layout.heroBoard.slotCenters.entries()) {
      const slot = layout.heroBoard.slotRects[index]!;
      const lip = getHeroForegroundLipBounds(center);
      expect(containsRect(slot, lip)).toBe(true);
      expect(lip.height).toBe(2);
      expect(slot.y + slot.height - (lip.y + lip.height)).toBe(8);
      expect(lip.y + lip.height / 2 - center.y).toBe(43);
      expect(UI_METRICS.slot.foregroundLipAlpha).toBe(0.55);
      expect(UI_METRICS.slot.foregroundLipAlpha).toBeLessThan(0.82);
      expect(rectsOverlap(lip, getHeroSlotSelectedMarkerBounds(slot))).toBe(false);
    }
    const averageDownwardMovement = previousLipCenters.reduce(
      (total, previousY) => total + (43 - previousY),
      0,
    ) / previousLipCenters.length;
    expect(averageDownwardMovement).toBeGreaterThanOrEqual(5);
    expect(averageDownwardMovement).toBeLessThanOrEqual(7);
  });

  it('Lip不遮挡1～4星主视觉，分身和脚底圆环最多只有2px前景交叠', () => {
    const runtimeVisuals = HERO_VISUAL_DEFINITIONS.filter(
      (definition) => definition.heroId !== 'forest-summoner',
    );
    for (const center of layout.heroBoard.slotCenters) {
      const lip = getHeroForegroundLipBounds(center);
      for (const definition of runtimeVisuals) {
        for (const starLevel of [1, 2, 3, 4] as const) {
          const presentation = deriveHeroStarPresentation(starLevel);
          const mainSize = Math.min(
            Math.round(definition.displaySize * presentation.mainSizeScale),
            UI_METRICS.slot.heroMaximumDisplaySize,
          );
          expect(rectsOverlap(
            lip,
            getHeroRuntimeVisibleBounds(
              getHeroVisualBounds(center, definition, mainSize),
            ),
          )).toBe(false);
          for (const echo of presentation.echoes) {
            const echoSize = Math.min(
              Math.round(definition.displaySize * echo.sizeScale),
              UI_METRICS.slot.heroEchoDisplaySize,
            );
            const echoBounds = getHeroRuntimeVisibleBounds(
              getHeroVisualBounds(
                { x: center.x + echo.offsetX, y: center.y + echo.offsetY },
                definition,
                echoSize,
              ),
            );
            expect(verticalOverlap(lip, echoBounds)).toBeLessThanOrEqual(2);
          }
        }
        expect(verticalOverlap(
          lip,
          getHeroBaseAuraBounds(center, definition.slotOffset.y, false),
        )).toBeLessThanOrEqual(2);
        expect(verticalOverlap(
          lip,
          getHeroBaseAuraBounds(center, definition.slotOffset.y, true),
        )).toBeLessThanOrEqual(2);
      }
    }
  });

  it('信息条、上排、下排和底边形成11/6/7px稳定间距', () => {
    expect(layout.heroBoard.selectedInfoBar).toEqual({
      x: 336,
      y: 8,
      width: 576,
      height: 28,
    });
    expect(UI_METRICS.layout.bottomCommand.firstRowVerticalAdjustment).toBe(-5);
    expect(layout.heroBoard.spacingAreas.infoToFirstRow.height).toBe(11);
    expect(layout.heroBoard.spacingAreas.betweenRows.height).toBe(6);
    expect(layout.heroBoard.spacingAreas.secondRowToBottom.height).toBe(7);
    expect(layout.heroBoard.bottomSafeArea.height).toBe(4);

    for (let column = 0; column < 5; column += 1) {
      const secondRow = layout.heroBoard.slotRects[column]!;
      const firstRow = layout.heroBoard.slotRects[column + 5]!;
      expect(rectsOverlap(firstRow, layout.heroBoard.selectedInfoBar)).toBe(false);
      expect(rectsOverlap(firstRow, secondRow)).toBe(false);
      expect(rectsOverlap(
        getHeroSlotSelectedOutlineBounds(firstRow),
        layout.heroBoard.selectedInfoBar,
      )).toBe(false);
      expect(rectsOverlap(
        getHeroSlotSelectedMarkerBounds(firstRow),
        layout.heroBoard.selectedInfoBar,
      )).toBe(false);
      expect(rectsOverlap(
        getHeroSlotSelectedOutlineBounds(firstRow),
        getHeroSlotSelectedOutlineBounds(secondRow),
      )).toBe(false);
    }
  });

  it('上排当前1星、2/3星分身和4星主视觉均避开信息条', () => {
    const runtimeVisuals = HERO_VISUAL_DEFINITIONS.filter(
      (definition) => definition.heroId !== 'forest-summoner',
    );
    for (const center of layout.heroBoard.slotCenters.slice(5)) {
      for (const definition of runtimeVisuals) {
        for (const starLevel of [1, 2, 3, 4] as const) {
          const presentation = deriveHeroStarPresentation(starLevel);
          const displaySize = Math.min(
            Math.round(definition.displaySize * presentation.mainSizeScale),
            UI_METRICS.slot.heroMaximumDisplaySize,
          );
          expect(rectsOverlap(
            getHeroRuntimeVisibleBounds(
              getHeroVisualBounds(center, definition, displaySize),
            ),
            layout.heroBoard.selectedInfoBar,
          )).toBe(false);
          for (const echo of presentation.echoes) {
            const echoSize = Math.min(
              Math.round(definition.displaySize * echo.sizeScale),
              UI_METRICS.slot.heroEchoDisplaySize,
            );
            expect(rectsOverlap(
              getHeroRuntimeVisibleBounds(
                getHeroVisualBounds(
                  { x: center.x + echo.offsetX, y: center.y + echo.offsetY },
                  definition,
                  echoSize,
                ),
              ),
              layout.heroBoard.selectedInfoBar,
            )).toBe(false);
          }
        }
        expect(rectsOverlap(
          getHeroBaseAuraBounds(center, definition.slotOffset.y, true),
          layout.heroBoard.selectedInfoBar,
        )).toBe(false);
      }
    }
  });

  it('上下两排HitArea跟随格位且互不相交', () => {
    const localHitArea = getHeroSlotHitArea();
    for (let index = 0; index < 10; index += 1) {
      const center = layout.heroBoard.slotCenters[index]!;
      const hitArea = {
        x: center.x + localHitArea.x,
        y: center.y + localHitArea.y,
        width: localHitArea.width,
        height: localHitArea.height,
      };
      expect(hitArea).toEqual(layout.heroBoard.slotRects[index]);
      expect(rectsOverlap(hitArea, layout.heroBoard.selectedInfoBar)).toBe(false);
      if (index < 5) {
        expect(rectsOverlap(hitArea, layout.heroBoard.slotRects[index + 5]!))
          .toBe(false);
      }
    }
  });

  it('SelectedOuterFrame和右上Marker均保持在安全棋盘范围且互不侵入相邻格位', () => {
    for (const [index, slot] of layout.heroBoard.slotRects.entries()) {
      const selectedBounds = getHeroSlotSelectedOutlineBounds(slot);
      expect(containsRect(layout.heroBoard.visualBounds, selectedBounds)).toBe(true);
      expect(containsRect(slot, getHeroSlotSelectedMarkerBounds(slot))).toBe(true);
      for (const [otherIndex, otherSlot] of layout.heroBoard.slotRects.entries()) {
        if (otherIndex === index) continue;
        expect(rectsOverlap(
          selectedBounds,
          getHeroSlotSelectedOutlineBounds(otherSlot),
        )).toBe(false);
      }
    }
  });

  it('第二排只改变纵坐标，横向格位、索引和HitArea规则保持不变', () => {
    expect(layout.heroBoard.slotCenters.map((center) => center.x)).toEqual(
      PROTOTYPE_LEVEL.heroSlots.map((slot) => slot.x - UI_METRICS.layout.commandDeck.x),
    );
    for (let column = 0; column < 5; column += 1) {
      expect(layout.heroBoard.slotCenters[column]!.x).toBe(
        layout.heroBoard.slotCenters[column + 5]!.x,
      );
    }
    expect(layout.heroBoard.slotRects.map((_, index) => index)).toEqual(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    );
  });

  it('选中英雄信息条位于中央栏顶部且不与两排格位或最大英雄视觉相交', () => {
    expect(containsRect(layout.columns.center, layout.heroBoard.selectedInfoBar))
      .toBe(true);
    expect(layout.heroBoard.selectedInfoBar.height).toBe(28);
    for (const slot of layout.heroBoard.slotRects) {
      expect(rectsOverlap(slot, layout.heroBoard.selectedInfoBar)).toBe(false);
    }
    for (const center of layout.heroBoard.slotCenters) {
      for (const definition of HERO_VISUAL_DEFINITIONS) {
        const maximumDisplaySize = Math.min(
          Math.round(
            definition.displaySize * deriveHeroStarPresentation(4).mainSizeScale,
          ),
          UI_METRICS.slot.heroMaximumDisplaySize,
        );
        expect(
          rectsOverlap(
            getHeroRuntimeVisibleBounds(
              getHeroVisualBounds(center, definition, maximumDisplaySize),
            ),
            layout.heroBoard.selectedInfoBar,
          ),
        ).toBe(false);
      }
    }
  });

  it('右侧抽屉覆盖战场但不改变战场与指挥台权威矩形', () => {
    const drawer = UI_METRICS.layout.rightDrawer;
    const drawerBounds = {
      x: drawer.x,
      y: drawer.y,
      width: drawer.width,
      height: drawer.height,
    };
    expect(containsRect(UI_METRICS.layout.battlefield, drawerBounds)).toBe(true);
    expect(rectsOverlap(drawerBounds, UI_METRICS.layout.commandDeck)).toBe(false);
    expect(UI_METRICS.layout.battlefield).toEqual({
      x: 16,
      y: 66,
      width: 1_248,
      height: 434,
    });
  });

  it('四名正式英雄保持78～80px，并允许12～20px受控向上溢出', () => {
    const runtimeVisuals = HERO_VISUAL_DEFINITIONS.filter(
      (definition) => definition.heroId !== 'forest-summoner',
    );
    for (const definition of runtimeVisuals) {
      expect(definition.displaySize).toBeGreaterThanOrEqual(78);
      expect(definition.displaySize).toBeLessThanOrEqual(80);
      const maximumDisplaySize = Math.min(
        Math.round(
          definition.displaySize * deriveHeroStarPresentation(4).mainSizeScale,
        ),
        UI_METRICS.slot.heroMaximumDisplaySize,
      );
      for (const [index, center] of layout.heroBoard.slotCenters.entries()) {
        const visualBounds = getHeroVisualBounds(
          center,
          definition,
          maximumDisplaySize,
        );
        const slotRect = layout.heroBoard.slotRects[index]!;
        expect(containsRect(layout.heroBoard.visualBounds, visualBounds)).toBe(true);
        const upwardOverflow = slotRect.y - visualBounds.y;
        expect(upwardOverflow).toBeGreaterThanOrEqual(12);
        expect(upwardOverflow).toBeLessThanOrEqual(20);
        expect(getHeroForegroundLipBounds(center).height)
          .toBeLessThanOrEqual(6);
        for (const [otherIndex, otherSlot] of layout.heroBoard.slotRects.entries()) {
          if (otherIndex === index) continue;
          expect(rectsOverlap(visualBounds, getHeroSlotCoreBounds(otherSlot))).toBe(false);
        }
      }
    }
  });

  it('指挥台延伸到画布底边但不产生页面外溢', () => {
    expect(UI_METRICS.layout.commandDeck.y + UI_METRICS.layout.commandDeck.height)
      .toBe(UI_METRICS.canvas.height);
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

  it('程序fallback尺寸不随84px正式纹理上限放大', () => {
    expect(
      resolveHeroBodyScale(
        'programmatic',
        78,
        28,
        28,
        UI_METRICS.slot.heroMaximumDisplaySize,
      ),
    ).toBe(1);
  });

  it('uiDebug默认关闭且只在开发环境显式开启', () => {
    expect(isUiDebugEnabled('', true)).toBe(false);
    expect(isUiDebugEnabled('?uiDebug=0', true)).toBe(false);
    expect(isUiDebugEnabled('?uiDebug=1', false)).toBe(true);
    expect(isUiDebugEnabled('?uiDebug=1', true)).toBe(true);
  });
});

function expectAligned(first: UiRect, second: UiRect): void {
  expect(first.y).toBe(second.y);
  expect(first.height).toBe(second.height);
}

function verticalOverlap(first: UiRect, second: UiRect): number {
  return Math.max(
    0,
    Math.min(first.y + first.height, second.y + second.height) -
      Math.max(first.y, second.y),
  );
}

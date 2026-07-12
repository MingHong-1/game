import Phaser from 'phaser';

import {
  containsRect,
  rectsOverlap,
  type BottomCommandLayout,
  type UiRect,
} from '../layout/BottomCommandLayout';
import { UI_METRICS } from '../theme/uiMetrics';
import { UI_COLORS, toCssColor } from '../theme/uiTheme';
import { UI_FONT_FAMILY, UI_FONT_SIZES } from '../theme/uiTypography';
import { HERO_VISUAL_DEFINITIONS } from '../../data/visualDefinitions';
import { deriveHeroStarPresentation } from '../../presentation/HeroStarPresentationModel';
import {
  getHeroForegroundLipBounds,
  getHeroBaseAuraBounds,
  getHeroRuntimeVisibleBounds,
  getHeroSlotHoverBounds,
  getHeroSlotSelectedMarkerBounds,
  getHeroSlotSelectedOutlineBounds,
  getHeroSlotCoreBounds,
  getHeroVisualBounds,
} from '../state/HeroSlotLayerModel';

export function isUiDebugEnabled(
  search: string,
  _isDevelopment: boolean,
): boolean {
  return new URLSearchParams(search).get('uiDebug') === '1';
}

export class UiDebugOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly selectionGraphics: Phaser.GameObjects.Graphics;
  private readonly selectionText: Phaser.GameObjects.Text;
  private readonly instanceText: Phaser.GameObjects.Text;
  private readonly layout: BottomCommandLayout;
  private readonly spacingSummary: string;

  public constructor(
    scene: Phaser.Scene,
    layout: BottomCommandLayout,
  ) {
    this.layout = layout;
    this.spacingSummary = createSpacingSummary(layout);
    const deck = UI_METRICS.layout.commandDeck;
    this.graphics = scene.add.graphics().setDepth(UI_METRICS.depth.debug + 1);
    this.graphics.setPosition(deck.x, deck.y);
    this.selectionGraphics = scene.add.graphics().setDepth(UI_METRICS.depth.debug + 2);
    this.selectionGraphics.setPosition(deck.x, deck.y);
    this.selectionText = scene.add
      .text(
        deck.x + layout.columns.center.x + UI_METRICS.spacing.internal,
        deck.y + layout.columns.center.y + layout.columns.center.height - 14,
        `${this.spacingSummary}  LIP 8px/O2px  SELECTED --  HOVER --`,
        {
          color: toCssColor(UI_COLORS.slotSelectedOutline),
          fontFamily: UI_FONT_FAMILY,
          fontSize: `${UI_FONT_SIZES.caption}px`,
        },
      )
      .setDepth(UI_METRICS.depth.debug + 2)
      .setOrigin(0, 0.5);
    this.instanceText = scene.add
      .text(
        deck.x + layout.columns.center.x + UI_METRICS.spacing.internal,
        deck.y + layout.columns.center.y + layout.columns.center.height - 34,
        'INSTANCES --',
        {
          color: toCssColor(UI_COLORS.textSecondary),
          fontFamily: UI_FONT_FAMILY,
          fontSize: `${UI_FONT_SIZES.caption}px`,
          wordWrap: {
            width: layout.columns.center.width - UI_METRICS.spacing.module,
          },
        },
      )
      .setDepth(UI_METRICS.depth.debug + 2)
      .setOrigin(0, 0.5);
    this.drawColumns(layout);
    this.drawComponents(layout);
    this.drawHeroBounds(layout);
    this.drawBaselines(layout);
    this.drawRightDrawer();
    this.drawOverlapWarnings(layout);
  }

  public destroy(): void {
    this.graphics.destroy();
    this.selectionGraphics.destroy();
    this.selectionText.destroy();
    this.instanceText.destroy();
  }

  public updateHeroInteraction(
    instanceId: string | null,
    slotIndex: number | null,
    hoveredSlotIndex: number | null,
    slotInstanceIds: readonly (string | null)[],
    slotStarLevels: readonly (number | null)[],
  ): void {
    this.selectionGraphics.clear();
    const selectionMatches = instanceId === null
      ? slotIndex === null
      : slotIndex !== null && slotInstanceIds[slotIndex] === instanceId;
    const selectedAndHovered = slotIndex !== null && slotIndex === hoveredSlotIndex;
    const selectedMaximumStar = slotIndex !== null && slotStarLevels[slotIndex] === 4;
    const combination = [
      instanceId === null ? null : 'selected',
      selectedAndHovered ? 'hovered' : null,
      selectedMaximumStar ? 'maximumStar' : null,
    ].filter((state): state is string => state !== null).join('+') || 'normal';
    this.selectionText.setText(
      `${this.spacingSummary}  LIP ${UI_METRICS.slot.foregroundLipBottomInset}px/O2px` +
        `  SELECTED ${instanceId ?? '--'}${slotIndex === null ? '' : ` S${slotIndex + 1}`}` +
        `  HOVER ${hoveredSlotIndex === null ? '--' : `S${hoveredSlotIndex + 1}`}` +
        `  MODE ${combination}`,
    );
    this.selectionText.setColor(
      toCssColor(selectionMatches ? UI_COLORS.slotSelectedOutline : UI_COLORS.coreDanger),
    );
    this.instanceText.setText(
      `INSTANCES ${slotInstanceIds.map((id, index) => `S${index + 1}=${id ?? '--'}`).join('  ')}`,
    );
    if (hoveredSlotIndex !== null) {
      const hoveredSlot = this.layout.heroBoard.slotRects[hoveredSlotIndex];
      if (hoveredSlot !== undefined) {
        const hoverStyle = getHeroSlotHoverBounds(hoveredSlot);
        this.strokeOn(
          this.selectionGraphics,
          hoverStyle,
          UI_COLORS.energy,
          0.4,
          1,
        );
      }
    }
    if (slotIndex === null) return;
    const slot = this.layout.heroBoard.slotRects[slotIndex];
    if (slot === undefined) return;
    this.strokeOn(
      this.selectionGraphics,
      getHeroSlotSelectedOutlineBounds(slot),
      UI_COLORS.slotSelectedOutline,
      1,
      2,
    );
    this.strokeOn(
      this.selectionGraphics,
      getHeroSlotSelectedMarkerBounds(slot),
      UI_COLORS.slotSelectedMarker,
      1,
      1,
    );
  }

  private drawColumns(layout: BottomCommandLayout): void {
    this.stroke(layout.bounds, UI_COLORS.white, 0.74, 2);
    this.stroke(layout.columns.left, UI_COLORS.energy, 0.9, 2);
    this.stroke(layout.columns.center, UI_COLORS.star, 0.9, 2);
    this.stroke(layout.columns.right, UI_COLORS.primary, 0.9, 2);
  }

  private drawComponents(layout: BottomCommandLayout): void {
    for (const component of [
      layout.left.energy,
      layout.left.summonCost,
      layout.left.skillStatus,
      layout.left.skillPreview,
      layout.left.helperText,
      layout.right.formation,
      layout.right.expansionProgress,
      layout.right.summon,
      layout.right.merge,
      layout.right.rebuild,
      layout.right.helperText,
      layout.heroBoard.selectedInfoBar,
      layout.heroBoard.bottomSafeArea,
      layout.heroBoard.spacingAreas.infoToFirstRow,
      layout.heroBoard.spacingAreas.betweenRows,
      layout.heroBoard.spacingAreas.secondRowToBottom,
    ]) {
      this.stroke(component, UI_COLORS.primary, 0.62, 1);
    }
  }

  private drawRightDrawer(): void {
    const deck = UI_METRICS.layout.commandDeck;
    const drawer = UI_METRICS.layout.rightDrawer;
    const rectangle = {
      x: drawer.x - deck.x,
      y: drawer.y - deck.y,
      width: drawer.width,
      height: drawer.height,
    };
    this.stroke(rectangle, UI_COLORS.energy, 0.82, 2);
    const closeWidth = 40;
    const tabGap = UI_METRICS.spacing.micro;
    const tabCount = 3;
    const availableWidth = rectangle.width - drawer.bodyPadding * 2 - closeWidth - tabGap;
    const tabWidth = (availableWidth - tabGap * (tabCount - 1)) / tabCount;
    for (let index = 0; index < tabCount; index += 1) {
      this.stroke(
        {
          x: rectangle.x + drawer.bodyPadding + index * (tabWidth + tabGap),
          y: rectangle.y + drawer.tabTop,
          width: tabWidth,
          height: drawer.tabHeight,
        },
        UI_COLORS.primary,
        0.7,
        1,
      );
    }
    this.stroke(
      {
        x: rectangle.x + drawer.bodyPadding,
        y: rectangle.y + drawer.bodyTop,
        width: rectangle.width - drawer.bodyPadding * 2,
        height: rectangle.height - drawer.bodyTop - drawer.bodyPadding,
      },
      UI_COLORS.textSecondary,
      0.5,
      1,
    );
  }

  private drawOverlapWarnings(layout: BottomCommandLayout): void {
    for (let column = 0; column < 5; column += 1) {
      const secondRowSlot = layout.heroBoard.slotRects[column]!;
      const firstRowSlot = layout.heroBoard.slotRects[column + 5]!;
      if (rectsOverlap(firstRowSlot, layout.heroBoard.selectedInfoBar)) {
        this.stroke(firstRowSlot, UI_COLORS.coreDanger, 0.9, 2);
      }
      if (rectsOverlap(firstRowSlot, secondRowSlot)) {
        this.stroke(firstRowSlot, UI_COLORS.coreDanger, 0.9, 2);
        this.stroke(secondRowSlot, UI_COLORS.coreDanger, 0.9, 2);
      }
      for (const firstRowStateBounds of [
        getHeroSlotSelectedOutlineBounds(firstRowSlot),
        getHeroSlotSelectedMarkerBounds(firstRowSlot),
      ]) {
        if (rectsOverlap(firstRowStateBounds, layout.heroBoard.selectedInfoBar)) {
          this.stroke(firstRowStateBounds, UI_COLORS.coreDanger, 0.9, 2);
        }
      }
      for (const firstRowFloorVisual of [
        createBaseAuraBounds(layout.heroBoard.slotCenters[column + 5]!),
        createMaximumAuraBounds(layout.heroBoard.slotCenters[column + 5]!),
      ]) {
        if (rectsOverlap(firstRowFloorVisual, getHeroSlotCoreBounds(secondRowSlot))) {
          this.stroke(firstRowFloorVisual, UI_COLORS.coreDanger, 0.9, 2);
        }
      }
    }
    const visualBoundsBySlot = layout.heroBoard.slotCenters.map((center) =>
      createMaximumHeroVisibleBounds(center),
    );
    for (const [index, visualBounds] of visualBoundsBySlot.entries()) {
      if (rectsOverlap(visualBounds, layout.heroBoard.selectedInfoBar)) {
        const overlapTop = Math.max(
          visualBounds.y,
          layout.heroBoard.selectedInfoBar.y,
        );
        this.stroke(
          {
            x: Math.max(visualBounds.x, layout.heroBoard.selectedInfoBar.x),
            y: overlapTop,
            width: Math.min(
              visualBounds.x + visualBounds.width,
              layout.heroBoard.selectedInfoBar.x + layout.heroBoard.selectedInfoBar.width,
            ) - Math.max(visualBounds.x, layout.heroBoard.selectedInfoBar.x),
            height: Math.min(
              visualBounds.y + visualBounds.height,
              layout.heroBoard.selectedInfoBar.y + layout.heroBoard.selectedInfoBar.height,
            ) - overlapTop,
          },
          UI_COLORS.coreWarning,
          0.55,
          1,
        );
      }
      for (const [otherIndex, otherSlot] of layout.heroBoard.slotRects.entries()) {
        if (otherIndex === index) continue;
        const otherCore = getHeroSlotCoreBounds(otherSlot);
        if (!rectsOverlap(visualBounds, otherCore)) continue;
        this.stroke(otherCore, UI_COLORS.coreDanger, 0.88, 2);
      }
      if (index < 5) {
        for (const lowerVisual of [
          visualBounds,
          createMaximumAuraBounds(layout.heroBoard.slotCenters[index]!),
          getHeroSlotSelectedOutlineBounds(layout.heroBoard.slotRects[index]!),
          getHeroSlotSelectedMarkerBounds(layout.heroBoard.slotRects[index]!),
        ]) {
          if (rectsOverlap(lowerVisual, layout.heroBoard.bottomSafeArea)) {
            this.stroke(lowerVisual, UI_COLORS.coreDanger, 0.9, 2);
          }
        }
      }
      const slot = layout.heroBoard.slotRects[index]!;
      const center = layout.heroBoard.slotCenters[index]!;
      const selectedBounds = getHeroSlotSelectedOutlineBounds(slot);
      for (const [otherIndex, otherSlot] of layout.heroBoard.slotRects.entries()) {
        if (otherIndex === index) continue;
        if (rectsOverlap(
          selectedBounds,
          getHeroSlotSelectedOutlineBounds(otherSlot),
        )) {
          this.stroke(selectedBounds, UI_COLORS.coreDanger, 0.96, 2);
        }
      }
      for (const stateBounds of [
        selectedBounds,
        getHeroSlotSelectedMarkerBounds(slot),
      ]) {
        if (!containsRect(layout.heroBoard.visualBounds, stateBounds)) {
          this.stroke(stateBounds, UI_COLORS.coreDanger, 0.9, 2);
        }
      }
      const lipBounds = createForegroundLipBounds(center);
      const lipBottomGap = slot.y + slot.height -
        (lipBounds.y + lipBounds.height);
      const baseAuraBounds = createBaseAuraBounds(center);
      const maximumAuraBounds = createMaximumAuraBounds(center);
      if (
        !containsRect(slot, lipBounds) ||
        lipBottomGap < 7 ||
        lipBottomGap > 10 ||
        verticalOverlap(lipBounds, baseAuraBounds) > 2 ||
        verticalOverlap(lipBounds, maximumAuraBounds) > 2 ||
        rectsOverlap(lipBounds, visualBounds) ||
        verticalOverlap(lipBounds, createMaximumEchoVisibleBounds(center)) > 2
      ) {
        this.stroke(lipBounds, UI_COLORS.coreDanger, 0.96, 2);
      }
    }
  }

  private drawHeroBounds(layout: BottomCommandLayout): void {
    this.stroke(layout.heroBoard.visualBounds, UI_COLORS.star, 0.45, 1);
    for (const [index, slot] of layout.heroBoard.slotRects.entries()) {
      this.stroke(slot, UI_COLORS.star, 0.78, 1);
      const center = layout.heroBoard.slotCenters[index];
      if (center === undefined) continue;
      this.stroke(createMaximumHeroBounds(center), UI_COLORS.coreHealthy, 0.7, 1);
      this.stroke(
        createMaximumHeroVisibleBounds(center),
        UI_COLORS.textPrimary,
        0.74,
        1,
      );
      this.stroke(createMaximumEchoBounds(center), UI_COLORS.energy, 0.52, 1);
      this.stroke(createForegroundLipBounds(center), UI_COLORS.coreWarning, 0.88, 1);
      this.stroke(createBaseAuraBounds(center), UI_COLORS.primary, 0.58, 1);
      this.stroke(createMaximumAuraBounds(center), UI_COLORS.star, 0.58, 1);
      this.stroke(
        getHeroSlotHoverBounds(slot),
        UI_COLORS.energy,
        0.4,
        1,
      );
      this.stroke(
        getHeroSlotSelectedOutlineBounds(slot),
        UI_COLORS.slotSelectedOutline,
        0.72,
        1,
      );
      this.stroke(
        getHeroSlotSelectedMarkerBounds(slot),
        UI_COLORS.slotSelectedMarker,
        0.72,
        1,
      );
      this.stroke(
        {
          x: slot.x + 1,
          y: slot.y + 1,
          width: slot.width - 2,
          height: slot.height - 2,
        },
        UI_COLORS.white,
        0.48,
        1,
      );
    }
  }

  private drawBaselines(layout: BottomCommandLayout): void {
    this.graphics.lineStyle(1, UI_COLORS.white, 0.34);
    for (const y of layout.rowBaselines) {
      this.graphics.beginPath();
      this.graphics.moveTo(0, y);
      this.graphics.lineTo(layout.bounds.width, y);
      this.graphics.strokePath();
    }
  }

  private stroke(
    rectangle: UiRect,
    color: number,
    alpha: number,
    width: number,
  ): void {
    this.strokeOn(this.graphics, rectangle, color, alpha, width);
  }

  private strokeOn(
    graphics: Phaser.GameObjects.Graphics,
    rectangle: UiRect,
    color: number,
    alpha: number,
    width: number,
  ): void {
    graphics.lineStyle(width, color, alpha);
    graphics.strokeRect(
      rectangle.x,
      rectangle.y,
      rectangle.width,
      rectangle.height,
    );
  }
}

const RUNTIME_HERO_VISUALS = HERO_VISUAL_DEFINITIONS.filter(
  (definition) => definition.heroId !== 'forest-summoner',
);

function createMaximumHeroBounds(center: { readonly x: number; readonly y: number }): UiRect {
  const bounds = RUNTIME_HERO_VISUALS.map((definition) =>
    getHeroVisualBounds(
      center,
      definition,
      Math.min(
        Math.round(definition.displaySize * deriveHeroStarPresentation(4).mainSizeScale),
        UI_METRICS.slot.heroMaximumDisplaySize,
      ),
    ),
  );
  return unionRects(bounds);
}

function createMaximumHeroVisibleBounds(
  center: { readonly x: number; readonly y: number },
): UiRect {
  const bounds = RUNTIME_HERO_VISUALS.map((definition) => {
    const fullBounds = getHeroVisualBounds(
      center,
      definition,
      Math.min(
        Math.round(definition.displaySize * deriveHeroStarPresentation(4).mainSizeScale),
        UI_METRICS.slot.heroMaximumDisplaySize,
      ),
    );
    return getHeroRuntimeVisibleBounds(fullBounds);
  });
  return unionRects(bounds);
}

function createMaximumEchoBounds(center: { readonly x: number; readonly y: number }): UiRect {
  const echoes = deriveHeroStarPresentation(3).echoes;
  const bounds = RUNTIME_HERO_VISUALS.flatMap((definition) =>
    echoes.map((echo) =>
      getHeroVisualBounds(
        { x: center.x + echo.offsetX, y: center.y + echo.offsetY },
        definition,
        Math.min(
          Math.round(definition.displaySize * echo.sizeScale),
          UI_METRICS.slot.heroEchoDisplaySize,
        ),
      ),
    ),
  );
  return unionRects(bounds);
}

function createMaximumEchoVisibleBounds(
  center: { readonly x: number; readonly y: number },
): UiRect {
  const echoes = deriveHeroStarPresentation(3).echoes;
  const bounds = RUNTIME_HERO_VISUALS.flatMap((definition) =>
    echoes.map((echo) =>
      getHeroRuntimeVisibleBounds(
        getHeroVisualBounds(
          { x: center.x + echo.offsetX, y: center.y + echo.offsetY },
          definition,
          Math.min(
            Math.round(definition.displaySize * echo.sizeScale),
            UI_METRICS.slot.heroEchoDisplaySize,
          ),
        ),
      ),
    ),
  );
  return unionRects(bounds);
}

function createForegroundLipBounds(center: { readonly x: number; readonly y: number }): UiRect {
  return getHeroForegroundLipBounds(center);
}

function createBaseAuraBounds(center: { readonly x: number; readonly y: number }): UiRect {
  return unionRects(
    RUNTIME_HERO_VISUALS.map((definition) =>
      getHeroBaseAuraBounds(center, definition.slotOffset.y, false),
    ),
  );
}

function createMaximumAuraBounds(center: { readonly x: number; readonly y: number }): UiRect {
  return unionRects(
    RUNTIME_HERO_VISUALS.map((definition) =>
      getHeroBaseAuraBounds(center, definition.slotOffset.y, true),
    ),
  );
}

function unionRects(rectangles: readonly UiRect[]): UiRect {
  const first = rectangles[0];
  if (first === undefined) throw new Error('调试边界不能为空');
  const left = Math.min(...rectangles.map((rectangle) => rectangle.x));
  const top = Math.min(...rectangles.map((rectangle) => rectangle.y));
  const right = Math.max(...rectangles.map((rectangle) => rectangle.x + rectangle.width));
  const bottom = Math.max(...rectangles.map((rectangle) => rectangle.y + rectangle.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function createSpacingSummary(layout: BottomCommandLayout): string {
  const spacing = layout.heroBoard.spacingAreas;
  return `GAPS ${spacing.infoToFirstRow.height}/${spacing.betweenRows.height}/${spacing.secondRowToBottom.height}`;
}

function verticalOverlap(first: UiRect, second: UiRect): number {
  return Math.max(
    0,
    Math.min(first.y + first.height, second.y + second.height) -
      Math.max(first.y, second.y),
  );
}

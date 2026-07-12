import type { PointDefinition } from '../../battle/definitions';
import { UI_METRICS } from '../theme/uiMetrics';

export interface UiPoint {
  readonly x: number;
  readonly y: number;
}

export interface UiRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface BottomCommandLayout {
  readonly bounds: UiRect;
  readonly columns: {
    readonly left: UiRect;
    readonly center: UiRect;
    readonly right: UiRect;
  };
  readonly sectionLabels: {
    readonly left: UiPoint;
    readonly center: UiPoint;
    readonly right: UiPoint;
  };
  readonly left: {
    readonly energy: UiRect;
    readonly summonCost: UiRect;
    readonly skillStatus: UiRect;
    readonly skillPreview: UiRect;
    readonly helperText: UiRect;
  };
  readonly heroBoard: {
    readonly slotCenters: readonly UiPoint[];
    readonly slotRects: readonly UiRect[];
    readonly visualBounds: UiRect;
  };
  readonly right: {
    readonly formation: UiRect;
    readonly expansionProgress: UiRect;
    readonly summon: UiRect;
    readonly merge: UiRect;
    readonly rebuild: UiRect;
    readonly helperText: UiRect;
  };
  readonly rowBaselines: readonly number[];
}

export function createBottomCommandLayout(
  heroSlots: readonly PointDefinition[],
): BottomCommandLayout {
  const deck = UI_METRICS.layout.commandDeck;
  const metrics = UI_METRICS.layout.bottomCommand;
  const contentWidth = deck.width - metrics.paddingX * 2;
  const centerWidth =
    contentWidth -
    metrics.leftColumnWidth -
    metrics.rightColumnWidth -
    metrics.columnGap * 2;
  const columnHeight = deck.height - metrics.paddingY * 2;
  const left = rect(
    metrics.paddingX,
    metrics.paddingY,
    metrics.leftColumnWidth,
    columnHeight,
  );
  const center = rect(
    right(left) + metrics.columnGap,
    metrics.paddingY,
    centerWidth,
    columnHeight,
  );
  const rightColumn = rect(
    right(center) + metrics.columnGap,
    metrics.paddingY,
    metrics.rightColumnWidth,
    columnHeight,
  );
  const pairedCardWidth =
    (left.width - UI_METRICS.spacing.internal) / 2;
  const statHeight = UI_METRICS.statCard.height;
  const normalHeight = UI_METRICS.button.height;
  const leftStatTop = left.y + metrics.statRowTop;
  const rightStatTop = rightColumn.y + metrics.statRowTop;
  const slotCenters = heroSlots.map((slot) => ({
    x: slot.x - deck.x,
    y: slot.y - deck.y,
  }));
  const slotRects = slotCenters.map((point) =>
    rect(
      point.x - UI_METRICS.slot.width / 2,
      point.y + UI_METRICS.slot.backgroundTop,
      UI_METRICS.slot.width,
      UI_METRICS.slot.height,
    ),
  );

  return Object.freeze({
    bounds: rect(0, 0, deck.width, deck.height),
    columns: Object.freeze({ left, center, right: rightColumn }),
    sectionLabels: Object.freeze({
      left: labelPoint(left),
      center: labelPoint(center),
      right: labelPoint(rightColumn),
    }),
    left: Object.freeze({
      energy: rect(left.x, leftStatTop, pairedCardWidth, statHeight),
      summonCost: rect(
        left.x + pairedCardWidth + UI_METRICS.spacing.internal,
        leftStatTop,
        pairedCardWidth,
        statHeight,
      ),
      skillStatus: rect(
        left.x,
        left.y + metrics.secondaryRowTop,
        left.width,
        statHeight,
      ),
      skillPreview: rect(
        left.x,
        left.y + metrics.secondaryButtonTop,
        left.width,
        normalHeight,
      ),
      helperText: rect(
        left.x,
        left.y + metrics.helperTextTop,
        left.width,
        metrics.sectionLabelHeight,
      ),
    }),
    heroBoard: Object.freeze({
      slotCenters: Object.freeze(slotCenters),
      slotRects: Object.freeze(slotRects),
      visualBounds: rect(
        center.x,
        -UI_METRICS.spacing.section,
        center.width,
        deck.height + UI_METRICS.spacing.section,
      ),
    }),
    right: Object.freeze({
      formation: rect(
        rightColumn.x,
        rightStatTop,
        pairedCardWidth,
        statHeight,
      ),
      expansionProgress: rect(
        rightColumn.x + pairedCardWidth + UI_METRICS.spacing.internal,
        rightStatTop,
        pairedCardWidth,
        statHeight,
      ),
      summon: rect(
        rightColumn.x,
        rightColumn.y + metrics.primaryButtonTop,
        rightColumn.width,
        UI_METRICS.button.primaryHeight,
      ),
      merge: rect(
        rightColumn.x,
        rightColumn.y + metrics.actionRowTop,
        pairedCardWidth,
        normalHeight,
      ),
      rebuild: rect(
        rightColumn.x + pairedCardWidth + UI_METRICS.spacing.internal,
        rightColumn.y + metrics.actionRowTop,
        pairedCardWidth,
        normalHeight,
      ),
      helperText: rect(
        rightColumn.x,
        rightColumn.y + metrics.primaryButtonTop +
          UI_METRICS.button.primaryHeight + UI_METRICS.spacing.micro,
        rightColumn.width,
        metrics.sectionLabelHeight,
      ),
    }),
    rowBaselines: Object.freeze([
      leftStatTop + statHeight / 2,
      left.y + metrics.secondaryRowTop + statHeight / 2,
      left.y + metrics.secondaryButtonTop + normalHeight / 2,
      rightColumn.y + metrics.primaryButtonTop +
        UI_METRICS.button.primaryHeight / 2,
      rightColumn.y + metrics.actionRowTop + normalHeight / 2,
    ]),
  });
}

export function centerOf(rectangle: UiRect): UiPoint {
  return {
    x: rectangle.x + rectangle.width / 2,
    y: rectangle.y + rectangle.height / 2,
  };
}

export function containsRect(container: UiRect, child: UiRect): boolean {
  return child.x >= container.x &&
    child.y >= container.y &&
    right(child) <= right(container) &&
    bottom(child) <= bottom(container);
}

export function rectsOverlap(first: UiRect, second: UiRect): boolean {
  return first.x < right(second) &&
    right(first) > second.x &&
    first.y < bottom(second) &&
    bottom(first) > second.y;
}

function rect(x: number, y: number, width: number, height: number): UiRect {
  return Object.freeze({ x, y, width, height });
}

function labelPoint(column: UiRect): UiPoint {
  return Object.freeze({
    x: column.x + UI_METRICS.spacing.compact,
    y: column.y + UI_METRICS.layout.bottomCommand.sectionLabelHeight / 2,
  });
}

function right(rectangle: UiRect): number {
  return rectangle.x + rectangle.width;
}

function bottom(rectangle: UiRect): number {
  return rectangle.y + rectangle.height;
}

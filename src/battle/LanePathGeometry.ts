import type {
  LaneLayoutDefinition,
  PointDefinition,
} from './definitions';
import { PathGeometry } from './PathGeometry';

const MIDDLE_PROGRESS = 0.55;
const EDGE_PADDING_RATIO = 0.35;

export interface LanePosition extends PointDefinition {
  readonly laneIndex: number;
  readonly laneOffset: number;
  readonly pathProgress: number;
}

export interface CorridorSection {
  readonly center: PointDefinition;
  readonly left: PointDefinition;
  readonly right: PointDefinition;
  readonly width: number;
}

function interpolate(start: number, end: number, ratio: number): number {
  return start + (end - start) * ratio;
}

export class LanePathGeometry {
  public readonly path: PathGeometry;

  public constructor(
    pathPoints: readonly PointDefinition[],
    public readonly layout: LaneLayoutDefinition,
  ) {
    this.path = new PathGeometry(pathPoints);
    this.validateLayout();
  }

  public get laneCount(): number {
    return this.layout.laneCount;
  }

  public get centerLaneIndex(): number {
    return Math.floor(this.layout.laneCount / 2);
  }

  public get totalDistance(): number {
    return this.path.totalDistance;
  }

  public getLaneIndices(): readonly number[] {
    return Array.from({ length: this.laneCount }, (_, index) => index);
  }

  public getCorridorWidth(pathProgress: number): number {
    const progress = this.clampProgress(pathProgress);
    if (progress <= MIDDLE_PROGRESS) {
      return interpolate(
        this.layout.corridorWidthStart,
        this.layout.corridorWidthMiddle,
        progress / MIDDLE_PROGRESS,
      );
    }
    return interpolate(
      this.layout.corridorWidthMiddle,
      this.layout.corridorWidthEnd,
      (progress - MIDDLE_PROGRESS) / (1 - MIDDLE_PROGRESS),
    );
  }

  public getLaneCenterOffset(
    laneIndex: number,
    pathProgress: number,
  ): number {
    this.assertLaneIndex(laneIndex);
    const center = (this.laneCount - 1) / 2;
    const baseOffset = (laneIndex - center) * this.layout.laneSpacing;
    const maxBaseOffset = Math.max(center, this.laneCount - 1 - center) *
      this.layout.laneSpacing;
    if (maxBaseOffset === 0) return 0;

    const halfWidth = this.getCorridorWidth(pathProgress) / 2;
    const edgePadding = this.layout.laneSpacing * EDGE_PADDING_RATIO;
    const scale = Math.min(1, Math.max(0, halfWidth - edgePadding) / maxBaseOffset);
    return baseOffset * scale;
  }

  public positionAt(
    pathDistance: number,
    laneIndex: number,
    localJitter = 0,
  ): LanePosition {
    if (!Number.isFinite(pathDistance)) {
      throw new RangeError('道路距离必须是有限数字');
    }
    return this.positionAtProgress(
      pathDistance / this.totalDistance,
      laneIndex,
      localJitter,
    );
  }

  /** 直接将权威 pathProgress 映射为世界坐标，不让曲线长度参与推进速度。 */
  public positionAtProgress(
    pathProgress: number,
    laneIndex: number,
    localJitter = 0,
  ): LanePosition {
    if (!Number.isFinite(localJitter)) {
      throw new RangeError('通道局部偏移必须是有限数字');
    }
    const progress = this.clampProgress(pathProgress);
    const sample = this.path.sampleAt(progress * this.totalDistance);
    const laneCenterOffset = this.getLaneCenterOffset(laneIndex, progress);
    const halfWidth = this.getCorridorWidth(progress) / 2;
    const edgePadding = this.layout.laneSpacing * EDGE_PADDING_RATIO;
    const maxOffset = Math.max(0, halfWidth - edgePadding);
    const laneOffset = Math.min(
      maxOffset,
      Math.max(-maxOffset, laneCenterOffset + localJitter),
    );
    return {
      x: sample.x + sample.normalX * laneOffset,
      y: sample.y + sample.normalY * laneOffset,
      laneIndex,
      laneOffset,
      pathProgress: progress,
    };
  }

  public getCorridorSection(
    pathProgress: number,
    extraWidth = 0,
  ): CorridorSection {
    if (!Number.isFinite(extraWidth)) {
      throw new RangeError('走廊额外宽度必须是有限数字');
    }
    const progress = this.clampProgress(pathProgress);
    const sample = this.path.sampleAt(progress * this.totalDistance);
    const width = Math.max(0, this.getCorridorWidth(progress) + extraWidth);
    const halfWidth = width / 2;
    return {
      center: { x: sample.x, y: sample.y },
      left: {
        x: sample.x - sample.normalX * halfWidth,
        y: sample.y - sample.normalY * halfWidth,
      },
      right: {
        x: sample.x + sample.normalX * halfWidth,
        y: sample.y + sample.normalY * halfWidth,
      },
      width,
    };
  }

  private validateLayout(): void {
    if (
      !Number.isSafeInteger(this.layout.laneCount) ||
      this.layout.laneCount < 3 ||
      this.layout.laneCount > 7
    ) {
      throw new RangeError('通道数量必须是 3～7 的整数');
    }
    for (const [name, value] of [
      ['corridorWidthStart', this.layout.corridorWidthStart],
      ['corridorWidthMiddle', this.layout.corridorWidthMiddle],
      ['corridorWidthEnd', this.layout.corridorWidthEnd],
      ['laneSpacing', this.layout.laneSpacing],
    ] as const) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`${name} 必须是正数`);
      }
    }
    if (!Number.isFinite(this.layout.localJitter) || this.layout.localJitter < 0) {
      throw new RangeError('localJitter 不能是负数');
    }
  }

  private assertLaneIndex(laneIndex: number): void {
    if (
      !Number.isSafeInteger(laneIndex) ||
      laneIndex < 0 ||
      laneIndex >= this.laneCount
    ) {
      throw new RangeError(`通道索引超出范围：${laneIndex}`);
    }
  }

  private clampProgress(pathProgress: number): number {
    if (!Number.isFinite(pathProgress)) {
      throw new RangeError('道路进度必须是有限数字');
    }
    return Math.min(1, Math.max(0, pathProgress));
  }
}

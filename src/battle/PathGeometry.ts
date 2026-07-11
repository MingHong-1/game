import type { PointDefinition } from './definitions';

interface PathSegment {
  readonly start: PointDefinition;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly startDistance: number;
  readonly length: number;
  readonly startTangentX: number;
  readonly startTangentY: number;
  readonly endTangentX: number;
  readonly endTangentY: number;
}

interface UnitVector {
  readonly x: number;
  readonly y: number;
}

function normalizeVector(x: number, y: number, fallback: UnitVector): UnitVector {
  const length = Math.hypot(x, y);
  if (length <= Number.EPSILON) return fallback;
  return { x: x / length, y: y / length };
}

export interface PathSample extends PointDefinition {
  readonly tangentX: number;
  readonly tangentY: number;
  /** 沿路径前进方向的右侧法线。 */
  readonly normalX: number;
  readonly normalY: number;
}

function assertFinitePoint(point: PointDefinition, index: number): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError(`道路节点 ${index} 必须使用有限坐标`);
  }
}

export class PathGeometry {
  public readonly totalDistance: number;

  private readonly points: readonly PointDefinition[];
  private readonly segments: readonly PathSegment[];

  public constructor(points: readonly PointDefinition[]) {
    if (points.length < 2) {
      throw new RangeError('道路至少需要两个节点');
    }

    points.forEach(assertFinitePoint);
    this.points = points;

    const rawSegments: Array<Omit<PathSegment,
      'startTangentX' | 'startTangentY' | 'endTangentX' | 'endTangentY'>> = [];
    const segmentTangents: UnitVector[] = [];
    let totalDistance = 0;

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      if (start === undefined || end === undefined) {
        throw new Error('道路节点索引越界');
      }

      const deltaX = end.x - start.x;
      const deltaY = end.y - start.y;
      const length = Math.hypot(deltaX, deltaY);
      if (length <= 0) {
        throw new RangeError(`道路节点 ${index} 与下一节点不能重合`);
      }

      rawSegments.push({
        start,
        deltaX,
        deltaY,
        startDistance: totalDistance,
        length,
      });
      segmentTangents.push({ x: deltaX / length, y: deltaY / length });
      totalDistance += length;
    }

    const vertexTangents = points.map((_point, index): UnitVector => {
      const previous = segmentTangents[index - 1];
      const next = segmentTangents[index];
      if (previous === undefined && next === undefined) {
        throw new Error('道路缺少有效切线');
      }
      if (previous === undefined) return next as UnitVector;
      if (next === undefined) return previous;
      return normalizeVector(
        previous.x + next.x,
        previous.y + next.y,
        next,
      );
    });

    this.segments = rawSegments.map((segment, index): PathSegment => {
      const startTangent = vertexTangents[index];
      const endTangent = vertexTangents[index + 1];
      if (startTangent === undefined || endTangent === undefined) {
        throw new Error('道路节点切线索引越界');
      }
      return {
        ...segment,
        startTangentX: startTangent.x,
        startTangentY: startTangent.y,
        endTangentX: endTangent.x,
        endTangentY: endTangent.y,
      };
    });
    this.totalDistance = totalDistance;
  }

  public get start(): PointDefinition {
    const start = this.points[0];
    if (start === undefined) {
      throw new Error('道路缺少起点');
    }
    return start;
  }

  public get end(): PointDefinition {
    const end = this.points[this.points.length - 1];
    if (end === undefined) {
      throw new Error('道路缺少终点');
    }
    return end;
  }

  public positionAt(distance: number): PointDefinition {
    const sample = this.sampleAt(distance);
    return { x: sample.x, y: sample.y };
  }

  public sampleAt(distance: number): PathSample {
    if (!Number.isFinite(distance)) {
      throw new RangeError('道路距离必须是有限数字');
    }

    const clampedDistance = Math.min(
      Math.max(distance, 0),
      this.totalDistance,
    );

    for (const segment of this.segments) {
      const segmentEnd = segment.startDistance + segment.length;
      if (clampedDistance <= segmentEnd) {
        const progress =
          (clampedDistance - segment.startDistance) / segment.length;
        const tangent = normalizeVector(
          segment.startTangentX +
            (segment.endTangentX - segment.startTangentX) * progress,
          segment.startTangentY +
            (segment.endTangentY - segment.startTangentY) * progress,
          {
            x: segment.deltaX / segment.length,
            y: segment.deltaY / segment.length,
          },
        );
        return {
          x: segment.start.x + segment.deltaX * progress,
          y: segment.start.y + segment.deltaY * progress,
          tangentX: tangent.x,
          tangentY: tangent.y,
          normalX: tangent.y,
          normalY: -tangent.x,
        };
      }
    }

    const finalSegment = this.segments.at(-1);
    if (finalSegment === undefined) {
      throw new Error('道路缺少有效线段');
    }
    const tangentX = finalSegment.endTangentX;
    const tangentY = finalSegment.endTangentY;
    return {
      ...this.end,
      tangentX,
      tangentY,
      normalX: tangentY,
      normalY: -tangentX,
    };
  }
}

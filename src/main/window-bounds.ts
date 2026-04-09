import type { AppSettings } from "../shared/settings";

type WindowBounds = AppSettings["windowBounds"];

export interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ResolveWindowBoundsOptions {
  savedBounds: WindowBounds;
  primaryWorkArea: WorkArea;
  workAreas: WorkArea[];
  minWidth: number;
  minHeight: number;
  edgePadding: number;
}

interface ResolveWindowBoundsResult {
  bounds: Required<WindowBounds>;
  recoveredFromOffscreen: boolean;
}

export function resolveWindowBounds({
  savedBounds,
  primaryWorkArea,
  workAreas,
  minWidth,
  minHeight,
  edgePadding
}: ResolveWindowBoundsOptions): ResolveWindowBoundsResult {
  const desiredWidth = clampDimension(savedBounds.width, minWidth, primaryWorkArea.width);
  const desiredHeight = clampDimension(savedBounds.height, minHeight, primaryWorkArea.height);

  const fallbackX = primaryWorkArea.x + Math.max(primaryWorkArea.width - desiredWidth - edgePadding, 0);
  const fallbackY = primaryWorkArea.y + Math.min(edgePadding, Math.max(primaryWorkArea.height - desiredHeight, 0));

  const desiredBounds = {
    width: desiredWidth,
    height: desiredHeight,
    x: savedBounds.x ?? fallbackX,
    y: savedBounds.y ?? fallbackY
  };

  const visibleWorkArea = workAreas.find((workArea) => {
    return getIntersectionArea(desiredBounds, workArea) > 0;
  });

  const targetWorkArea = visibleWorkArea ?? primaryWorkArea;
  const width = clampDimension(savedBounds.width, minWidth, targetWorkArea.width);
  const height = clampDimension(savedBounds.height, minHeight, targetWorkArea.height);
  const clampedX = clampCoordinate(
    visibleWorkArea ? desiredBounds.x : fallbackX,
    targetWorkArea.x,
    targetWorkArea.x + Math.max(targetWorkArea.width - width, 0)
  );
  const clampedY = clampCoordinate(
    visibleWorkArea ? desiredBounds.y : fallbackY,
    targetWorkArea.y,
    targetWorkArea.y + Math.max(targetWorkArea.height - height, 0)
  );

  return {
    bounds: {
      width,
      height,
      x: clampedX,
      y: clampedY
    },
    recoveredFromOffscreen:
      !visibleWorkArea || clampedX !== desiredBounds.x || clampedY !== desiredBounds.y
  };
}

function clampDimension(value: number, minimum: number, maximum: number): number {
  const lowerBound = Math.min(minimum, maximum);
  return Math.max(lowerBound, Math.min(value, maximum));
}

function clampCoordinate(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

function getIntersectionArea(
  first: Required<WindowBounds>,
  second: WorkArea
): number {
  const horizontal = Math.max(
    0,
    Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x)
  );
  const vertical = Math.max(
    0,
    Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y)
  );

  return horizontal * vertical;
}

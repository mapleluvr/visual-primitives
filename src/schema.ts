export const COORDINATE_SPACES = ["normalized-999", "pixel"] as const;
export const ORIGINS = ["top-left", "bottom-left"] as const;
export const BOX_ORDERS = ["left-top-right-bottom", "left-bottom-right-top"] as const;

export type CoordinateSpace = typeof COORDINATE_SPACES[number];
export type CoordinateOrigin = typeof ORIGINS[number];
export type BoxOrder = typeof BOX_ORDERS[number];

export type BoundingBoxTuple = [number, number, number, number];
export type PointTuple = [number, number];

export interface CropBoundingBoxInput {
  imagePath: string;
  box: BoundingBoxTuple;
  coordinateSpace?: CoordinateSpace;
  origin?: CoordinateOrigin;
  boxOrder?: BoxOrder;
  outputPath?: string;
  padding?: number;
  clamp?: boolean;
}

export interface ResolvedPixelBox {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

export interface SampleColorPointInput {
  point: PointTuple;
  label?: string;
}

export interface SampleColorsInput {
  imagePath: string;
  points: SampleColorPointInput[];
  coordinateSpace?: CoordinateSpace;
  origin?: CoordinateOrigin;
  patchSize?: number;
}

export interface CropBoundingBoxDetails {
  imagePath: string;
  outputPath: string;
  source: {
    width: number;
    height: number;
    format?: string;
    orientation?: number;
  };
  input: {
    box: BoundingBoxTuple;
    coordinateSpace: CoordinateSpace;
    origin: CoordinateOrigin;
    boxOrder: BoxOrder;
    padding: number;
    clamp: boolean;
  };
  resolvedPixelBox: ResolvedPixelBox;
  unclampedPixelBox: ResolvedPixelBox;
  clamped: boolean;
}

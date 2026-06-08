export const COORDINATE_SPACES = ["normalized-999", "pixel"] as const;
export const ORIGINS = ["top-left", "bottom-left"] as const;
export const BOX_ORDERS = ["left-top-right-bottom", "left-bottom-right-top"] as const;

export type CoordinateSpace = typeof COORDINATE_SPACES[number];
export type CoordinateOrigin = typeof ORIGINS[number];
export type BoxOrder = typeof BOX_ORDERS[number];

export type BoundingBoxTuple = [number, number, number, number];

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

export interface CropBoundingBoxDetails {
  imagePath: string;
  outputPath: string;
  source: {
    width: number;
    height: number;
    format?: string;
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

export const cropBoundingBoxSchema = {
  type: "object",
  additionalProperties: false,
  required: ["imagePath", "box"],
  properties: {
    imagePath: {
      type: "string",
      description: "Source image path. Relative paths resolve against the current Pi working directory. A leading @ is ignored.",
    },
    box: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: { type: "number" },
      description: "Bounding box coordinates. Defaults to normalized 0-999 [left, top, right, bottom].",
    },
    coordinateSpace: {
      type: "string",
      enum: COORDINATE_SPACES,
      description: "Coordinate space for box values. Defaults to normalized-999, matching visual-primitives paper examples.",
    },
    origin: {
      type: "string",
      enum: ORIGINS,
      description: "Coordinate origin. top-left means y grows downward; bottom-left means y grows upward. Defaults to top-left.",
    },
    boxOrder: {
      type: "string",
      enum: BOX_ORDERS,
      description: "Input box order. Defaults to left-top-right-bottom. Use left-bottom-right-top for bottom-left style boxes.",
    },
    outputPath: {
      type: "string",
      description: "Optional output PNG path. Relative paths resolve against the current Pi working directory.",
    },
    padding: {
      type: "number",
      description: "Pixel padding to add around the resolved rectangle before clamp or bounds validation. Defaults to 0.",
    },
    clamp: {
      type: "boolean",
      description: "When true, clip out-of-bounds rectangles to image bounds. When false, out-of-bounds rectangles fail. Defaults to true.",
    },
  },
} as const;

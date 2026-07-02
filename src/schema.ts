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

const coordinateProperties = {
  coordinateSpace: cropBoundingBoxSchema.properties.coordinateSpace,
  origin: cropBoundingBoxSchema.properties.origin,
  boxOrder: cropBoundingBoxSchema.properties.boxOrder,
  padding: cropBoundingBoxSchema.properties.padding,
  clamp: cropBoundingBoxSchema.properties.clamp,
} as const;

const labeledBoxSchema = {
  type: "object",
  additionalProperties: false,
  required: ["box"],
  properties: {
    box: cropBoundingBoxSchema.properties.box,
    label: {
      type: "string",
      description: "Optional label used in metadata and deterministic output filenames.",
    },
    outputPath: {
      type: "string",
      description: "Optional per-box output PNG path. Relative paths resolve against the current Pi working directory.",
    },
  },
} as const;

const annotationBoxSchema = {
  type: "object",
  additionalProperties: false,
  required: ["box"],
  properties: {
    box: cropBoundingBoxSchema.properties.box,
    label: {
      type: "string",
      description: "Optional label drawn near the box and returned in metadata.",
    },
    color: {
      type: "string",
      description: "Optional SVG/CSS color for the box outline. Defaults to a high-contrast pink.",
    },
  },
} as const;

export const cropMultipleBoundingBoxesSchema = {
  type: "object",
  additionalProperties: false,
  required: ["imagePath", "boxes"],
  properties: {
    imagePath: cropBoundingBoxSchema.properties.imagePath,
    boxes: {
      type: "array",
      minItems: 1,
      items: labeledBoxSchema,
      description: "Bounding boxes to crop from the same source image. Fails fast on the first invalid box.",
    },
    outputDir: {
      type: "string",
      description: "Optional directory for generated crop files. Relative paths resolve against the current Pi working directory.",
    },
    ...coordinateProperties,
  },
} as const;

export const annotateBoundingBoxesSchema = {
  type: "object",
  additionalProperties: false,
  required: ["imagePath", "boxes"],
  properties: {
    imagePath: cropBoundingBoxSchema.properties.imagePath,
    boxes: {
      type: "array",
      minItems: 1,
      items: annotationBoxSchema,
      description: "Bounding boxes to draw over the source image.",
    },
    outputPath: {
      type: "string",
      description: "Optional annotated PNG path. Relative paths resolve against the current Pi working directory.",
    },
    ...coordinateProperties,
  },
} as const;

const pointSchema = {
  type: "array",
  minItems: 2,
  maxItems: 2,
  items: { type: "number" },
  description: "Point coordinates.",
} as const;

const labeledPointSchema = {
  type: "object",
  additionalProperties: false,
  required: ["point"],
  properties: {
    point: pointSchema,
    label: {
      type: "string",
      description: "Optional label returned in sampled color metadata.",
    },
  },
} as const;

export const cropAroundPointSchema = {
  type: "object",
  additionalProperties: false,
  required: ["imagePath", "point"],
  oneOf: [
    { required: ["radius"], not: { required: ["size"] } },
    { required: ["size"], not: { required: ["radius"] } },
  ],
  properties: {
    imagePath: cropBoundingBoxSchema.properties.imagePath,
    point: {
      ...pointSchema,
      description: "Point coordinates to center the crop around.",
    },
    radius: {
      type: "number",
      exclusiveMinimum: 0,
      description: "Explicit crop radius in the selected coordinate space. Mutually exclusive with size.",
    },
    size: {
      type: "object",
      additionalProperties: false,
      required: ["width", "height"],
      properties: {
        width: { type: "number", exclusiveMinimum: 0, description: "Explicit crop width in the selected coordinate space." },
        height: { type: "number", exclusiveMinimum: 0, description: "Explicit crop height in the selected coordinate space." },
      },
      description: "Explicit crop size in the selected coordinate space. Mutually exclusive with radius.",
    },
    outputPath: cropBoundingBoxSchema.properties.outputPath,
    ...coordinateProperties,
  },
} as const;

export const sampleColorsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["imagePath", "points"],
  properties: {
    imagePath: cropBoundingBoxSchema.properties.imagePath,
    points: {
      type: "array",
      minItems: 1,
      items: labeledPointSchema,
      description: "Points to sample from the source image.",
    },
    coordinateSpace: cropBoundingBoxSchema.properties.coordinateSpace,
    origin: cropBoundingBoxSchema.properties.origin,
    patchSize: {
      type: "integer",
      minimum: 1,
      default: 1,
      description: "Odd positive square patch size in pixels. Even values are rounded up to the next odd value.",
    },
  },
} as const;

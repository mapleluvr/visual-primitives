import { access } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import type {
  BoxOrder,
  CoordinateOrigin,
  CoordinateSpace,
  CropBoundingBoxDetails,
  CropBoundingBoxInput,
  ResolvedPixelBox,
} from "./schema.ts";

export interface CropBoundingBoxOptions {
  cwd: string;
  signal?: AbortSignal;
}

interface ImageSize {
  width: number;
  height: number;
}

interface ResolveOptions {
  coordinateSpace: CoordinateSpace;
  origin: CoordinateOrigin;
  boxOrder: BoxOrder;
  padding: number;
  clamp: boolean;
}

function normalizeToolPath(path: string, cwd: string): string {
  const cleaned = path.startsWith("@") ? path.slice(1) : path;
  return isAbsolute(cleaned) ? cleaned : resolve(cwd, cleaned);
}

function defaultResolveOptions(input: Pick<CropBoundingBoxInput, "coordinateSpace" | "origin" | "boxOrder" | "padding" | "clamp">): ResolveOptions {
  const padding = input.padding ?? 0;
  if (!Number.isFinite(padding) || padding < 0) {
    throw new Error("padding must be a finite non-negative number");
  }

  return {
    coordinateSpace: input.coordinateSpace ?? "normalized-999",
    origin: input.origin ?? "top-left",
    boxOrder: input.boxOrder ?? "left-top-right-bottom",
    padding,
    clamp: input.clamp ?? true,
  };
}

function assertFiniteBox(box: [number, number, number, number]): void {
  if (!Array.isArray(box) || box.length !== 4) {
    throw new Error("box must contain exactly four coordinates");
  }

  if (!box.every((value) => Number.isFinite(value))) {
    throw new Error("box coordinates must be finite numbers");
  }
}

function scaleCoordinate(value: number, size: number, coordinateSpace: CoordinateSpace): number {
  if (coordinateSpace === "pixel") return Math.round(value);
  return Math.round((value / 999) * size);
}

function makePixelBox(left: number, top: number, right: number, bottom: number): ResolvedPixelBox {
  const normalizedLeft = Math.min(left, right);
  const normalizedRight = Math.max(left, right);
  const normalizedTop = Math.min(top, bottom);
  const normalizedBottom = Math.max(top, bottom);

  return {
    left: normalizedLeft,
    top: normalizedTop,
    right: normalizedRight,
    bottom: normalizedBottom,
    width: normalizedRight - normalizedLeft,
    height: normalizedBottom - normalizedTop,
  };
}

function withPadding(box: ResolvedPixelBox, padding: number): ResolvedPixelBox {
  return makePixelBox(
    box.left - padding,
    box.top - padding,
    box.right + padding,
    box.bottom + padding,
  );
}

function clampBox(box: ResolvedPixelBox, image: ImageSize): ResolvedPixelBox {
  return makePixelBox(
    Math.max(0, Math.min(image.width, box.left)),
    Math.max(0, Math.min(image.height, box.top)),
    Math.max(0, Math.min(image.width, box.right)),
    Math.max(0, Math.min(image.height, box.bottom)),
  );
}

function isSameBox(a: ResolvedPixelBox, b: ResolvedPixelBox): boolean {
  return a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;
}

function isWithinBounds(box: ResolvedPixelBox, image: ImageSize): boolean {
  return box.left >= 0 && box.top >= 0 && box.right <= image.width && box.bottom <= image.height;
}

function assertPositiveArea(box: ResolvedPixelBox): void {
  if (box.width <= 0 || box.height <= 0) {
    throw new Error("resolved crop area must have positive width and height");
  }
}

function resolvePixelBox(
  box: [number, number, number, number],
  image: ImageSize,
  inputOptions: Pick<CropBoundingBoxInput, "coordinateSpace" | "origin" | "boxOrder" | "padding" | "clamp"> = {},
): { resolvedPixelBox: ResolvedPixelBox; unclampedPixelBox: ResolvedPixelBox; clamped: boolean } {
  assertFiniteBox(box);

  const options = defaultResolveOptions(inputOptions);
  const [a, b, c, d] = box;
  const leftRaw = a;
  const rightRaw = c;
  const firstYRaw = b;
  const secondYRaw = d;

  const left = scaleCoordinate(leftRaw, image.width, options.coordinateSpace);
  const right = scaleCoordinate(rightRaw, image.width, options.coordinateSpace);
  const firstY = scaleCoordinate(firstYRaw, image.height, options.coordinateSpace);
  const secondY = scaleCoordinate(secondYRaw, image.height, options.coordinateSpace);

  let top: number;
  let bottom: number;

  if (options.origin === "top-left") {
    top = options.boxOrder === "left-top-right-bottom" ? firstY : secondY;
    bottom = options.boxOrder === "left-top-right-bottom" ? secondY : firstY;
  } else {
    const bottomFromBottom = options.boxOrder === "left-bottom-right-top" ? firstY : secondY;
    const topFromBottom = options.boxOrder === "left-bottom-right-top" ? secondY : firstY;
    top = image.height - topFromBottom;
    bottom = image.height - bottomFromBottom;
  }

  const padded = withPadding(makePixelBox(left, top, right, bottom), options.padding);
  const unclampedPixelBox = padded;
  assertPositiveArea(unclampedPixelBox);

  if (!options.clamp && !isWithinBounds(unclampedPixelBox, image)) {
    throw new Error("resolved crop area is outside image bounds and clamp is false");
  }

  const resolvedPixelBox = options.clamp ? clampBox(unclampedPixelBox, image) : unclampedPixelBox;
  assertPositiveArea(resolvedPixelBox);

  return {
    resolvedPixelBox,
    unclampedPixelBox,
    clamped: !isSameBox(unclampedPixelBox, resolvedPixelBox),
  };
}

export async function cropBoundingBox(
  input: CropBoundingBoxInput,
  options: CropBoundingBoxOptions,
): Promise<CropBoundingBoxDetails> {
  if (options.signal?.aborted) {
    throw new Error("crop_bounding_box was cancelled");
  }

  const imagePath = normalizeToolPath(input.imagePath, options.cwd);
  try {
    await access(imagePath);
  } catch {
    throw new Error(`Input file is missing or cannot be read: ${imagePath}`);
  }

  throw new Error("cropBoundingBox image processing is not implemented yet");
}

export function resolvePixelBoxForTest(
  box: [number, number, number, number],
  image: { width: number; height: number },
  options?: Pick<CropBoundingBoxInput, "coordinateSpace" | "origin" | "boxOrder" | "padding" | "clamp">,
): { resolvedPixelBox: ResolvedPixelBox; unclampedPixelBox: ResolvedPixelBox; clamped: boolean } {
  return resolvePixelBox(box, image, options);
}

import { createHash } from "node:crypto";
import { access, mkdir } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import sharp from "sharp";
import type {
  BoundingBoxTuple,
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

function assertFiniteBox(box: BoundingBoxTuple): void {
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
  box: BoundingBoxTuple,
  image: ImageSize,
  inputOptions: Pick<CropBoundingBoxInput, "coordinateSpace" | "origin" | "boxOrder" | "padding" | "clamp"> = {},
): { resolvedPixelBox: ResolvedPixelBox; unclampedPixelBox: ResolvedPixelBox; clamped: boolean; options: ResolveOptions } {
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
  if (options.clamp && (resolvedPixelBox.width <= 0 || resolvedPixelBox.height <= 0)) {
    throw new Error(`box resolves to pixel rect [${unclampedPixelBox.left}, ${unclampedPixelBox.top}, ${unclampedPixelBox.right}, ${unclampedPixelBox.bottom}], completely outside the ${image.width}x${image.height} image`);
  }
  assertPositiveArea(resolvedPixelBox);

  return {
    resolvedPixelBox,
    unclampedPixelBox,
    clamped: !isSameBox(unclampedPixelBox, resolvedPixelBox),
    options,
  };
}

function defaultOutputPath(imagePath: string, input: CropBoundingBoxInput, cwd: string): string {
  const parsedExt = extname(imagePath);
  const base = basename(imagePath, parsedExt);
  const hash = createHash("sha256")
    .update(JSON.stringify({ imagePath, input }))
    .digest("hex")
    .slice(0, 12);
  return join(cwd, `${base}.crop-${hash}.png`);
}

export async function resolveCropBoundingBoxDetails(
  input: CropBoundingBoxInput,
  options: CropBoundingBoxOptions,
  outputPath: string,
): Promise<CropBoundingBoxDetails> {
  const imagePath = normalizeToolPath(input.imagePath, options.cwd);
  try {
    await access(imagePath);
  } catch {
    throw new Error(`Input file is missing or cannot be read: ${imagePath}`);
  }

  const metadata = await sharp(imagePath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to determine image dimensions: ${imagePath}`);
  }

  const { resolvedPixelBox, unclampedPixelBox, clamped, options: resolvedOptions } = resolvePixelBox(
    input.box,
    { width: metadata.width, height: metadata.height },
    input,
  );

  return {
    imagePath,
    outputPath,
    source: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      ...(metadata.orientation !== undefined ? { orientation: metadata.orientation } : {}),
    },
    input: {
      box: input.box,
      coordinateSpace: resolvedOptions.coordinateSpace,
      origin: resolvedOptions.origin,
      boxOrder: resolvedOptions.boxOrder,
      padding: resolvedOptions.padding,
      clamp: resolvedOptions.clamp,
    },
    resolvedPixelBox,
    unclampedPixelBox,
    clamped,
  };
}

export async function cropBoundingBox(
  input: CropBoundingBoxInput,
  options: CropBoundingBoxOptions,
): Promise<CropBoundingBoxDetails> {
  if (options.signal?.aborted) {
    throw new Error("crop was cancelled");
  }

  const imagePath = normalizeToolPath(input.imagePath, options.cwd);
  try {
    await access(imagePath);
  } catch {
    throw new Error(`Input file is missing or cannot be read: ${imagePath}`);
  }

  const outputPath = input.outputPath
    ? normalizeToolPath(input.outputPath, options.cwd)
    : defaultOutputPath(imagePath, input, options.cwd);

  const details = await resolveCropBoundingBoxDetails(input, options, outputPath);

  await mkdir(dirname(outputPath), { recursive: true });

  if (options.signal?.aborted) {
    throw new Error("crop was cancelled");
  }

  await sharp(imagePath)
    .extract({
      left: details.resolvedPixelBox.left,
      top: details.resolvedPixelBox.top,
      width: details.resolvedPixelBox.width,
      height: details.resolvedPixelBox.height,
    })
    .png()
    .toFile(outputPath);

  return details;
}

export function resolvePixelBoxForTest(
  box: BoundingBoxTuple,
  image: { width: number; height: number },
  options?: Pick<CropBoundingBoxInput, "coordinateSpace" | "origin" | "boxOrder" | "padding" | "clamp">,
): { resolvedPixelBox: ResolvedPixelBox; unclampedPixelBox: ResolvedPixelBox; clamped: boolean } {
  const { resolvedPixelBox, unclampedPixelBox, clamped } = resolvePixelBox(box, image, options);
  return { resolvedPixelBox, unclampedPixelBox, clamped };
}

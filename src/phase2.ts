import { createHash } from "node:crypto";
import { access, mkdir } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import sharp from "sharp";
import type { BoundingBoxTuple, CropBoundingBoxDetails, CropBoundingBoxInput } from "./schema.ts";
import { cropBoundingBox, resolveCropBoundingBoxDetails } from "./crop.ts";

export interface CropMultipleBoundingBoxesInput extends Omit<CropBoundingBoxInput, "box" | "outputPath"> {
  boxes: Array<{
    box: BoundingBoxTuple;
    label?: string;
    outputPath?: string;
  }>;
  outputDir?: string;
}

export interface CropMultipleBoundingBoxesDetails {
  imagePath: string;
  outputDir?: string;
  crops: Array<CropBoundingBoxDetails & { index: number; label?: string }>;
}

export interface AnnotateBoundingBoxesInput extends Omit<CropBoundingBoxInput, "box" | "outputPath"> {
  boxes: Array<{
    box: BoundingBoxTuple;
    label?: string;
    color?: string;
  }>;
  outputPath?: string;
}

export interface AnnotateBoundingBoxesDetails {
  imagePath: string;
  outputPath: string;
  source: {
    width: number;
    height: number;
    format?: string;
  };
  boxes: Array<Pick<CropBoundingBoxDetails, "resolvedPixelBox" | "unclampedPixelBox" | "clamped"> & { index: number; label?: string }>;
}

export interface CropAroundPointInput extends Omit<CropBoundingBoxInput, "box"> {
  point: [number, number];
  radius?: number;
  size?: {
    width: number;
    height: number;
  };
}

export type CropAroundPointDetails = CropBoundingBoxDetails & {
  input: CropBoundingBoxDetails["input"] & {
    point: [number, number];
    radius?: number;
    size?: {
      width: number;
      height: number;
    };
  };
};

interface ToolOptions {
  cwd: string;
  signal?: AbortSignal;
}

function normalizeToolPath(path: string, cwd: string): string {
  const cleaned = path.startsWith("@") ? path.slice(1) : path;
  return isAbsolute(cleaned) ? cleaned : resolve(cwd, cleaned);
}

function slugifyLabel(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "box";
}

function hashInput(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 12);
}

function defaultMultiCropOutputPath(imagePath: string, input: CropMultipleBoundingBoxesInput, index: number, label: string | undefined, cwd: string): string {
  const resolvedImagePath = normalizeToolPath(imagePath, cwd);
  const parsedExt = extname(resolvedImagePath);
  const base = basename(resolvedImagePath, parsedExt);
  const suffix = label ? `-${slugifyLabel(label)}` : "";
  const fileName = `${base}.crop-${String(index + 1).padStart(3, "0")}${suffix}-${hashInput({ imagePath, input, index, label })}.png`;
  return input.outputDir ? join(input.outputDir, fileName) : join(dirname(resolvedImagePath), fileName);
}

function defaultAnnotationOutputPath(imagePath: string, input: AnnotateBoundingBoxesInput, cwd: string): string {
  const resolvedImagePath = normalizeToolPath(imagePath, cwd);
  const parsedExt = extname(resolvedImagePath);
  const base = basename(resolvedImagePath, parsedExt);
  return join(dirname(resolvedImagePath), `${base}.annotated-${hashInput({ imagePath, input })}.png`);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function assertFinitePoint(point: [number, number]): void {
  if (!Array.isArray(point) || point.length !== 2 || !point.every((value) => Number.isFinite(value))) {
    throw new Error("point must contain exactly two finite coordinates");
  }
}

function pointBox(input: CropAroundPointInput): BoundingBoxTuple {
  assertFinitePoint(input.point);

  if (input.radius !== undefined && input.size !== undefined) {
    throw new Error("Provide either radius or size, not both");
  }

  if (input.radius !== undefined) {
    if (!Number.isFinite(input.radius) || input.radius <= 0) {
      throw new Error("radius must be a finite positive number");
    }
    const [x, y] = input.point;
    return [x - input.radius, y - input.radius, x + input.radius, y + input.radius];
  }

  if (input.size !== undefined) {
    if (!Number.isFinite(input.size.width) || !Number.isFinite(input.size.height) || input.size.width <= 0 || input.size.height <= 0) {
      throw new Error("size width and height must be finite positive numbers");
    }
    const [x, y] = input.point;
    const halfWidth = input.size.width / 2;
    const halfHeight = input.size.height / 2;
    return [x - halfWidth, y - halfHeight, x + halfWidth, y + halfHeight];
  }

  throw new Error("crop_around_point requires an explicit radius or size");
}

export async function cropMultipleBoundingBoxes(
  input: CropMultipleBoundingBoxesInput,
  options: ToolOptions,
): Promise<CropMultipleBoundingBoxesDetails> {
  if (!Array.isArray(input.boxes) || input.boxes.length === 0) {
    throw new Error("boxes must contain at least one bounding box");
  }

  const crops: Array<CropBoundingBoxDetails & { index: number; label?: string }> = [];
  for (const [index, item] of input.boxes.entries()) {
    const outputPath = item.outputPath ?? defaultMultiCropOutputPath(input.imagePath, input, index, item.label, options.cwd);
    const details = await cropBoundingBox({
      imagePath: input.imagePath,
      box: item.box,
      coordinateSpace: input.coordinateSpace,
      origin: input.origin,
      boxOrder: input.boxOrder,
      outputPath,
      padding: input.padding,
      clamp: input.clamp,
    }, options);
    crops.push({ ...details, index, label: item.label });
  }

  return {
    imagePath: normalizeToolPath(input.imagePath, options.cwd),
    outputDir: input.outputDir ? normalizeToolPath(input.outputDir, options.cwd) : undefined,
    crops,
  };
}

export async function annotateBoundingBoxes(
  input: AnnotateBoundingBoxesInput,
  options: ToolOptions,
): Promise<AnnotateBoundingBoxesDetails> {
  if (!Array.isArray(input.boxes) || input.boxes.length === 0) {
    throw new Error("boxes must contain at least one bounding box");
  }

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

  const boxes = [];
  for (const [index, item] of input.boxes.entries()) {
    const details = await resolveCropBoundingBoxDetails({
      imagePath: input.imagePath,
      box: item.box,
      coordinateSpace: input.coordinateSpace,
      origin: input.origin,
      boxOrder: input.boxOrder,
      padding: input.padding,
      clamp: input.clamp,
    }, options, "");
    boxes.push({
      index,
      label: item.label,
      color: item.color ?? "#ff0055",
      resolvedPixelBox: details.resolvedPixelBox,
      unclampedPixelBox: details.unclampedPixelBox,
      clamped: details.clamped,
    });
  }

  const outputPath = input.outputPath ? normalizeToolPath(input.outputPath, options.cwd) : defaultAnnotationOutputPath(input.imagePath, input, options.cwd);
  await mkdir(dirname(outputPath), { recursive: true });

  const svg = `<svg width="${metadata.width}" height="${metadata.height}" xmlns="http://www.w3.org/2000/svg">
${boxes.map((item) => {
  const box = item.resolvedPixelBox;
  const color = escapeXml(item.color);
  const label = item.label ? `<text x="${box.left}" y="${Math.max(12, box.top - 4)}" fill="${color}" font-size="12" font-family="sans-serif">${escapeXml(item.label)}</text>` : "";
  return `<rect x="${box.left}" y="${box.top}" width="${box.width}" height="${box.height}" fill="none" stroke="${color}" stroke-width="2"/>${label}`;
}).join("\n")}
</svg>`;

  await sharp(imagePath)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(outputPath);

  return {
    imagePath,
    outputPath,
    source: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    },
    boxes: boxes.map(({ color: _color, ...item }) => item),
  };
}

export async function cropAroundPoint(
  input: CropAroundPointInput,
  options: ToolOptions,
): Promise<CropAroundPointDetails> {
  const details = await cropBoundingBox({
    imagePath: input.imagePath,
    box: pointBox(input),
    coordinateSpace: input.coordinateSpace,
    origin: input.origin,
    boxOrder: input.boxOrder,
    outputPath: input.outputPath,
    padding: input.padding,
    clamp: input.clamp,
  }, options);

  return {
    ...details,
    input: {
      ...details.input,
      point: input.point,
      radius: input.radius,
      size: input.size,
    },
  };
}

import { createHash } from "node:crypto";
import { access, mkdir } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import sharp from "sharp";
import type { BoundingBoxTuple, CoordinateOrigin, CoordinateSpace, CropBoundingBoxDetails, CropBoundingBoxInput, SampleColorsInput } from "./schema.ts";
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

export interface SampleColorsDetails {
  imagePath: string;
  source: {
    width: number;
    height: number;
    format?: string;
  };
  input: {
    coordinateSpace: CoordinateSpace;
    origin: CoordinateOrigin;
    patchSize: number;
  };
  samples: Array<{
    index: number;
    label?: string;
    inputPoint: [number, number];
    resolvedPixelPoint: { x: number; y: number };
    rgb: { r: number; g: number; b: number };
    alpha: number;
    hex: string;
    oklab: { l: number; a: number; b: number };
    patch: {
      size: number;
      sampledPixels: number;
      bounds: { left: number; top: number; right: number; bottom: number; width: number; height: number };
      meanRgb: { r: number; g: number; b: number };
      meanHex: string;
    };
  }>;
}

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

function normalizePatchSize(value: number | undefined): number {
  const size = value ?? 1;
  if (!Number.isInteger(size) || size < 1) {
    throw new Error("patchSize must be a positive integer");
  }
  return size % 2 === 0 ? size + 1 : size;
}

function scalePointCoordinate(value: number, size: number, coordinateSpace: CoordinateSpace): number {
  if (coordinateSpace === "pixel") return Math.round(value);
  return Math.round((value / 999) * (size - 1));
}

function clampPixelIndex(value: number, size: number): number {
  return Math.max(0, Math.min(size - 1, value));
}

function resolvePixelPoint(
  point: [number, number],
  image: { width: number; height: number },
  coordinateSpace: CoordinateSpace,
  origin: CoordinateOrigin,
): { x: number; y: number } {
  assertFinitePoint(point);
  const x = clampPixelIndex(scalePointCoordinate(point[0], image.width, coordinateSpace), image.width);
  const yInSpace = scalePointCoordinate(point[1], image.height, coordinateSpace);
  const y = origin === "bottom-left" ? image.height - 1 - yInSpace : yInSpace;
  return { x, y: clampPixelIndex(y, image.height) };
}

function toHex(rgb: { r: number; g: number; b: number }): string {
  return `#${[rgb.r, rgb.g, rgb.b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function linearSrgb(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function cbrt(value: number): number {
  return Math.sign(value) * Math.abs(value) ** (1 / 3);
}

function rgbToOklab(rgb: { r: number; g: number; b: number }): { l: number; a: number; b: number } {
  const r = linearSrgb(rgb.r);
  const g = linearSrgb(rgb.g);
  const b = linearSrgb(rgb.b);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = cbrt(l);
  const m_ = cbrt(m);
  const s_ = cbrt(s);
  return {
    l: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

function readPixel(raw: Buffer, width: number, x: number, y: number): { r: number; g: number; b: number; alpha: number } {
  const offset = (y * width + x) * 4;
  return {
    r: raw[offset],
    g: raw[offset + 1],
    b: raw[offset + 2],
    alpha: raw[offset + 3],
  };
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

export async function sampleColors(
  input: SampleColorsInput,
  options: ToolOptions,
): Promise<SampleColorsDetails> {
  if (!Array.isArray(input.points) || input.points.length === 0) {
    throw new Error("points must contain at least one point");
  }

  const imagePath = normalizeToolPath(input.imagePath, options.cwd);
  try {
    await access(imagePath);
  } catch {
    throw new Error(`Input file is missing or cannot be read: ${imagePath}`);
  }

  const image = sharp(imagePath).ensureAlpha();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to determine image dimensions: ${imagePath}`);
  }

  const { data } = await image.raw().toBuffer({ resolveWithObject: true });
  const coordinateSpace = input.coordinateSpace ?? "normalized-999";
  const origin = input.origin ?? "top-left";
  const patchSize = normalizePatchSize(input.patchSize);
  const radius = Math.floor(patchSize / 2);

  const samples = input.points.map((item, index) => {
    const point = item.point;
    const resolved = resolvePixelPoint(point, { width: metadata.width!, height: metadata.height! }, coordinateSpace, origin);
    const pixel = readPixel(data, metadata.width!, resolved.x, resolved.y);
    const left = Math.max(0, resolved.x - radius);
    const right = Math.min(metadata.width!, resolved.x + radius + 1);
    const top = Math.max(0, resolved.y - radius);
    const bottom = Math.min(metadata.height!, resolved.y + radius + 1);
    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let count = 0;
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const sampled = readPixel(data, metadata.width!, x, y);
        totalR += sampled.r;
        totalG += sampled.g;
        totalB += sampled.b;
        count += 1;
      }
    }
    const meanRgb = {
      r: Math.round(totalR / count),
      g: Math.round(totalG / count),
      b: Math.round(totalB / count),
    };
    const rgb = { r: pixel.r, g: pixel.g, b: pixel.b };

    return {
      index,
      label: item.label,
      inputPoint: point,
      resolvedPixelPoint: resolved,
      rgb,
      alpha: pixel.alpha,
      hex: toHex(rgb),
      oklab: rgbToOklab(rgb),
      patch: {
        size: patchSize,
        sampledPixels: count,
        bounds: {
          left,
          top,
          right,
          bottom,
          width: right - left,
          height: bottom - top,
        },
        meanRgb,
        meanHex: toHex(meanRgb),
      },
    };
  });

  return {
    imagePath,
    source: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    },
    input: {
      coordinateSpace,
      origin,
      patchSize,
    },
    samples,
  };
}

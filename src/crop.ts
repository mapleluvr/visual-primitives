import { access } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import type { CropBoundingBoxDetails, CropBoundingBoxInput, ResolvedPixelBox } from "./schema.ts";

export interface CropBoundingBoxOptions {
  cwd: string;
  signal?: AbortSignal;
}

function normalizeToolPath(path: string, cwd: string): string {
  const cleaned = path.startsWith("@") ? path.slice(1) : path;
  return isAbsolute(cleaned) ? cleaned : resolve(cwd, cleaned);
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
  _box: [number, number, number, number],
  _image: { width: number; height: number },
  _options?: Pick<CropBoundingBoxInput, "coordinateSpace" | "origin" | "boxOrder" | "padding" | "clamp">,
): { resolvedPixelBox: ResolvedPixelBox; unclampedPixelBox: ResolvedPixelBox; clamped: boolean } {
  throw new Error("resolvePixelBoxForTest is not implemented yet");
}

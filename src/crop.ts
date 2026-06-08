import type { CropBoundingBoxDetails, CropBoundingBoxInput, ResolvedPixelBox } from "./schema.ts";

export interface CropBoundingBoxOptions {
  cwd: string;
  signal?: AbortSignal;
}

export async function cropBoundingBox(
  _input: CropBoundingBoxInput,
  _options: CropBoundingBoxOptions,
): Promise<CropBoundingBoxDetails> {
  throw new Error("cropBoundingBox is not implemented yet");
}

export function resolvePixelBoxForTest(
  _box: [number, number, number, number],
  _image: { width: number; height: number },
  _options?: Pick<CropBoundingBoxInput, "coordinateSpace" | "origin" | "boxOrder" | "padding" | "clamp">,
): { resolvedPixelBox: ResolvedPixelBox; unclampedPixelBox: ResolvedPixelBox; clamped: boolean } {
  throw new Error("resolvePixelBoxForTest is not implemented yet");
}

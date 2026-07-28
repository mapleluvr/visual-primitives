import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

type CoordinateSpace = "pixel" | "normalized-999";
type DiffColorSpace = "rgb" | "oklab";

type ExclusionBox = {
  id: string;
  box: [number, number, number, number];
  reason?: string;
};

type Manifest = {
  oracleImage: string;
  renderedImage: string;
  outputDir: string;
  coordinateSpace?: CoordinateSpace;
  exclusionBoxes?: ExclusionBox[];
  options?: Partial<DiffOptions>;
};

type DiffOptions = {
  gridSize: number;
  localWindow: number;
  maskPadding: number;
  diffColorSpace: DiffColorSpace;
  blurSigma: number;
  highlightThreshold: number;
  stripeThreshold: number;
  minCellCoverage: number;
  minComponentArea: number;
};

type PixelBox = {
  id: string;
  reason?: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type LoadedImage = {
  path: string;
  width: number;
  height: number;
  data: Buffer;
};

type MatrixCell = {
  row: number;
  col: number;
  bounds: [number, number, number, number];
  coverage: number;
  mean: number;
  p90: number;
  score: number;
};

type Component = {
  id: number;
  bbox: [number, number, number, number];
  center: [number, number];
  area: number;
  meanDiff: number;
  maxDiff: number;
  matrixRows: [number, number];
  matrixCols: [number, number];
};

type Stripe = {
  id: number;
  type: "horizontal" | "vertical" | "diagonal-down" | "diagonal-up";
  start: [number, number];
  end: [number, number];
  length: number;
  meanScore: number;
  maxScore: number;
};

type RunResult = {
  outputDir: string;
  summaryPath: string;
  verdictPath: string;
};

const MASK_GRAY = 48;

const DEFAULT_OPTIONS: DiffOptions = {
  gridSize: 25,
  localWindow: 11,
  maskPadding: 0,
  diffColorSpace: "oklab",
  blurSigma: 0,
  highlightThreshold: 0.18,
  stripeThreshold: 0.1,
  minCellCoverage: 0.2,
  minComponentArea: 4,
};

function round(value: number, digits = 6): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function maxValue(values: number[]): number {
  let max = 0;
  for (const value of values) {
    if (value > max) max = value;
  }
  return max;
}

function maxBy<T>(items: T[], getValue: (item: T) => number): number {
  let max = 0;
  for (const item of items) {
    const value = getValue(item);
    if (value > max) max = value;
  }
  return max;
}

function resolvePath(baseDir: string, value: string): string {
  return isAbsolute(value) ? value : resolve(baseDir, value);
}

function parseArgs(argv: string[]): { manifestPath: string } {
  const manifestIndex = argv.indexOf("--manifest");
  if (manifestIndex === -1 || !argv[manifestIndex + 1]) {
    throw new Error("Usage: masked-oracle-diff --manifest <manifest.json>");
  }
  return { manifestPath: argv[manifestIndex + 1] };
}

async function loadManifest(manifestPath: string): Promise<{ manifest: Manifest; manifestDir: string }> {
  const absoluteManifest = resolve(manifestPath);
  const manifest = JSON.parse(await readFile(absoluteManifest, "utf8")) as Manifest;
  if (!manifest.oracleImage || !manifest.renderedImage || !manifest.outputDir) {
    throw new Error("Manifest requires oracleImage, renderedImage, and outputDir");
  }
  return { manifest, manifestDir: dirname(absoluteManifest) };
}

async function loadImage(path: string, blurSigma: number): Promise<LoadedImage> {
  let pipeline = sharp(path).ensureAlpha();
  if (blurSigma > 0) {
    pipeline = pipeline.blur(blurSigma);
  }
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  return { path, width: info.width, height: info.height, data };
}

function resolveBox(
  exclusion: ExclusionBox,
  width: number,
  height: number,
  coordinateSpace: CoordinateSpace,
  padding: number,
): PixelBox {
  let [left, top, right, bottom] = exclusion.box;
  if (coordinateSpace === "normalized-999") {
    left = Math.round((left / 999) * width);
    right = Math.round((right / 999) * width);
    top = Math.round((top / 999) * height);
    bottom = Math.round((bottom / 999) * height);
  }

  left = Math.floor(left - padding);
  top = Math.floor(top - padding);
  right = Math.ceil(right + padding);
  bottom = Math.ceil(bottom + padding);

  if (left < 0 || top < 0 || right > width || bottom > height) {
    throw new Error(`Exclusion box ${exclusion.id} is out of bounds`);
  }
  if (right <= left || bottom <= top) {
    throw new Error(`Exclusion box ${exclusion.id} must have positive width and height`);
  }

  return {
    id: exclusion.id,
    reason: exclusion.reason,
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function buildScoringMask(width: number, height: number, boxes: PixelBox[]): Uint8Array {
  const mask = new Uint8Array(width * height);
  mask.fill(1);
  for (const box of boxes) {
    for (let y = box.top; y < box.bottom; y += 1) {
      for (let x = box.left; x < box.right; x += 1) {
        mask[y * width + x] = 0;
      }
    }
  }
  return mask;
}

function srgbToLinear(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return [
    0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  ];
}

function pixelDiff(oracle: Buffer, rendered: Buffer, index: number, colorSpace: DiffColorSpace): number {
  const or = oracle[index];
  const og = oracle[index + 1];
  const ob = oracle[index + 2];
  const rr = rendered[index];
  const rg = rendered[index + 1];
  const rb = rendered[index + 2];

  if (colorSpace === "rgb") {
    return Math.min(1, (Math.abs(or - rr) + Math.abs(og - rg) + Math.abs(ob - rb)) / 765);
  }

  const [ol, oa, obc] = rgbToOklab(or, og, ob);
  const [rl, ra, rbc] = rgbToOklab(rr, rg, rb);
  const distance = Math.hypot(ol - rl, oa - ra, obc - rbc);
  return Math.min(1, distance / 0.75);
}

function heatmapColor(score: number): [number, number, number] {
  if (score <= 0) return [0, 0, 0];
  if (score < 0.33) {
    const t = score / 0.33;
    return [0, Math.round(80 * t), Math.round(180 * t)];
  }
  if (score < 0.66) {
    const t = (score - 0.33) / 0.33;
    return [Math.round(255 * t), Math.round(80 + 120 * t), Math.round(180 * (1 - t))];
  }
  const t = (score - 0.66) / 0.34;
  return [255, Math.round(200 + 55 * t), Math.round(40 * (1 - t))];
}

function computeDiffs(
  oracle: LoadedImage,
  rendered: LoadedImage,
  mask: Uint8Array,
  options: DiffOptions,
): {
  diffs: Float32Array;
  gray: Buffer;
  heatmap: Buffer;
  overlay: Buffer;
  exclusionMask: Buffer;
  scoringMaskImage: Buffer;
  maskedOracle: Buffer;
  maskedRendered: Buffer;
  scoredValues: number[];
} {
  const pixels = oracle.width * oracle.height;
  const diffs = new Float32Array(pixels);
  const gray = Buffer.alloc(pixels * 4);
  const heatmap = Buffer.alloc(pixels * 4);
  const overlay = Buffer.alloc(pixels * 4);
  const exclusionMask = Buffer.alloc(pixels * 4);
  const scoringMaskImage = Buffer.alloc(pixels * 4);
  const maskedOracle = Buffer.from(oracle.data);
  const maskedRendered = Buffer.from(rendered.data);
  const scoredValues: number[] = [];

  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const index = pixel * 4;
    const scored = mask[pixel] === 1;
    const score = scored ? pixelDiff(oracle.data, rendered.data, index, options.diffColorSpace) : 0;
    diffs[pixel] = score;

    if (scored) {
      scoredValues.push(score);
      const grayValue = Math.round(score * 255);
      gray[index] = grayValue;
      gray[index + 1] = grayValue;
      gray[index + 2] = grayValue;
      gray[index + 3] = 255;

      const [hr, hg, hb] = heatmapColor(score);
      heatmap[index] = hr;
      heatmap[index + 1] = hg;
      heatmap[index + 2] = hb;
      heatmap[index + 3] = 255;

      const alpha = Math.min(0.75, Math.max(0, (score - options.highlightThreshold) / Math.max(0.0001, 1 - options.highlightThreshold)));
      overlay[index] = Math.round(oracle.data[index] * (1 - alpha) + 255 * alpha);
      overlay[index + 1] = Math.round(oracle.data[index + 1] * (1 - alpha) + 60 * alpha);
      overlay[index + 2] = Math.round(oracle.data[index + 2] * (1 - alpha));
      overlay[index + 3] = 255;

      exclusionMask[index] = 0;
      exclusionMask[index + 1] = 0;
      exclusionMask[index + 2] = 0;
      exclusionMask[index + 3] = 255;
      scoringMaskImage[index] = 255;
      scoringMaskImage[index + 1] = 255;
      scoringMaskImage[index + 2] = 255;
      scoringMaskImage[index + 3] = 255;
    } else {
      gray[index] = MASK_GRAY;
      gray[index + 1] = MASK_GRAY;
      gray[index + 2] = MASK_GRAY;
      gray[index + 3] = 255;
      heatmap[index] = MASK_GRAY;
      heatmap[index + 1] = MASK_GRAY;
      heatmap[index + 2] = MASK_GRAY;
      heatmap[index + 3] = 255;
      overlay[index] = MASK_GRAY;
      overlay[index + 1] = MASK_GRAY;
      overlay[index + 2] = MASK_GRAY;
      overlay[index + 3] = 255;
      exclusionMask[index] = 255;
      exclusionMask[index + 1] = 255;
      exclusionMask[index + 2] = 255;
      exclusionMask[index + 3] = 255;
      scoringMaskImage[index] = 0;
      scoringMaskImage[index + 1] = 0;
      scoringMaskImage[index + 2] = 0;
      scoringMaskImage[index + 3] = 255;
      maskedOracle[index] = MASK_GRAY;
      maskedOracle[index + 1] = MASK_GRAY;
      maskedOracle[index + 2] = MASK_GRAY;
      maskedOracle[index + 3] = 255;
      maskedRendered[index] = MASK_GRAY;
      maskedRendered[index + 1] = MASK_GRAY;
      maskedRendered[index + 2] = MASK_GRAY;
      maskedRendered[index + 3] = 255;
    }
  }

  return { diffs, gray, heatmap, overlay, exclusionMask, scoringMaskImage, maskedOracle, maskedRendered, scoredValues };
}

function cellBounds(row: number, col: number, gridSize: number, width: number, height: number): [number, number, number, number] {
  const left = Math.floor((col * width) / gridSize);
  const right = Math.floor(((col + 1) * width) / gridSize);
  const top = Math.floor((row * height) / gridSize);
  const bottom = Math.floor(((row + 1) * height) / gridSize);
  return [left, top, right, bottom];
}

function computeMatrix(
  width: number,
  height: number,
  mask: Uint8Array,
  diffs: Float32Array,
  options: DiffOptions,
): { cells: MatrixCell[]; compact: (number | null)[][] } {
  const cells: MatrixCell[] = [];
  const compact: (number | null)[][] = [];

  for (let row = 0; row < options.gridSize; row += 1) {
    const compactRow: (number | null)[] = [];
    for (let col = 0; col < options.gridSize; col += 1) {
      const [left, top, right, bottom] = cellBounds(row, col, options.gridSize, width, height);
      const values: number[] = [];
      const totalPixels = Math.max(1, (right - left) * (bottom - top));
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const pixel = y * width + x;
          if (mask[pixel] === 1) values.push(diffs[pixel]);
        }
      }

      const coverage = values.length / totalPixels;
      const mean = values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
      const p90 = percentile(values, 90);
      const score = 0.65 * mean + 0.35 * p90;
      const cell: MatrixCell = {
        row,
        col,
        bounds: [left, top, right, bottom],
        coverage: round(coverage),
        mean: round(mean),
        p90: round(p90),
        score: round(score),
      };
      cells.push(cell);

      if (coverage < options.minCellCoverage) {
        compactRow.push(null);
      } else if (score < options.stripeThreshold) {
        compactRow.push(0);
      } else {
        compactRow.push(round(score, 4));
      }
    }
    compact.push(compactRow);
  }

  return { cells, compact };
}

function matrixRangeForBox(box: [number, number, number, number], width: number, height: number, gridSize: number): { rows: [number, number]; cols: [number, number] } {
  const [left, top, right, bottom] = box;
  const minCol = Math.max(0, Math.min(gridSize - 1, Math.floor((left / width) * gridSize)));
  const maxCol = Math.max(0, Math.min(gridSize - 1, Math.floor(((Math.max(left, right - 1)) / width) * gridSize)));
  const minRow = Math.max(0, Math.min(gridSize - 1, Math.floor((top / height) * gridSize)));
  const maxRow = Math.max(0, Math.min(gridSize - 1, Math.floor(((Math.max(top, bottom - 1)) / height) * gridSize)));
  return { rows: [minRow, maxRow], cols: [minCol, maxCol] };
}

function computeComponents(width: number, height: number, mask: Uint8Array, diffs: Float32Array, options: DiffOptions): Component[] {
  const visited = new Uint8Array(width * height);
  const components: Component[] = [];
  const queue: number[] = [];

  for (let start = 0; start < width * height; start += 1) {
    if (visited[start] || mask[start] === 0 || diffs[start] < options.highlightThreshold) continue;

    visited[start] = 1;
    queue.length = 0;
    queue.push(start);
    let head = 0;
    let area = 0;
    let sum = 0;
    let max = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    while (head < queue.length) {
      const pixel = queue[head++];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const value = diffs[pixel];
      area += 1;
      sum += value;
      max = Math.max(max, value);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + 1);
      maxY = Math.max(maxY, y + 1);

      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (visited[next] || mask[next] === 0 || diffs[next] < options.highlightThreshold) continue;
        visited[next] = 1;
        queue.push(next);
      }
    }

    if (area < options.minComponentArea) continue;

    const range = matrixRangeForBox([minX, minY, maxX, maxY], width, height, options.gridSize);
    components.push({
      id: components.length + 1,
      bbox: [minX, minY, maxX, maxY],
      center: [round((minX + maxX) / 2), round((minY + maxY) / 2)],
      area,
      meanDiff: round(sum / area),
      maxDiff: round(max),
      matrixRows: range.rows,
      matrixCols: range.cols,
    });
  }

  return components;
}

function scanLine(values: (number | null)[], coordinates: [number, number][], minLength: number): Stripe[] {
  const stripes: Stripe[] = [];
  let runStart = -1;
  let runScores: number[] = [];

  function flush(endExclusive: number): void {
    if (runStart !== -1 && runScores.length >= minLength) {
      stripes.push({
        id: 0,
        type: "horizontal",
        start: coordinates[runStart],
        end: coordinates[endExclusive - 1],
        length: runScores.length,
        meanScore: round(runScores.reduce((sum, score) => sum + score, 0) / runScores.length),
        maxScore: round(Math.max(...runScores)),
      });
    }
    runStart = -1;
    runScores = [];
  }

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (typeof value === "number" && value > 0) {
      if (runStart === -1) runStart = index;
      runScores.push(value);
    } else {
      flush(index);
    }
  }
  flush(values.length);
  return stripes;
}

function computeStripes(compact: (number | null)[][]): Stripe[] {
  const gridSize = compact.length;
  const minLength = Math.max(3, Math.ceil(gridSize * 0.24));
  const stripes: Stripe[] = [];

  for (let row = 0; row < gridSize; row += 1) {
    const found = scanLine(compact[row], compact[row].map((_, col) => [row, col] as [number, number]), minLength)
      .map((stripe) => ({ ...stripe, type: "horizontal" as const }));
    stripes.push(...found);
  }

  for (let col = 0; col < gridSize; col += 1) {
    const values = compact.map((row) => row[col]);
    const coordinates = compact.map((_, row) => [row, col] as [number, number]);
    const found = scanLine(values, coordinates, minLength).map((stripe) => ({ ...stripe, type: "vertical" as const }));
    stripes.push(...found);
  }

  for (let offset = -gridSize + 1; offset < gridSize; offset += 1) {
    const values: (number | null)[] = [];
    const coordinates: [number, number][] = [];
    for (let row = 0; row < gridSize; row += 1) {
      const col = row + offset;
      if (col >= 0 && col < gridSize) {
        values.push(compact[row][col]);
        coordinates.push([row, col]);
      }
    }
    const found = scanLine(values, coordinates, minLength).map((stripe) => ({ ...stripe, type: "diagonal-down" as const }));
    stripes.push(...found);
  }

  for (let offset = 0; offset < gridSize * 2 - 1; offset += 1) {
    const values: (number | null)[] = [];
    const coordinates: [number, number][] = [];
    for (let row = 0; row < gridSize; row += 1) {
      const col = offset - row;
      if (col >= 0 && col < gridSize) {
        values.push(compact[row][col]);
        coordinates.push([row, col]);
      }
    }
    const found = scanLine(values, coordinates, minLength).map((stripe) => ({ ...stripe, type: "diagonal-up" as const }));
    stripes.push(...found);
  }

  return stripes.map((stripe, index) => ({ ...stripe, id: index + 1 }));
}

async function writeRgba(path: string, buffer: Buffer, width: number, height: number): Promise<void> {
  await sharp(buffer, { raw: { width, height, channels: 4 } }).png().toFile(path);
}

function relativeArtifact(path: string): string {
  return path.replace(/\\/g, "/");
}

async function writeMatrixCsv(path: string, cells: MatrixCell[]): Promise<void> {
  const lines = ["row,col,left,top,right,bottom,coverage,mean,p90,score"];
  for (const cell of cells) {
    lines.push([
      cell.row,
      cell.col,
      ...cell.bounds,
      cell.coverage,
      cell.mean,
      cell.p90,
      cell.score,
    ].join(","));
  }
  await writeFile(path, `${lines.join("\n")}\n`);
}

async function writeBlockedVerdict(path: string, summary: any): Promise<void> {
  const lines = [
    "# Masked Oracle Diff Verdict",
    "",
    `Status: ${summary.status}`,
    "",
    "## Blocked",
    "",
    `- reason: ${summary.reason}`,
    `- message: ${summary.message}`,
  ];

  if (summary.oracleDimensions && summary.renderedDimensions) {
    lines.push(
      `- oracle dimensions: ${summary.oracleDimensions.width}x${summary.oracleDimensions.height}`,
      `- rendered dimensions: ${summary.renderedDimensions.width}x${summary.renderedDimensions.height}`,
    );
  }

  await writeFile(path, `${lines.join("\n")}\n`);
}

async function writeVerdict(path: string, summary: any, components: Component[], stripes: Stripe[]): Promise<void> {
  const lines = [
    "# Masked Oracle Diff Verdict",
    "",
    `Status: ${summary.status}`,
    "",
    "## Summary",
    "",
    `- scored pixels: ${summary.scoredPixels}`,
    `- excluded pixels: ${summary.excludedPixels}`,
    `- global mean: ${summary.global.mean}`,
    `- global p95: ${summary.global.p95}`,
    `- components: ${components.length}`,
    `- stripes: ${stripes.length}`,
    "",
    "## Evidence",
    "",
    "- diff.gray.png",
    "- diff.heatmap.png",
    "- diff.overlay.png",
    "- matrix.json",
    "- components.json",
    "- stripes.json",
  ];

  if (components.length > 0) {
    lines.push("", "## Local Highlight Components", "");
    for (const component of components.slice(0, 10)) {
      lines.push(`- #${component.id}: bbox ${component.bbox.join(",")}, area ${component.area}, max ${component.maxDiff}`);
    }
  }

  if (stripes.length > 0) {
    lines.push("", "## Stripe-Like Matrix Patterns", "");
    for (const stripe of stripes.slice(0, 10)) {
      lines.push(`- #${stripe.id}: ${stripe.type}, ${stripe.start.join(",")} -> ${stripe.end.join(",")}, mean ${stripe.meanScore}`);
    }
  }

  await writeFile(path, `${lines.join("\n")}\n`);
}

export async function runMaskedOracleDiff(input: { manifestPath: string }): Promise<RunResult> {
  const { manifest, manifestDir } = await loadManifest(input.manifestPath);
  const options: DiffOptions = { ...DEFAULT_OPTIONS, ...manifest.options };
  const coordinateSpace = manifest.coordinateSpace ?? "pixel";
  const oraclePath = resolvePath(manifestDir, manifest.oracleImage);
  const renderedPath = resolvePath(manifestDir, manifest.renderedImage);
  const outputDir = resolvePath(manifestDir, manifest.outputDir);

  const oracle = await loadImage(oraclePath, options.blurSigma);
  const rendered = await loadImage(renderedPath, options.blurSigma);
  if (oracle.width !== rendered.width || oracle.height !== rendered.height) {
    const message = `Oracle and rendered images must have identical dimensions; got ${oracle.width}x${oracle.height} and ${rendered.width}x${rendered.height}`;
    const blockedSummary = {
      status: "blocked",
      reason: "input-validation-failed",
      message,
      oracleDimensions: { width: oracle.width, height: oracle.height },
      renderedDimensions: { width: rendered.width, height: rendered.height },
    };
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "summary.json"), `${JSON.stringify(blockedSummary, null, 2)}\n`);
    await writeBlockedVerdict(join(outputDir, "VERDICT.md"), blockedSummary);
    throw new Error(message);
  }

  const boxes = (manifest.exclusionBoxes ?? []).map((box) => resolveBox(box, oracle.width, oracle.height, coordinateSpace, options.maskPadding));
  const mask = buildScoringMask(oracle.width, oracle.height, boxes);
  const excludedPixels = mask.reduce((count, value) => count + (value === 0 ? 1 : 0), 0);
  const scoredPixels = mask.length - excludedPixels;
  const diffImages = computeDiffs(oracle, rendered, mask, options);
  const { cells, compact } = computeMatrix(oracle.width, oracle.height, mask, diffImages.diffs, options);
  const components = computeComponents(oracle.width, oracle.height, mask, diffImages.diffs, options);
  const stripes = computeStripes(compact);

  await mkdir(outputDir, { recursive: true });

  const normalizedManifest = {
    oracleImage: oraclePath,
    renderedImage: renderedPath,
    outputDir,
    coordinateSpace,
    dimensions: { width: oracle.width, height: oracle.height },
    exclusionBoxes: boxes,
    options,
  };

  const global = {
    mean: round(diffImages.scoredValues.reduce((sum, value) => sum + value, 0) / Math.max(1, diffImages.scoredValues.length)),
    p90: round(percentile(diffImages.scoredValues, 90)),
    p95: round(percentile(diffImages.scoredValues, 95)),
    max: round(maxValue(diffImages.scoredValues)),
  };

  const summary = {
    status: components.length > 0 || stripes.length > 0 ? "feedback-required" : "direct-inspection-required",
    dimensions: { width: oracle.width, height: oracle.height },
    scoredPixels,
    excludedPixels,
    global,
    components: {
      count: components.length,
      maxArea: maxBy(components, (component) => component.area),
      maxDiff: round(maxBy(components, (component) => component.maxDiff)),
    },
    stripes: {
      count: stripes.length,
      maxMeanScore: round(maxBy(stripes, (stripe) => stripe.meanScore)),
    },
    artifacts: {
      gray: "diff.gray.png",
      heatmap: "diff.heatmap.png",
      overlay: "diff.overlay.png",
      matrix: "matrix.json",
      components: "components.json",
      stripes: "stripes.json",
    },
  };

  await writeFile(join(outputDir, "manifest.normalized.json"), `${JSON.stringify(normalizedManifest, null, 2)}\n`);
  await writeFile(join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(join(outputDir, "matrix.json"), `${JSON.stringify({ gridSize: options.gridSize, cells, compact }, null, 2)}\n`);
  await writeMatrixCsv(join(outputDir, "matrix.csv"), cells);
  await writeFile(join(outputDir, "components.json"), `${JSON.stringify({ components }, null, 2)}\n`);
  await writeFile(join(outputDir, "stripes.json"), `${JSON.stringify({ stripes }, null, 2)}\n`);
  await writeRgba(join(outputDir, "exclusion-mask.png"), diffImages.exclusionMask, oracle.width, oracle.height);
  await writeRgba(join(outputDir, "scoring-domain-mask.png"), diffImages.scoringMaskImage, oracle.width, oracle.height);
  await writeRgba(join(outputDir, "masked-oracle-preview.png"), diffImages.maskedOracle, oracle.width, oracle.height);
  await writeRgba(join(outputDir, "masked-rendered-preview.png"), diffImages.maskedRendered, oracle.width, oracle.height);
  await writeRgba(join(outputDir, "diff.gray.png"), diffImages.gray, oracle.width, oracle.height);
  await writeRgba(join(outputDir, "diff.heatmap.png"), diffImages.heatmap, oracle.width, oracle.height);
  await writeRgba(join(outputDir, "diff.overlay.png"), diffImages.overlay, oracle.width, oracle.height);
  await writeVerdict(join(outputDir, "VERDICT.md"), summary, components, stripes);

  return {
    outputDir,
    summaryPath: join(outputDir, "summary.json"),
    verdictPath: join(outputDir, "VERDICT.md"),
  };
}

export async function main(argv = process.argv.slice(2)): Promise<RunResult> {
  const args = parseArgs(argv);
  const result = await runMaskedOracleDiff({ manifestPath: args.manifestPath });
  process.stdout.write(`${relativeArtifact(result.summaryPath)}\n`);
  return result;
}

const executedPath = process.argv[1] ? resolve(process.argv[1]) : "";
const currentPath = fileURLToPath(import.meta.url);
if (executedPath === currentPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

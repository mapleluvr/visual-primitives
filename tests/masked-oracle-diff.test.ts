import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "masked-oracle-diff-test-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function fillRect(
  buffer: Buffer,
  width: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  rgba: [number, number, number, number],
): void {
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const index = (y * width + x) * 4;
      buffer[index] = rgba[0];
      buffer[index + 1] = rgba[1];
      buffer[index + 2] = rgba[2];
      buffer[index + 3] = rgba[3];
    }
  }
}

async function writeFixturePng(
  path: string,
  width: number,
  height: number,
  mutate?: (buffer: Buffer) => void,
): Promise<void> {
  const buffer = Buffer.alloc(width * height * 4);
  fillRect(buffer, width, 0, 0, width, height, [255, 255, 255, 255]);
  mutate?.(buffer);
  await sharp(buffer, { raw: { width, height, channels: 4 } }).png().toFile(path);
}

async function readJson(path: string): Promise<any> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readPixel(path: string, x: number, y: number): Promise<[number, number, number, number]> {
  const image = sharp(path).ensureAlpha();
  const metadata = await image.metadata();
  assert.equal(typeof metadata.width, "number");
  const raw = await image.raw().toBuffer();
  const index = (y * metadata.width! + x) * 4;
  return [raw[index], raw[index + 1], raw[index + 2], raw[index + 3]];
}

function overlaps(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

test("masked-oracle-diff writes artifacts and excludes masked pixels from scoring", async () => {
  await withTempDir(async (dir) => {
    const oracle = join(dir, "oracle.png");
    const rendered = join(dir, "rendered.png");
    const manifest = join(dir, "manifest.json");
    const outputDir = join(dir, "diff-output");

    await writeFixturePng(oracle, 20, 20);
    await writeFixturePng(rendered, 20, 20, (buffer) => {
      fillRect(buffer, 20, 2, 2, 6, 6, [0, 0, 0, 255]);
      fillRect(buffer, 20, 12, 12, 16, 16, [0, 0, 255, 255]);
    });

    await writeFile(manifest, JSON.stringify({
      oracleImage: "oracle.png",
      renderedImage: "rendered.png",
      outputDir: "diff-output",
      coordinateSpace: "pixel",
      exclusionBoxes: [
        { id: "painted-region", box: [12, 12, 16, 16], reason: "not code precise" },
      ],
      options: {
        gridSize: 5,
        diffColorSpace: "rgb",
        highlightThreshold: 0.1,
        stripeThreshold: 0.1,
        minCellCoverage: 0.2,
      },
    }, null, 2));

    const { runMaskedOracleDiff } = await import("../scripts/masked-oracle-diff.ts");
    const result = await runMaskedOracleDiff({ manifestPath: manifest });

    assert.equal(result.summaryPath, join(outputDir, "summary.json"));
    for (const file of [
      "manifest.normalized.json",
      "summary.json",
      "VERDICT.md",
      "exclusion-mask.png",
      "scoring-domain-mask.png",
      "masked-oracle-preview.png",
      "masked-rendered-preview.png",
      "diff.gray.png",
      "diff.heatmap.png",
      "diff.overlay.png",
      "matrix.json",
      "matrix.csv",
      "components.json",
      "stripes.json",
    ]) {
      assert.equal(await fileExists(join(outputDir, file)), true, `${file} should exist`);
      assert.ok((await stat(join(outputDir, file))).size > 0, `${file} should not be empty`);
    }

    assert.deepEqual(await readPixel(join(outputDir, "diff.gray.png"), 0, 0), [0, 0, 0, 255]);
    assert.deepEqual(await readPixel(join(outputDir, "diff.gray.png"), 13, 13), [48, 48, 48, 255]);
    const unmaskedDiff = await readPixel(join(outputDir, "diff.gray.png"), 3, 3);
    assert.ok(unmaskedDiff[0] > 200, `expected bright unmasked diff, got ${unmaskedDiff.join(",")}`);
    assert.equal(unmaskedDiff[3], 255);

    const summary = await readJson(join(outputDir, "summary.json"));
    assert.equal(summary.status, "feedback-required");
    assert.deepEqual(summary.dimensions, { width: 20, height: 20 });
    assert.equal(summary.excludedPixels, 16);
    assert.equal(summary.scoredPixels, 384);
    assert.ok(summary.global.mean > 0);
    assert.ok(summary.components.count >= 1);
    assert.equal(summary.artifacts.gray, "diff.gray.png");

    const components = await readJson(join(outputDir, "components.json"));
    assert.equal(components.components.length, summary.components.count);
    assert.ok(components.components.some((component: any) => component.bbox[0] <= 2 && component.bbox[2] >= 6));
    assert.ok(components.components.every((component: any) => !overlaps(component.bbox, [12, 12, 16, 16])));

    const verdict = await readFile(join(outputDir, "VERDICT.md"), "utf8");
    assert.doesNotMatch(verdict, /painted-region|12,12,16,16/);

    const matrix = await readJson(join(outputDir, "matrix.json"));
    assert.equal(matrix.gridSize, 5);
    assert.equal(matrix.compact.length, 5);
    assert.equal(matrix.compact[0].length, 5);
    assert.equal(matrix.cells.length, 25);
  });
});

test("masked-oracle-diff handles large same-size images without spread overflow", async () => {
  await withTempDir(async (dir) => {
    const oracle = join(dir, "oracle.png");
    const rendered = join(dir, "rendered.png");
    const manifest = join(dir, "manifest.json");
    const outputDir = join(dir, "diff-output");

    await writeFixturePng(oracle, 512, 512);
    await writeFixturePng(rendered, 512, 512);
    await writeFile(manifest, JSON.stringify({
      oracleImage: "oracle.png",
      renderedImage: "rendered.png",
      outputDir: "diff-output",
      coordinateSpace: "pixel",
      exclusionBoxes: [],
      options: {
        diffColorSpace: "rgb",
        highlightThreshold: 0.1,
        stripeThreshold: 0.1,
      },
    }, null, 2));

    const { runMaskedOracleDiff } = await import("../scripts/masked-oracle-diff.ts");
    await runMaskedOracleDiff({ manifestPath: manifest });

    const summary = await readJson(join(outputDir, "summary.json"));
    assert.equal(summary.scoredPixels, 512 * 512);
    assert.equal(summary.global.max, 0);
    assert.equal(summary.status, "direct-inspection-required");
  });
});

test("masked-oracle-diff filters tiny noise components while preserving larger local differences", async () => {
  await withTempDir(async (dir) => {
    const oracle = join(dir, "oracle.png");
    const rendered = join(dir, "rendered.png");
    const manifest = join(dir, "manifest.json");
    const outputDir = join(dir, "diff-output");

    await writeFixturePng(oracle, 24, 24);
    await writeFixturePng(rendered, 24, 24, (buffer) => {
      fillRect(buffer, 24, 2, 2, 3, 3, [0, 0, 0, 255]);
      fillRect(buffer, 24, 10, 10, 13, 13, [0, 0, 0, 255]);
    });
    await writeFile(manifest, JSON.stringify({
      oracleImage: "oracle.png",
      renderedImage: "rendered.png",
      outputDir: "diff-output",
      coordinateSpace: "pixel",
      exclusionBoxes: [],
      options: {
        gridSize: 6,
        diffColorSpace: "rgb",
        highlightThreshold: 0.1,
        stripeThreshold: 0.1,
        minComponentArea: 4,
      },
    }, null, 2));

    const { runMaskedOracleDiff } = await import("../scripts/masked-oracle-diff.ts");
    await runMaskedOracleDiff({ manifestPath: manifest });

    const components = await readJson(join(outputDir, "components.json"));
    assert.equal(components.components.length, 1);
    assert.deepEqual(components.components[0].bbox, [10, 10, 13, 13]);
    assert.equal(components.components[0].area, 9);

    const summary = await readJson(join(outputDir, "summary.json"));
    assert.equal(summary.components.count, 1);
    assert.equal(summary.components.maxArea, 9);

    const verdict = await readFile(join(outputDir, "VERDICT.md"), "utf8");
    assert.match(verdict, /bbox 10,10,13,13/);
    assert.doesNotMatch(verdict, /bbox 2,2,3,3/);
  });
});

test("masked-oracle-diff writes blocked summary and verdict for dimension mismatch", async () => {
  await withTempDir(async (dir) => {
    const oracle = join(dir, "oracle.png");
    const rendered = join(dir, "rendered.png");
    const manifest = join(dir, "manifest.json");
    const outputDir = join(dir, "diff-output");

    await writeFixturePng(oracle, 20, 20);
    await writeFixturePng(rendered, 18, 20);
    await writeFile(manifest, JSON.stringify({
      oracleImage: "oracle.png",
      renderedImage: "rendered.png",
      outputDir: "diff-output",
      coordinateSpace: "pixel",
      exclusionBoxes: [],
    }, null, 2));

    const { runMaskedOracleDiff } = await import("../scripts/masked-oracle-diff.ts");
    await assert.rejects(
      () => runMaskedOracleDiff({ manifestPath: manifest }),
      /identical dimensions/,
    );

    const summary = await readJson(join(outputDir, "summary.json"));
    assert.equal(summary.status, "blocked");
    assert.equal(summary.reason, "input-validation-failed");
    assert.match(summary.message, /identical dimensions/);
    assert.deepEqual(summary.oracleDimensions, { width: 20, height: 20 });
    assert.deepEqual(summary.renderedDimensions, { width: 18, height: 20 });

    const verdict = await readFile(join(outputDir, "VERDICT.md"), "utf8");
    assert.match(verdict, /Status: blocked/);
    assert.match(verdict, /identical dimensions/);
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { cropBoundingBox, resolvePixelBoxForTest } from "../src/crop.ts";

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "pi-visual-primitives-test-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function createFixture(path: string, width = 100, height = 80): Promise<void> {
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 120, g: 80, b: 40, alpha: 1 },
    },
  }).png().toFile(path);
}

async function imageSize(path: string): Promise<{ width: number; height: number }> {
  const metadata = await sharp(path).metadata();
  assert.equal(typeof metadata.width, "number");
  assert.equal(typeof metadata.height, "number");
  return { width: metadata.width!, height: metadata.height! };
}

test("resolves pixel left-top-right-bottom boxes", () => {
  const result = resolvePixelBoxForTest([10, 20, 60, 80], { width: 100, height: 100 }, {
    coordinateSpace: "pixel",
    origin: "top-left",
    boxOrder: "left-top-right-bottom",
  });

  assert.deepEqual(result.resolvedPixelBox, {
    left: 10,
    top: 20,
    right: 60,
    bottom: 80,
    width: 50,
    height: 60,
  });
  assert.equal(result.clamped, false);
});

test("resolves normalized 0-999 boxes", () => {
  const result = resolvePixelBoxForTest([0, 0, 999, 999], { width: 100, height: 50 }, {
    coordinateSpace: "normalized-999",
  });

  assert.deepEqual(result.resolvedPixelBox, {
    left: 0,
    top: 0,
    right: 100,
    bottom: 50,
    width: 100,
    height: 50,
  });
});

test("resolves bottom-left origin with left-bottom-right-top order", () => {
  const result = resolvePixelBoxForTest([10, 20, 60, 80], { width: 100, height: 100 }, {
    coordinateSpace: "pixel",
    origin: "bottom-left",
    boxOrder: "left-bottom-right-top",
  });

  assert.deepEqual(result.resolvedPixelBox, {
    left: 10,
    top: 20,
    right: 60,
    bottom: 80,
    width: 50,
    height: 60,
  });
});

test("applies padding before clamp", () => {
  const result = resolvePixelBoxForTest([10, 20, 60, 80], { width: 100, height: 100 }, {
    coordinateSpace: "pixel",
    padding: 5,
  });

  assert.deepEqual(result.resolvedPixelBox, {
    left: 5,
    top: 15,
    right: 65,
    bottom: 85,
    width: 60,
    height: 70,
  });
});

test("clamps out-of-bounds boxes by default", () => {
  const result = resolvePixelBoxForTest([-10, -20, 120, 130], { width: 100, height: 100 }, {
    coordinateSpace: "pixel",
  });

  assert.deepEqual(result.unclampedPixelBox, {
    left: -10,
    top: -20,
    right: 120,
    bottom: 130,
    width: 130,
    height: 150,
  });
  assert.deepEqual(result.resolvedPixelBox, {
    left: 0,
    top: 0,
    right: 100,
    bottom: 100,
    width: 100,
    height: 100,
  });
  assert.equal(result.clamped, true);
});

test("throws on out-of-bounds boxes when clamp is false", () => {
  assert.throws(
    () => resolvePixelBoxForTest([-10, 0, 50, 50], { width: 100, height: 100 }, {
      coordinateSpace: "pixel",
      clamp: false,
    }),
    /outside image bounds/,
  );
});

test("throws on invalid coordinates and zero-area boxes", () => {
  assert.throws(
    () => resolvePixelBoxForTest([0, Number.NaN, 10, 10], { width: 100, height: 100 }, { coordinateSpace: "pixel" }),
    /finite numbers/,
  );

  assert.throws(
    () => resolvePixelBoxForTest([10, 10, 10, 20], { width: 100, height: 100 }, { coordinateSpace: "pixel" }),
    /positive width and height/,
  );

  assert.throws(
    () => resolvePixelBoxForTest([0, 0, 10, 10], { width: 100, height: 100 }, { coordinateSpace: "pixel", padding: -1 }),
    /padding must be a finite non-negative number/,
  );
});

test("cropBoundingBox writes an explicit pixel-space crop", async () => {
  await withTempDir(async (dir) => {
    const source = join(dir, "source.png");
    const output = join(dir, "crop.png");
    await createFixture(source, 100, 80);

    const details = await cropBoundingBox({
      imagePath: source,
      outputPath: output,
      box: [10, 20, 60, 50],
      coordinateSpace: "pixel",
    }, { cwd: dir });

    assert.equal(details.outputPath, output);
    assert.deepEqual(await imageSize(output), { width: 50, height: 30 });
    assert.deepEqual(details.source, { width: 100, height: 80, format: "png" });
    assert.deepEqual(details.resolvedPixelBox, {
      left: 10,
      top: 20,
      right: 60,
      bottom: 50,
      width: 50,
      height: 30,
    });
    assert.equal(details.clamped, false);
  });
});

test("cropBoundingBox generates a default output path", async () => {
  await withTempDir(async (dir) => {
    const source = join(dir, "source.png");
    await createFixture(source, 100, 80);

    const details = await cropBoundingBox({
      imagePath: "source.png",
      box: [0, 0, 999, 999],
    }, { cwd: dir });

    assert.match(details.outputPath, /source\.crop-[a-f0-9]{12}\.png$/);
    assert.deepEqual(await imageSize(details.outputPath), { width: 100, height: 80 });
    assert.deepEqual(details.input, {
      box: [0, 0, 999, 999],
      coordinateSpace: "normalized-999",
      origin: "top-left",
      boxOrder: "left-top-right-bottom",
      padding: 0,
      clamp: true,
    });
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import * as phase2Module from "../src/phase2.ts";

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "pi-visual-primitives-phase2-test-"));
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

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test("cropMultipleBoundingBoxes writes labeled deterministic crops", async () => {
  await withTempDir(async (dir) => {
    const source = join(dir, "source.png");
    await createFixture(source, 100, 80);

    const { cropMultipleBoundingBoxes } = phase2Module as any;
    const details = await cropMultipleBoundingBoxes({
      imagePath: "source.png",
      outputDir: "crops",
      boxes: [
        { label: "top left", box: [0, 0, 20, 20] },
        { label: "target#2", box: [20, 10, 50, 40] },
      ],
      coordinateSpace: "pixel",
    }, { cwd: dir });

    assert.equal(details.crops.length, 2);
    assert.equal(details.crops[0].index, 0);
    assert.equal(details.crops[0].label, "top left");
    assert.match(details.crops[0].outputPath, /crops[\\/]source\.crop-001-top-left-[a-f0-9]{12}\.png$/);
    assert.match(details.crops[1].outputPath, /crops[\\/]source\.crop-002-target-2-[a-f0-9]{12}\.png$/);
    assert.deepEqual(await imageSize(details.crops[0].outputPath), { width: 20, height: 20 });
    assert.deepEqual(await imageSize(details.crops[1].outputPath), { width: 30, height: 30 });
    assert.deepEqual(details.crops[1].resolvedPixelBox, {
      left: 20,
      top: 10,
      right: 50,
      bottom: 40,
      width: 30,
      height: 30,
    });
  });
});

test("cropMultipleBoundingBoxes fails fast on an invalid first box", async () => {
  await withTempDir(async (dir) => {
    const source = join(dir, "source.png");
    const laterOutput = join(dir, "later.png");
    await createFixture(source, 100, 80);

    const { cropMultipleBoundingBoxes } = phase2Module as any;
    await assert.rejects(
      () => cropMultipleBoundingBoxes({
        imagePath: source,
        boxes: [
          { box: [10, 10, 10, 20], label: "bad" },
          { box: [0, 0, 10, 10], outputPath: laterOutput },
        ],
        coordinateSpace: "pixel",
      }, { cwd: dir }),
      /positive width and height/,
    );

    assert.equal(await fileExists(laterOutput), false);
  });
});

test("annotateBoundingBoxes writes a same-size annotated preview", async () => {
  await withTempDir(async (dir) => {
    const source = join(dir, "source.png");
    const output = join(dir, "annotated.png");
    await createFixture(source, 120, 90);

    const { annotateBoundingBoxes } = phase2Module as any;
    const details = await annotateBoundingBoxes({
      imagePath: "source.png",
      outputPath: output,
      boxes: [
        { label: "target", box: [10, 15, 50, 55] },
      ],
      coordinateSpace: "pixel",
    }, { cwd: dir });

    assert.equal(details.outputPath, output);
    assert.deepEqual(await imageSize(output), { width: 120, height: 90 });
    assert.equal(details.boxes.length, 1);
    assert.equal(details.boxes[0].label, "target");
    assert.deepEqual(details.boxes[0].resolvedPixelBox, {
      left: 10,
      top: 15,
      right: 50,
      bottom: 55,
      width: 40,
      height: 40,
    });
  });
});

test("annotateBoundingBoxes does not create crop side artifacts", async () => {
  await withTempDir(async (dir) => {
    const source = join(dir, "source.png");
    const output = join(dir, "annotated.png");
    await createFixture(source, 120, 90);

    const { annotateBoundingBoxes } = phase2Module as any;
    await annotateBoundingBoxes({
      imagePath: "source.png",
      outputPath: output,
      boxes: [
        { label: "target", box: [10, 15, 50, 55] },
      ],
      coordinateSpace: "pixel",
    }, { cwd: dir });

    const files = await readdir(dir);
    assert.deepEqual(files.sort(), ["annotated.png", "source.png"]);
  });
});

test("cropAroundPoint crops around an explicit pixel radius", async () => {
  await withTempDir(async (dir) => {
    const source = join(dir, "source.png");
    const output = join(dir, "point.png");
    await createFixture(source, 100, 80);

    const { cropAroundPoint } = phase2Module as any;
    const details = await cropAroundPoint({
      imagePath: "source.png",
      outputPath: output,
      point: [50, 40],
      radius: 10,
      coordinateSpace: "pixel",
    }, { cwd: dir });

    assert.equal(details.outputPath, output);
    assert.deepEqual(await imageSize(output), { width: 20, height: 20 });
    assert.deepEqual(details.resolvedPixelBox, {
      left: 40,
      top: 30,
      right: 60,
      bottom: 50,
      width: 20,
      height: 20,
    });
    assert.deepEqual(details.input.point, [50, 40]);
  });
});

test("cropAroundPoint requires an explicit radius or size", async () => {
  await withTempDir(async (dir) => {
    const source = join(dir, "source.png");
    await createFixture(source, 100, 80);

    const { cropAroundPoint } = phase2Module as any;
    await assert.rejects(
      () => cropAroundPoint({
        imagePath: source,
        point: [50, 40],
        coordinateSpace: "pixel",
      }, { cwd: dir }),
      /radius or size/,
    );
  });
});

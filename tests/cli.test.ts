import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
const CLI_PATH = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const PACKAGE_JSON_PATH = fileURLToPath(new URL("../package.json", import.meta.url));

async function runCli(args: string[], options: { cwd?: string } = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [CLI_PATH, ...args], { cwd: options.cwd });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failed.code ?? 1, stdout: failed.stdout ?? "", stderr: failed.stderr ?? "" };
  }
}

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "visual-primitives-cli-test-"));
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
  return { width: metadata.width!, height: metadata.height! };
}

test("vp --help lists all commands", async () => {
  const result = await runCli(["--help"]);
  assert.equal(result.code, 0);
  for (const command of ["crop", "crop-multi", "annotate", "point", "colors"]) {
    assert.match(result.stdout, new RegExp(`\\b${command}\\b`));
  }
});

test("package manifest exposes the scoped CLI without a Pi extension peer", async () => {
  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_PATH, "utf8"));

  assert.equal(packageJson.name, "@mapleluvr/visual-primitives");
  assert.deepEqual(packageJson.bin, {
    vp: "./dist/cli.js",
    "visual-primitives": "./dist/cli.js",
  });
  assert.equal(packageJson.peerDependencies?.["@earendil-works/pi-coding-agent"], undefined);
  assert.equal(packageJson.pi?.extensions, undefined);
});

test("vp version is derived from the package manifest", async () => {
  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_PATH, "utf8"));
  const source = await readFile(CLI_PATH, "utf8");
  const result = await runCli(["--version"]);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout.trim(), packageJson.version);
  assert.doesNotMatch(source, /const VERSION\s*=\s*["'][^"']+["']/);
});

test("vp crop crops a pixel box and prints details JSON", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    const out = join(dir, "crop.png");
    await createFixture(image);

    const result = await runCli(["crop", image, "--box", "10,20,60,80", "--space", "pixel", "--out", out]);
    assert.equal(result.code, 0, result.stderr);

    const details = JSON.parse(result.stdout);
    assert.equal(details.resolvedPixelBox.width, 50);
    assert.equal(details.resolvedPixelBox.height, 60);
    assert.equal(details.input.coordinateSpace, "pixel");
    assert.deepEqual(await imageSize(out), { width: 50, height: 60 });
  });
});

test("vp crop resolves relative paths against the working directory", async () => {
  await withTempDir(async (dir) => {
    await createFixture(join(dir, "scene.png"));

    const result = await runCli(["crop", "scene.png", "--box", "0,0,40,40", "--space", "pixel", "--out", "out.png"], { cwd: dir });
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(await imageSize(join(dir, "out.png")), { width: 40, height: 40 });
  });
});

test("vp crop-multi crops labeled boxes into --out-dir", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    const outDir = join(dir, "crops");
    await createFixture(image);

    const result = await runCli([
      "crop-multi", image, "--space", "pixel", "--out-dir", outDir,
      "--box", "title:10,10,50,30",
      "--box", "button:20,40,80,70",
    ]);
    assert.equal(result.code, 0, result.stderr);

    const details = JSON.parse(result.stdout);
    assert.equal(details.crops.length, 2);
    assert.equal(details.crops[0].label, "title");
    assert.equal(details.crops[1].label, "button");

    const files = await readdir(outDir);
    assert.equal(files.length, 2);
    assert.ok(files.some((file) => file.includes("title")));
    assert.ok(files.some((file) => file.includes("button")));
  });
});

test("vp annotate keeps source dimensions and accepts per-box colors", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    const out = join(dir, "annotated.png");
    await createFixture(image);

    const result = await runCli([
      "annotate", image, "--space", "pixel", "--out", out,
      "--box", "target:10,10,60,50",
      "--box", "header:0,0,99,20:#00aaff",
    ]);
    assert.equal(result.code, 0, result.stderr);

    const details = JSON.parse(result.stdout);
    assert.equal(details.boxes.length, 2);
    assert.deepEqual(await imageSize(out), { width: 100, height: 80 });
  });
});

test("vp point crops around a point with a radius", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    const out = join(dir, "point.png");
    await createFixture(image);

    const result = await runCli(["point", image, "--point", "50,40", "--radius", "10", "--space", "pixel", "--out", out]);
    assert.equal(result.code, 0, result.stderr);

    const details = JSON.parse(result.stdout);
    assert.deepEqual(details.input.point, [50, 40]);
    assert.equal(details.input.radius, 10);
    assert.deepEqual(await imageSize(out), { width: 20, height: 20 });
  });
});

test("vp point accepts --size WxH", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    const out = join(dir, "sized.png");
    await createFixture(image);

    const result = await runCli(["point", image, "--point", "50,40", "--size", "30x20", "--space", "pixel", "--out", out]);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(await imageSize(out), { width: 30, height: 20 });
  });
});

test("vp colors samples the fixture color", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    await createFixture(image);

    const result = await runCli(["colors", image, "--space", "pixel", "--patch", "3", "--point", "center:50,40"]);
    assert.equal(result.code, 0, result.stderr);

    const details = JSON.parse(result.stdout);
    assert.equal(details.samples.length, 1);
    assert.equal(details.samples[0].label, "center");
    assert.equal(details.samples[0].hex, "#785028");
    assert.equal(details.samples[0].patch.meanHex, "#785028");
    assert.equal(details.input.patchSize, 3);
  });
});

test("vp crop --json accepts the original tool input shape", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    const out = join(dir, "from-json.png");
    await createFixture(image);

    const inputPath = join(dir, "input.json");
    await writeFile(inputPath, JSON.stringify({
      imagePath: image,
      box: [10, 20, 60, 80],
      coordinateSpace: "pixel",
      outputPath: out,
    }));

    const result = await runCli(["crop", "--json", inputPath]);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(await imageSize(out), { width: 50, height: 60 });
  });
});

test("vp crop defaults to pixel coordinates", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    const out = join(dir, "default-space.png");
    await createFixture(image);

    const result = await runCli(["crop", image, "--box", "10,20,60,80", "--out", out]);
    assert.equal(result.code, 0, result.stderr);

    const details = JSON.parse(result.stdout);
    assert.equal(details.input.coordinateSpace, "pixel");
    assert.deepEqual(await imageSize(out), { width: 50, height: 60 });
  });
});

test("vp crop --json keeps the original normalized-999 default", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    const out = join(dir, "json-space.png");
    await createFixture(image);

    const inputPath = join(dir, "input.json");
    await writeFile(inputPath, JSON.stringify({ imagePath: image, box: [0, 0, 999, 999], outputPath: out }));

    const result = await runCli(["crop", "--json", inputPath]);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).input.coordinateSpace, "normalized-999");
    assert.deepEqual(await imageSize(out), { width: 100, height: 80 });
  });
});

test("generated artifacts default to the working directory, not the source directory", async () => {
  await withTempDir(async (dir) => {
    const sourceDir = join(dir, "assets");
    await mkdir(sourceDir);
    const image = join(sourceDir, "scene.png");
    await createFixture(image);

    const result = await runCli(["crop", image, "--box", "0,0,40,40"], { cwd: dir });
    assert.equal(result.code, 0, result.stderr);

    const details = JSON.parse(result.stdout);
    assert.ok(!details.outputPath.includes("assets"), `expected artifact outside assets/: ${details.outputPath}`);
    const files = await readdir(dir);
    assert.ok(files.some((file) => file.startsWith("scene.crop-")), files.join(", "));
  });
});

test("a one-line summary is printed to stderr unless --quiet", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    const out = join(dir, "sum.png");
    await createFixture(image);

    const result = await runCli(["crop", image, "--box", "10,20,60,80", "--out", out]);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stderr, /cropped → .*sum\.png \(50×60px\)/);
    assert.doesNotMatch(result.stdout, /cropped →/);

    const quiet = await runCli(["crop", image, "--box", "10,20,60,80", "--out", join(dir, "quiet.png"), "--quiet"]);
    assert.equal(quiet.code, 0, quiet.stderr);
    assert.equal(quiet.stderr.trim(), "");
  });
});

test("vp crop rejects repeated --box with a crop-multi hint", async () => {
  const result = await runCli(["crop", "x.png", "--box", "0,0,1,1", "--box", "2,2,3,3"]);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /crop-multi/);
});

test("vp point requires --radius or --size up front", async () => {
  const missing = await runCli(["point", "x.png", "--point", "5,5"]);
  assert.equal(missing.code, 2);
  assert.match(missing.stderr, /--radius or --size/);

  const both = await runCli(["point", "x.png", "--point", "5,5", "--radius", "3", "--size", "4x4"]);
  assert.equal(both.code, 2);
  assert.match(both.stderr, /mutually exclusive/);
});

test("--json payloads are validated: bad enums and missing keys are rejected", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    await createFixture(image);

    const badEnum = join(dir, "bad-enum.json");
    await writeFile(badEnum, JSON.stringify({ imagePath: image, box: [0, 0, 10, 10], coordinateSpace: "bogus" }));
    const enumResult = await runCli(["crop", "--json", badEnum]);
    assert.equal(enumResult.code, 2);
    assert.match(enumResult.stderr, /"coordinateSpace" must be one of: normalized-999, pixel/);

    const noImage = join(dir, "no-image.json");
    await writeFile(noImage, JSON.stringify({ image: image, box: [0, 0, 10, 10] }));
    const imageResult = await runCli(["crop", "--json", noImage]);
    assert.equal(imageResult.code, 2);
    assert.match(imageResult.stderr, /"imagePath"/);

    const noRadius = join(dir, "no-radius.json");
    await writeFile(noRadius, JSON.stringify({ imagePath: image, point: [5, 5] }));
    const radiusResult = await runCli(["point", "--json", noRadius]);
    assert.equal(radiusResult.code, 2);
    assert.match(radiusResult.stderr, /"radius" or "size"/);

    const missingFile = await runCli(["crop", "--json", join(dir, "nope.json")]);
    assert.equal(missingFile.code, 2);
    assert.match(missingFile.stderr, /--json file not found/);
  });
});

test("JSON mode rejects unknown top-level and nested properties", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    await createFixture(image);

    const topLevel = join(dir, "top-level.json");
    await writeFile(topLevel, JSON.stringify({ imagePath: image, box: [0, 0, 10, 10], unexpected: true }));
    const topLevelResult = await runCli(["crop", "--json", topLevel]);
    assert.equal(topLevelResult.code, 2, topLevelResult.stderr);
    assert.match(topLevelResult.stderr, /unknown property "unexpected"/);

    const nested = join(dir, "nested.json");
    await writeFile(nested, JSON.stringify({
      imagePath: image,
      outputDir: dir,
      boxes: [{ box: [0, 0, 10, 10], unexpected: true }],
    }));
    const nestedResult = await runCli(["crop-multi", "--json", nested]);
    assert.equal(nestedResult.code, 2, nestedResult.stderr);
    assert.match(nestedResult.stderr, /boxes\[0\].*unknown property "unexpected"/);
  });
});

test("JSON mode rejects invalid optional-property types before runtime", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    await createFixture(image);

    const cases = [
      {
        command: "crop",
        name: "string-clamp",
        payload: { imagePath: image, box: [-5, -5, 10, 10], clamp: "false", outputPath: join(dir, "clamp.png") },
        message: /"clamp" must be a boolean/,
      },
      {
        command: "crop-multi",
        name: "numeric-label",
        payload: { imagePath: image, boxes: [{ box: [0, 0, 10, 10], label: 42 }], outputDir: dir },
        message: /boxes\[0\]\.label.*string/,
      },
      {
        command: "point",
        name: "string-size",
        payload: { imagePath: image, point: [5, 5], size: { width: "10", height: 10 }, outputPath: join(dir, "point.png") },
        message: /size\.width.*number/,
      },
    ] as const;

    for (const item of cases) {
      const inputPath = join(dir, `${item.name}.json`);
      await writeFile(inputPath, JSON.stringify(item.payload));
      const result = await runCli([item.command, "--json", inputPath]);
      assert.equal(result.code, 2, `${item.name}: ${result.stderr}`);
      assert.match(result.stderr, item.message);
    }
  });
});

test("JSON mode rejects non-finite numbers before runtime", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    await createFixture(image);
    const inputPath = join(dir, "infinite-radius.json");
    await writeFile(inputPath, `{"imagePath":${JSON.stringify(image)},"point":[5,5],"radius":1e400}`);

    const result = await runCli(["point", "--json", inputPath]);
    assert.equal(result.code, 2, result.stderr);
    assert.match(result.stderr, /"radius" must be a finite positive number/);
  });
});

test("JSON mode rejects command-inapplicable properties", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    await createFixture(image);
    const inputPath = join(dir, "colors-padding.json");
    await writeFile(inputPath, JSON.stringify({
      imagePath: image,
      points: [{ point: [5, 5] }],
      padding: 2,
    }));

    const result = await runCli(["colors", "--json", inputPath]);
    assert.equal(result.code, 2, result.stderr);
    assert.match(result.stderr, /unknown property "padding"/);
  });
});

test("colors rejects command-inapplicable flags in flag and JSON modes", async () => {
  const padding = await runCli(["colors", "x.png", "--point", "1,1", "--padding", "2"]);
  assert.equal(padding.code, 2, padding.stderr);
  assert.match(padding.stderr, /--padding does not apply/);

  const clamp = await runCli(["colors", "x.png", "--point", "1,1", "--no-clamp"]);
  assert.equal(clamp.code, 2, clamp.stderr);
  assert.match(clamp.stderr, /--no-clamp does not apply/);

  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    await createFixture(image);
    const inputPath = join(dir, "colors.json");
    await writeFile(inputPath, JSON.stringify({ imagePath: image, coordinateSpace: "pixel", points: [{ point: [1, 1] }] }));

    for (const flags of [["--padding", "2"], ["--no-clamp"], ["--box-order", "ltrb"]]) {
      const result = await runCli(["colors", "--json", inputPath, ...flags]);
      assert.equal(result.code, 2, `${flags.join(" ")}: ${result.stderr}`);
      assert.match(result.stderr, /does not apply/);
    }
  });
});

test("annotate accepts Sharp CSS colors and rejects malformed numeric syntax", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    const hslOut = join(dir, "hsl.png");
    const modernOut = join(dir, "modern.png");
    await createFixture(image);

    for (const invalidColor of ["notacolor", "rgb(0x10,0,0)"]) {
      const invalid = await runCli(["annotate", image, "--box", `x:10,10,50,50:${invalidColor}`]);
      assert.equal(invalid.code, 2, invalid.stderr);
      assert.match(invalid.stderr, /invalid --box color/);
    }

    const bareHex = await runCli(["annotate", image, "--box", "x:10,10,50,50:ff0000"]);
    assert.equal(bareHex.code, 2);
    assert.match(bareHex.stderr, /did you mean "#ff0000"\?/);

    const hsl = await runCli(["annotate", image, "--box", "x:10,10,50,50:hsl(0, 100%, 50%)", "--out", hslOut]);
    assert.equal(hsl.code, 0, hsl.stderr);

    const modernInput = join(dir, "modern.json");
    await writeFile(modernInput, JSON.stringify({
      imagePath: image,
      coordinateSpace: "pixel",
      outputPath: modernOut,
      boxes: [{ box: [10, 10, 50, 50], color: "rgb(255 0 0 / 50%)" }],
    }));
    const modern = await runCli(["annotate", "--json", modernInput]);
    assert.equal(modern.code, 0, modern.stderr);

    const malformedInput = join(dir, "malformed.json");
    await writeFile(malformedInput, JSON.stringify({
      imagePath: image,
      coordinateSpace: "pixel",
      outputPath: join(dir, "malformed.png"),
      boxes: [{ box: [10, 10, 50, 50], color: "rgb(0x10,0,0)" }],
    }));
    const malformed = await runCli(["annotate", "--json", malformedInput]);
    assert.equal(malformed.code, 2, malformed.stderr);
    assert.match(malformed.stderr, /not a valid CSS color/);

    for (const out of [hslOut, modernOut]) {
      const raw = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const offset = (10 * raw.info.width + 30) * 4;
      assert.ok(raw.data[offset] > 100 && raw.data[offset + 1] < 100, `expected red stroke in ${out}`);
    }
  });
});

test("--quiet suppresses warning-producing stderr", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    await createFixture(image);

    const result = await runCli([
      "crop",
      image,
      "--box",
      "0,0,10,10",
      "--out",
      join(dir, "quiet.jpg"),
      "--quiet",
    ]);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stderr, "");
  });
});

test("colors flags out-of-bounds points as clamped and warns", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    await createFixture(image);

    const result = await runCli(["colors", image, "--point", "500,500"]);
    assert.equal(result.code, 0, result.stderr);
    const details = JSON.parse(result.stdout);
    assert.equal(details.samples[0].clamped, true);
    assert.deepEqual(details.samples[0].resolvedPixelPoint, { x: 99, y: 79 });
    assert.match(result.stderr, /warning: point #1 \[500, 500\] is outside the image/);

    const inside = await runCli(["colors", image, "--point", "10,10"]);
    assert.equal(JSON.parse(inside.stdout).samples[0].clamped, false);
  });
});

test("flag validation errors exit with code 2, not 1", async () => {
  const padding = await runCli(["crop", "x.png", "--box", "0,0,10,10", "--padding=-5"]);
  assert.equal(padding.code, 2);
  assert.match(padding.stderr, /--padding must be zero or a positive/);

  const patch = await runCli(["colors", "x.png", "--point", "1,1", "--patch", "0"]);
  assert.equal(patch.code, 2);
  assert.match(patch.stderr, /--patch must be a positive integer/);

  const radius = await runCli(["point", "x.png", "--point", "1,1", "--radius", "0"]);
  assert.equal(radius.code, 2);
  assert.match(radius.stderr, /--radius must be a positive number/);

  for (const args of [["--size", "0x10"], ["--size=-1x10"]]) {
    const size = await runCli(["point", "x.png", "--point", "1,1", ...args]);
    assert.equal(size.code, 2, size.stderr);
    assert.match(size.stderr, /--size width and height must be positive numbers/);
  }
});

test("vp help with a typo suggests the right command", async () => {
  const result = await runCli(["help", "crp"]);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /did you mean "vp help crop"\?/);
});

test("coordinates with spaces after commas are accepted", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    const out = join(dir, "spaced.png");
    await createFixture(image);

    const result = await runCli(["crop", image, "--box", "10, 20, 60, 80", "--out", out]);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(await imageSize(out), { width: 50, height: 60 });
  });
});

test("non-png --out extensions warn", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    await createFixture(image);

    const result = await runCli(["crop", image, "--box", "0,0,10,10", "--out", join(dir, "crop.jpg")]);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stderr, /warning: output is always PNG data/);
  });
});

test("EXIF-oriented images trigger a warning", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "rotated.jpg");
    await sharp({ create: { width: 100, height: 80, channels: 3, background: { r: 10, g: 20, b: 30 } } })
      .jpeg().withMetadata({ orientation: 6 }).toFile(image);

    const result = await runCli(["crop", image, "--box", "0,0,50,40", "--out", join(dir, "out.png")]);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stderr, /warning: image has EXIF orientation 6/);
  });
});

test("--json files with a UTF-8 BOM are accepted", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    const out = join(dir, "bom.png");
    await createFixture(image);

    const inputPath = join(dir, "input.json");
    await writeFile(inputPath, String.fromCharCode(0xfeff) + JSON.stringify({ imagePath: image, box: [0, 0, 10, 10], coordinateSpace: "pixel", outputPath: out }));

    const result = await runCli(["crop", "--json", inputPath]);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(await imageSize(out), { width: 10, height: 10 });
  });
});

test("usage errors exit with code 2", async () => {
  const missingBox = await runCli(["crop", "whatever.png"]);
  assert.equal(missingBox.code, 2);
  assert.match(missingBox.stderr, /--box/);

  const unknownCommand = await runCli(["frobnicate"]);
  assert.equal(unknownCommand.code, 2);
  assert.match(unknownCommand.stderr, /unknown command/);

  const badSpace = await runCli(["crop", "x.png", "--box", "0,0,1,1", "--space", "bogus"]);
  assert.equal(badSpace.code, 2);
  assert.match(badSpace.stderr, /--space/);
});

test("fully out-of-bounds boxes explain themselves and hint at --space 999", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    await createFixture(image);

    const result = await runCli(["crop", image, "--box", "500,500,900,900"]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /completely outside the 100x80 image/);
    assert.match(result.stderr, /--space 999/);
  });
});

test("unknown options and commands get did-you-mean suggestions", async () => {
  const option = await runCli(["crop", "x.png", "--box", "0,0,1,1", "--boxorder", "lbrt"]);
  assert.equal(option.code, 2);
  assert.match(option.stderr, /did you mean '--box-order'\?/);

  const command = await runCli(["color"]);
  assert.equal(command.code, 2);
  assert.match(command.stderr, /did you mean "colors"\?/);
});

test("missing arguments are aggregated with a usage line and help hint", async () => {
  const result = await runCli(["crop"]);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /missing <image> and --box/);
  assert.match(result.stderr, /Usage: vp crop/);
  assert.match(result.stderr, /run "vp crop --help" for details/);
});

test("vp help <command> routes to the command help", async () => {
  const result = await runCli(["help", "crop"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /^Usage: vp crop/);
});

test("severe clamping produces a warning", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    await createFixture(image);

    const result = await runCli(["crop", image, "--box", "0,0,2000,2000", "--out", join(dir, "clamped.png")]);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stderr, /warning: (over )?\d+% of the requested box was outside the image/);
  });
});

test("even --patch values warn about rounding", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    await createFixture(image);

    const result = await runCli(["colors", image, "--point", "10,10", "--patch", "4"]);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stderr, /--patch 4 is even; using 5/);
    assert.equal(JSON.parse(result.stdout).input.patchSize, 5);
  });
});

test("overwriting an explicit --out warns", async () => {
  await withTempDir(async (dir) => {
    const image = join(dir, "scene.png");
    const out = join(dir, "same.png");
    await createFixture(image);

    const first = await runCli(["crop", image, "--box", "0,0,10,10", "--out", out]);
    assert.equal(first.code, 0, first.stderr);
    assert.doesNotMatch(first.stderr, /overwriting/);

    const second = await runCli(["crop", image, "--box", "0,0,10,10", "--out", out]);
    assert.equal(second.code, 0, second.stderr);
    assert.match(second.stderr, /warning: overwriting existing/);
  });
});

test("misspelled image paths suggest a nearby file", async () => {
  await withTempDir(async (dir) => {
    await createFixture(join(dir, "scene-v2.png"));

    const result = await runCli(["crop", join(dir, "scene-v2.jpg"), "--box", "0,0,10,10"]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /did you mean ".*scene-v2\.png"\?/);
  });
});

test("runtime errors exit with code 1", async () => {
  const result = await runCli(["crop", "does-not-exist.png", "--box", "0,0,10,10", "--space", "pixel"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /missing or cannot be read/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { registerVisualPrimitives } from "../src/extension.ts";

interface RegisteredTool {
  name: string;
  label: string;
  description: string;
  promptSnippet?: string;
  promptGuidelines?: string[];
  parameters: unknown;
  execute: (
    toolCallId: string,
    params: any,
    signal?: AbortSignal,
    onUpdate?: unknown,
    ctx?: { cwd?: string },
  ) => Promise<{ content: Array<{ type: "text"; text: string }>; details?: unknown }>;
}

function registeredTools(): RegisteredTool[] {
  const tools: RegisteredTool[] = [];
  const pi = {
    registerTool(tool: RegisteredTool) {
      tools.push(tool);
    },
  };

  registerVisualPrimitives(pi, { pluginDir: "/plugin" });
  return tools;
}

test("registerVisualPrimitives registers crop_bounding_box", () => {
  const tools = registeredTools();
  const tool = tools.find((candidate) => candidate.name === "crop_bounding_box");

  assert.ok(tool);
  assert.equal(tool.label, "Crop Bounding Box");
  assert.match(tool.description, /visual-primitive normalized 0-999/);
  assert.match(tool.promptSnippet ?? "", /visually relevant region/);
  assert.ok(tool.promptGuidelines?.some((line) => line.includes("bottom-left")));
  assert.deepEqual(tool.parameters, {
    type: "object",
    additionalProperties: false,
    required: ["imagePath", "box"],
    properties: {
      imagePath: {
        type: "string",
        description: "Source image path. Relative paths resolve against the current Pi working directory. A leading @ is ignored.",
      },
      box: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: { type: "number" },
        description: "Bounding box coordinates. Defaults to normalized 0-999 [left, top, right, bottom].",
      },
      coordinateSpace: {
        type: "string",
        enum: ["normalized-999", "pixel"],
        description: "Coordinate space for box values. Defaults to normalized-999, matching visual-primitives paper examples.",
      },
      origin: {
        type: "string",
        enum: ["top-left", "bottom-left"],
        description: "Coordinate origin. top-left means y grows downward; bottom-left means y grows upward. Defaults to top-left.",
      },
      boxOrder: {
        type: "string",
        enum: ["left-top-right-bottom", "left-bottom-right-top"],
        description: "Input box order. Defaults to left-top-right-bottom. Use left-bottom-right-top for bottom-left style boxes.",
      },
      outputPath: {
        type: "string",
        description: "Optional output PNG path. Relative paths resolve against the current Pi working directory.",
      },
      padding: {
        type: "number",
        description: "Pixel padding to add around the resolved rectangle before clamp or bounds validation. Defaults to 0.",
      },
      clamp: {
        type: "boolean",
        description: "When true, clip out-of-bounds rectangles to image bounds. When false, out-of-bounds rectangles fail. Defaults to true.",
      },
    },
  });
});

test("registerVisualPrimitives registers visual primitive helper tools", () => {
  const tools = registeredTools();

  assert.deepEqual(tools.map((tool) => tool.name), [
    "crop_bounding_box",
    "crop_multiple_bounding_boxes",
    "annotate_bounding_boxes",
    "crop_around_point",
    "sample_colors",
  ]);
  assert.match(tools[1].description, /multiple regions/);
  assert.match(tools[2].description, /annotated preview/);
  assert.match(tools[3].description, /point of interest/);
  assert.match(tools[4].description, /exact colors/);
});

test("registered tools guide proactive visual evidence workflows", () => {
  const tools = registeredTools();
  const crop = tools.find((candidate) => candidate.name === "crop_bounding_box");
  const multi = tools.find((candidate) => candidate.name === "crop_multiple_bounding_boxes");
  const annotate = tools.find((candidate) => candidate.name === "annotate_bounding_boxes");
  const point = tools.find((candidate) => candidate.name === "crop_around_point");
  const colors = tools.find((candidate) => candidate.name === "sample_colors");

  assert.ok(crop);
  assert.ok(multi);
  assert.ok(annotate);
  assert.ok(point);
  assert.ok(colors);

  assert.match(`${crop.description} ${crop.promptSnippet} ${crop.promptGuidelines?.join(" ")}`, /screenshot/i);
  assert.match(`${crop.description} ${crop.promptSnippet} ${crop.promptGuidelines?.join(" ")}`, /UI reproduction|visual QA/i);
  assert.match(`${crop.description} ${crop.promptSnippet} ${crop.promptGuidelines?.join(" ")}`, /inspect the crop/i);

  assert.match(`${multi.description} ${multi.promptSnippet} ${multi.promptGuidelines?.join(" ")}`, /complex image|complex screenshot|UI/i);
  assert.match(`${multi.description} ${multi.promptSnippet} ${multi.promptGuidelines?.join(" ")}`, /header.*card.*sidebar|semantic region/i);

  assert.match(`${annotate.description} ${annotate.promptSnippet} ${annotate.promptGuidelines?.join(" ")}`, /region assumptions/i);
  assert.match(`${annotate.description} ${annotate.promptSnippet} ${annotate.promptGuidelines?.join(" ")}`, /frontend reproduction|visual comparison/i);
  assert.match(`${annotate.description} ${annotate.promptSnippet} ${annotate.promptGuidelines?.join(" ")}`, /does not detect/i);

  assert.match(`${point.description} ${point.promptSnippet} ${point.promptGuidelines?.join(" ")}`, /point of interest/i);
  assert.match(`${point.description} ${point.promptSnippet} ${point.promptGuidelines?.join(" ")}`, /alignment issue|overlap/i);

  assert.match(`${colors.description} ${colors.promptSnippet} ${colors.promptGuidelines?.join(" ")}`, /CSS-level color precision/i);
  assert.match(`${colors.description} ${colors.promptSnippet} ${colors.promptGuidelines?.join(" ")}`, /provided points/i);
});

test("crop_bounding_box execution returns crop result details", async () => {
  const tool = registeredTools().find((candidate) => candidate.name === "crop_bounding_box");
  assert.ok(tool);

  await assert.rejects(
    () => tool.execute("call-1", {
      imagePath: "missing.png",
      box: [0, 0, 10, 10],
      coordinateSpace: "pixel",
    }, undefined, undefined, { cwd: "/tmp" }),
    /does not exist|cannot be read|Input file is missing/,
  );
});

test("sample_colors execution returns exact color details", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const sharp = (await import("sharp")).default;

  const dir = await mkdtemp(join(tmpdir(), "pi-visual-primitives-ext-colors-test-"));
  try {
    const source = join(dir, "source.png");
    const data = Buffer.from([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 255,
    ]);
    await sharp(data, { raw: { width: 2, height: 2, channels: 4 } }).png().toFile(source);

    const tool = registeredTools().find((candidate) => candidate.name === "sample_colors");
    assert.ok(tool);
    const result = await tool.execute("call-colors", {
      imagePath: source,
      points: [{ label: "red", point: [0, 0] }],
      coordinateSpace: "pixel",
    }, undefined, undefined, { cwd: dir });

    assert.match(result.content[0].text, /Sampled 1 color/);
    assert.match(result.content[0].text, /red: #ff0000/);
    assert.equal((result.details as any).samples[0].hex, "#ff0000");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("crop_bounding_box result text includes output and resolved pixel box", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const sharp = (await import("sharp")).default;

  const dir = await mkdtemp(join(tmpdir(), "pi-visual-primitives-ext-test-"));
  try {
    const source = join(dir, "source.png");
    const output = join(dir, "crop.png");
    await sharp({
      create: {
        width: 20,
        height: 20,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    }).png().toFile(source);

    const tool = registeredTools().find((candidate) => candidate.name === "crop_bounding_box");
    assert.ok(tool);
    const result = await tool.execute("call-2", {
      imagePath: source,
      outputPath: output,
      box: [1, 2, 11, 12],
      coordinateSpace: "pixel",
    }, undefined, undefined, { cwd: dir });

    assert.match(result.content[0].text, /Cropped bounding box to/);
    assert.match(result.content[0].text, /left=1, top=2, width=10, height=10/);
    assert.deepEqual((result.details as any).resolvedPixelBox, {
      left: 1,
      top: 2,
      right: 11,
      bottom: 12,
      width: 10,
      height: 10,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

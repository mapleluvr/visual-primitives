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

test("registerVisualPrimitives registers crop_bounding_box", () => {
  const tools: RegisteredTool[] = [];
  const pi = {
    registerTool(tool: RegisteredTool) {
      tools.push(tool);
    },
  };

  registerVisualPrimitives(pi, { pluginDir: "/plugin" });

  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, "crop_bounding_box");
  assert.equal(tools[0].label, "Crop Bounding Box");
  assert.match(tools[0].description, /normalized 0-999/);
  assert.match(tools[0].promptSnippet ?? "", /Crop image regions/);
  assert.ok(tools[0].promptGuidelines?.some((line) => line.includes("bottom-left")));
  assert.deepEqual(tools[0].parameters, {
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

test("crop_bounding_box execution returns crop result details", async () => {
  const tools: RegisteredTool[] = [];
  const pi = {
    registerTool(tool: RegisteredTool) {
      tools.push(tool);
    },
  };

  registerVisualPrimitives(pi, { pluginDir: "/plugin" });
  const tool = tools[0];

  await assert.rejects(
    () => tool.execute("call-1", {
      imagePath: "missing.png",
      box: [0, 0, 10, 10],
      coordinateSpace: "pixel",
    }, undefined, undefined, { cwd: "/tmp" }),
    /does not exist|cannot be read|Input file is missing/,
  );
});

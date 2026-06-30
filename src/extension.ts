import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { cropBoundingBox } from "./crop.ts";
import {
  annotateBoundingBoxesSchema,
  cropAroundPointSchema,
  cropBoundingBoxSchema,
  cropMultipleBoundingBoxesSchema,
  type CropBoundingBoxInput,
} from "./schema.ts";
import {
  annotateBoundingBoxes,
  cropAroundPoint,
  cropMultipleBoundingBoxes,
  type AnnotateBoundingBoxesInput,
  type CropAroundPointInput,
  type CropMultipleBoundingBoxesInput,
} from "./phase2.ts";

type ToolInput = CropBoundingBoxInput | CropMultipleBoundingBoxesInput | AnnotateBoundingBoxesInput | CropAroundPointInput;

interface PiLike {
  registerTool(tool: {
    name: string;
    label: string;
    description: string;
    promptSnippet?: string;
    promptGuidelines?: string[];
    parameters: unknown;
    execute: (
      toolCallId: string,
      params: ToolInput,
      signal?: AbortSignal,
      onUpdate?: unknown,
      ctx?: { cwd?: string },
    ) => Promise<{ content: Array<{ type: "text"; text: string }>; details?: unknown }>;
  }): void;
}

export interface VisualPrimitivesOptions {
  pluginDir: string;
}

export function registerVisualPrimitives(pi: PiLike | ExtensionAPI, _options: VisualPrimitivesOptions): void {
  pi.registerTool({
    name: "crop_bounding_box",
    label: "Crop Bounding Box",
    description: "Crop one image or screenshot region for focused visual evidence. Supports visual-primitive normalized 0-999 and pixel coordinates, top-left and bottom-left origins, padding, and bounds clamping.",
    promptSnippet: "Crop a visually relevant region from an image, screenshot, or UI render so the agent can inspect it before drawing conclusions.",
    promptGuidelines: [
      "Use crop_bounding_box to isolate one visually relevant region when answering image, screenshot, UI reproduction, or visual QA questions.",
      "Coordinates may come from the user or from the agent's provisional region estimate; inspect the crop before making detailed claims.",
      "Prefer coordinateSpace: pixel for screenshots and rendered UI unless the source clearly uses normalized visual-primitive coordinates.",
      "For bottom-left coordinate systems, set origin to bottom-left and boxOrder to left-bottom-right-top.",
    ],
    parameters: cropBoundingBoxSchema,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const details = await cropBoundingBox(params as CropBoundingBoxInput, { cwd: ctx?.cwd ?? process.cwd(), signal });
      return {
        content: [{
          type: "text",
          text: `Cropped bounding box to ${details.outputPath} (left=${details.resolvedPixelBox.left}, top=${details.resolvedPixelBox.top}, width=${details.resolvedPixelBox.width}, height=${details.resolvedPixelBox.height})`,
        }],
        details,
      };
    },
  });

  pi.registerTool({
    name: "crop_multiple_bounding_boxes",
    label: "Crop Multiple Bounding Boxes",
    description: "Crop multiple regions from the same image or screenshot in one fail-fast call for visual evidence and UI decomposition.",
    promptSnippet: "Batch-crop several semantically labeled regions from one image, screenshot, or UI render for focused inspection.",
    promptGuidelines: [
      "Use crop_multiple_bounding_boxes when a complex image, complex screenshot, or UI should be inspected as multiple regions.",
      "Label boxes with semantic region names such as header, card, sidebar, form, button, chart, or footer so artifacts remain useful during implementation and comparison.",
      "This tool fails fast on the first invalid box; use single crop calls when partial progress is required.",
    ],
    parameters: cropMultipleBoundingBoxesSchema,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const details = await cropMultipleBoundingBoxes(params as CropMultipleBoundingBoxesInput, { cwd: ctx?.cwd ?? process.cwd(), signal });
      return {
        content: [{
          type: "text",
          text: `Cropped ${details.crops.length} bounding boxes: ${details.crops.map((crop) => crop.outputPath).join(", ")}`,
        }],
        details,
      };
    },
  });

  pi.registerTool({
    name: "annotate_bounding_boxes",
    label: "Annotate Bounding Boxes",
    description: "Create an annotated preview image by drawing provided or agent-estimated bounding boxes over the source image.",
    promptSnippet: "Draw boxes over an image or screenshot to verify region assumptions before relying on them for visual conclusions.",
    promptGuidelines: [
      "Use annotate_bounding_boxes to make region assumptions visible before relying on them for visual conclusions.",
      "Use it for UI screenshot decomposition, visual comparison planning, and frontend reproduction checkpoints.",
      "The output image keeps the source dimensions and overlays simple box outlines and optional labels.",
      "This tool does not detect elements; it only draws boxes selected or provided by the agent or user.",
    ],
    parameters: annotateBoundingBoxesSchema,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const details = await annotateBoundingBoxes(params as AnnotateBoundingBoxesInput, { cwd: ctx?.cwd ?? process.cwd(), signal });
      return {
        content: [{
          type: "text",
          text: `Annotated ${details.boxes.length} bounding boxes to ${details.outputPath}`,
        }],
        details,
      };
    },
  });

  pi.registerTool({
    name: "crop_around_point",
    label: "Crop Around Point",
    description: "Crop an image region centered on a point of interest using an explicit radius or size.",
    promptSnippet: "Crop around a point-based visual primitive or UI point of interest when focused inspection needs an explicit radius or size.",
    promptGuidelines: [
      "Use crop_around_point when the visual question centers on a point of interest such as an overlap, alignment issue, cursor target, label anchor, or small defect.",
      "Require an explicit radius or size based on the intended inspection area; do not invent arbitrary defaults without a reason.",
      "Coordinate space, origin, padding, and clamp behavior match crop_bounding_box.",
      "Inspect the crop before drawing detailed conclusions.",
    ],
    parameters: cropAroundPointSchema,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const details = await cropAroundPoint(params as CropAroundPointInput, { cwd: ctx?.cwd ?? process.cwd(), signal });
      return {
        content: [{
          type: "text",
          text: `Cropped around point to ${details.outputPath} (left=${details.resolvedPixelBox.left}, top=${details.resolvedPixelBox.top}, width=${details.resolvedPixelBox.width}, height=${details.resolvedPixelBox.height})`,
        }],
        details,
      };
    },
  });
}

export function pluginDirFromImportMeta(url: string): string {
  return dirname(fileURLToPath(url));
}

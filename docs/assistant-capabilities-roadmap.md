# Assistant Capabilities Roadmap

This document captures assistant-facing capability plans for `pi-visual-primitives`. The package now exposes runtime tools for cropping one box, batch-cropping provided boxes, annotating provided boxes, cropping around explicit points, and sampling colors at provided points. The package does not generate bounding boxes; it helps an agent turn provided coordinates into local image artifacts or numeric evidence for follow-up inspection.

## Recommendation Summary

Tool boundary decisions from the 2026-07-02 review:

- `overlay_grid` is rejected because direct coordinate perception is already accurate enough and grid overlays can obscure source pixels.
- `measure_distance` is rejected as a tool because distance, gap, offset, ratio, and alignment are second-order quantities; agents should write coordinates and compute the arithmetic explicitly.
- `sample_colors` is approved because exact CSS color values are a structural VLM weakness and should be sampled from provided points.
- Tools turn coordinates into visual artifacts or coordinates into numeric evidence. They do not infer coordinates from images.

Priority order:

1. **Real Pi Skill package implemented.** This is the highest-leverage first step because it teaches the agent when and how to use the existing tool correctly.
2. **Auxiliary tools implemented.** Batch crop, annotation preview, and point crop workflows are now first-class tools.
3. **Add UI interaction later.** Interactive flows are useful, but should wait until repeated user need justifies the added complexity.

The original gap was not image processing capability alone; it was agent reliability. The package now combines a visual evidence Skill Set with small composable tools for repeated crop, annotation, comparison, and verification workflows.

## Phase 1: Real Pi Skill Set

### Status

Implemented in this package under:

```text
skills/
```

Core entries include:

- `skills/using-visual-primitives/SKILL.md`
- `skills/frontend-replication/SKILL.md`
- `skills/inline-replication/SKILL.md`
- `skills/subagent-driven-replication/SKILL.md`
- `skills/refining-with-feedback/SKILL.md`
- `skills/finalizing-replication/SKILL.md`

The package manifest exposes the extension tools and the Skill Set directory.

### Goal

Maintain a real Pi Skill Set that teaches agents how to use visual evidence tools for marking, cropping, comparing, aligning, analyzing images, and frontend replication workflows.

### Why this comes first

A Skill is the best first extension because the current tool already works for the core crop operation. The next failure mode is likely misuse:

- confusing normalized `0-999` coordinates with pixel coordinates
- using the wrong Y-axis origin
- mixing `[left, top, right, bottom]` with `[left, bottom, right, top]`
- cropping once but not inspecting the result
- failing to iterate when the first crop is too tight, too broad, or clamped

A Skill can guide the agent through those decisions without adding new runtime surface area.

### Proposed Skill behavior

The Skill should instruct the agent to follow this workflow when a user, image, paper, model output, or screenshot provides visual-primitive coordinates:

1. **Identify the image source.** Confirm the local image path or ask the user to provide it.
2. **Identify the coordinate source.** Determine whether the coordinates are from a visual-primitives paper-style output, user-provided pixel values, plot coordinates, OCR output, or another model.
3. **Choose coordinate space.** Default to `normalized-999` for visual-primitive references; use `pixel` only when the source is explicitly pixel-based.
4. **Choose origin and box order.** Use `top-left` and `left-top-right-bottom` by default. Use `bottom-left` and `left-bottom-right-top` for bottom-left plot or geometry conventions.
5. **Crop with `crop_bounding_box`.** Include padding when the target object may be near the edge of the box.
6. **Inspect or reuse the crop.** Treat the crop as an intermediate artifact, not the final answer.
7. **Iterate if needed.** If the crop is clamped, empty, off-target, or too narrow, adjust options or ask for clarification.

### Suggested Skill triggers

The Skill description should make it load for prompts involving:

- visual primitive coordinates
- bounding boxes in images
- crop requests from `[left, top, right, bottom]` coordinates
- normalized `0-999` coordinates
- bottom-left coordinate systems in plots or geometry
- inspecting part of an image using a provided box

### Success criteria

The Skill is successful when an agent can reliably answer prompts like:

```text
Crop the object in scene.png at box [120, 80, 420, 360].
```

and choose the default normalized `0-999` behavior, while also handling explicit pixel prompts like:

```text
Use pixel box [50, 40, 250, 180] from scene.png and inspect the result.
```

It should also reduce unnecessary user clarification by giving the agent a default decision tree and clear points where clarification is required.

### Scope boundaries

The Skill should not claim that this package detects objects or generates boxes. It should repeatedly state that `pi-visual-primitives` consumes existing coordinates and creates crop artifacts.

## Phase 2: Auxiliary Tools

### Status

Implemented in this package as runtime tools:

- `crop_multiple_bounding_boxes`
- `annotate_bounding_boxes`
- `crop_around_point`
- `sample_colors`

These tools reuse the same coordinate-space and origin conventions as `crop_bounding_box` where applicable.

Auxiliary tools should stay small and composable rather than becoming a full image-annotation suite.

### Implemented: `crop_multiple_bounding_boxes`

Purpose:

- Crop several boxes from the same source image in one call.
- Return a structured list of output paths and resolved pixel boxes.

Benefits:

- Reduces repeated tool calls when a model or paper output provides many candidate regions.
- Keeps related crop artifacts named and grouped consistently.

Implementation notes:

- Reuse the existing coordinate resolution and crop logic.
- Accept an array of boxes with optional labels.
- Generate deterministic output names that include index and optional label.
- Preserve per-box metadata including clamping and resolved pixel dimensions.

Risks:

- Large batches may generate many files.
- Error behavior needs a clear policy: fail fast, skip invalid boxes, or return partial results.

Suggested policy:

- Start with fail-fast behavior for simplicity.
- Add partial-result behavior only if real workflows need it.

### Implemented: `annotate_bounding_boxes`

Purpose:

- Create an annotated preview image with one or more boxes drawn over the source image.

Benefits:

- Helps verify whether coordinates map to the intended region before or after cropping.
- Makes it easier for users to debug coordinate-space or origin mistakes.

Implementation notes:

- Reuse existing coordinate normalization.
- Draw outlines and optional labels using `sharp` SVG overlays.
- Return the annotated image path plus resolved box metadata.

Risks:

- Visual styling choices can expand scope quickly.
- Label rendering, colors, and line thickness can become a UI/design problem.

Suggested policy implemented:

- Keep default styling minimal.
- Support optional label text and color without turning the tool into a design surface.

### Implemented: `crop_around_point`

Purpose:

- Crop a region centered around a point with a requested width/height or radius.

Benefits:

- Supports point-based visual primitives, not only bounding boxes.
- Useful when a model gives a point of interest but no rectangle.

Implementation notes:

- Accept point coordinates in `normalized-999` or `pixel` space.
- Accept a radius or `{ width, height }` crop size.
- Convert the point to a box, then reuse the existing crop pipeline.

Risks:

- Choosing a default crop size can be arbitrary.
- The agent may overuse it when it should ask for a real box.

Suggested policy implemented:

- Require explicit crop size or radius.
- Do not invent a default size in the tool.

### Implemented: `sample_colors`

Purpose:

- Sample exact colors at provided points or small patches.
- Return RGB, hex, OKLab, patch size, sampled pixel count, and patch mean hex values.

Benefits:

- Supports CSS-level color precision that VLMs cannot reliably infer by sight.
- Keeps color evidence tied to explicit user- or agent-selected coordinates.

Implementation notes:

- Reuse existing path, coordinate-space, and origin conventions.
- Read pixels through `sharp` raw buffers.
- Keep the tool point-based; it does not detect palettes, dominant colors, or regions automatically.

### Deferred candidates

These are not recommended until the package has more usage data:

- automatic object detection
- OCR region detection
- segmentation masks
- interactive image labeling storage
- dataset annotation export formats

Those features would change the package from a visual-primitive utility into a broader computer-vision assistant package.

## Phase 3: UI Interaction

UI interaction should be deferred until the package has repeated workflows that are painful through plain tool calls and Skills alone.

### Candidate: `/visual-crop` command

Purpose:

- Provide a guided command for users who want to crop a region from an image without manually constructing a tool call.

Possible flow:

1. Ask for image path.
2. Ask for coordinate space: `normalized-999` or `pixel`.
3. Ask for origin: `top-left` or `bottom-left`.
4. Ask for box order.
5. Ask for box values.
6. Ask for optional padding and output path.
7. Run the crop and show the output path.

Benefits:

- Reduces friction for interactive users.
- Makes coordinate conventions visible instead of hidden inside tool arguments.

Risks:

- Adds interaction state and validation complexity.
- May duplicate what a Skill-guided agent can already do conversationally.

Suggested policy:

- Do not implement this first.
- Revisit if users repeatedly ask how to call `crop_bounding_box` or make coordinate option mistakes.

### Candidate: interactive crop wizard

Purpose:

- A richer flow for selecting images, previewing coordinate interpretation, and producing crop artifacts.

Possible capabilities:

- select image path from recent or project files
- preview resolved pixel rectangle metadata before writing output
- optionally generate an annotated preview
- rerun with adjusted padding or coordinate options

Benefits:

- Best experience for non-technical visual inspection workflows.
- Helpful when users need to compare several coordinate interpretations.

Risks:

- Highest implementation cost.
- Requires careful TUI/RPC mode behavior.
- Needs stronger product validation before implementation.

Suggested policy:

- Treat this as a later product feature, not a near-term utility improvement.
- Build it only after the Skill and auxiliary tools reveal stable user flows.

## Recommended Implementation Sequence

1. Maintain and refine the Skill Set under `skills/`, especially `skills/using-visual-primitives/SKILL.md`, based on real agent usage.
2. Keep `package.json` exposing both extension and Skill resources.
3. Keep documentation examples showing the Skill plus all visual-primitive tools.
4. Observe real usage and identify repeated multi-crop, verification, or point-crop workflows.
5. Refine `crop_multiple_bounding_boxes` if partial-result behavior becomes necessary.
6. Refine `annotate_bounding_boxes` only when real workflows need additional styling controls.
7. Refine `crop_around_point` only when point-based primitive workflows need more options.
8. Refine `sample_colors` only when color sampling workflows need additional patch or color-space reporting.
9. Revisit `/visual-crop` or a wizard only after the command would clearly reduce repeated user friction.

## Non-Goals

For now, this roadmap does not recommend:

- generating bounding boxes automatically
- adding model-based object detection
- becoming an image labeling application
- implementing a complex UI before the basic agent workflow is proven

Keeping the package focused will make it easier to maintain and easier for agents to use correctly.

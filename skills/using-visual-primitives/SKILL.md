---
name: using-visual-primitives
description: Use when marking, comparing, aligning, analyzing, cropping, annotating, or inspecting images, screenshots, UI renders, visual regions, bounding boxes, or point references with visual evidence tools.
---

# Using Visual Primitives

## Overview

Use this Skill when an image task needs visual evidence. `pi-visual-primitives` tools turn concrete regions and points into artifacts you can inspect: annotated images, single crops, batch crops, and point-centered crops.

This Skill is the general-purpose visual evidence layer. It supports standalone image proofreading, screenshot comparison, chart alignment, generated image analysis, UI render inspection, and local region study.

## Core Principles

1. **User requirements take priority.** If user instructions specify what to inspect, compare, ignore, crop, annotate, or conclude, follow those requirements before default heuristics.
2. **Direct visual inspection takes priority.** CV or script-derived conclusions can provide useful evidence, but they are not universally interpretable and can be misleading. Inspect the actual images, annotated outputs, crop outputs, and overlays before making visual claims.
3. **Think geometrics, write coordinates.** Use repeated `appearance -> coordinates -> appearance` loops: observe the visual impression, express the relevant local geometry as coordinates, inspect the crop or annotation, then refine both the coordinates and the interpretation. The goal is understanding specific local image content at specific positions.

## When to Use

Use this Skill for:

- marking images with labeled boxes;
- comparing images or screenshots;
- aligning images through corresponding regions;
- analyzing local image details;
- checking UI renders, charts, generated images, diagrams, product photos, or visual artifacts;
- converting visual impressions into pixel or normalized coordinates;
- verifying that a crop or annotation actually covers the intended local content.

Do not use this Skill for pure style advice without an image or visual artifact. Do not claim the tools detect objects, OCR text, segment images, or infer UI elements automatically.

## Tool Selection

| Need | Tool |
| --- | --- |
| Marking images with visible boxes | `annotate_bounding_boxes` |
| Checking one region closely | `crop_bounding_box` |
| Checking several regions from one source | `crop_multiple_bounding_boxes` |
| Comparing corresponding regions | `annotate_bounding_boxes`, then `crop_multiple_bounding_boxes` |
| Aligning images | matching annotations, shared labels, and comparable coordinates |
| Analyzing a point defect | `crop_around_point` with explicit `radius` or `size` |
| Sampling exact colors | `sample_colors` at explicit points |

For screenshots and rendered UI, prefer `coordinateSpace: "pixel"`, `origin: "top-left"`, and `boxOrder: "left-top-right-bottom"`. Use `normalized-999` when coordinates come from visual-primitives style normalized values.

## Marking Images

1. Identify the visual question and the source image.
2. Estimate or use provided boxes for the relevant local regions.
3. Use `annotate_bounding_boxes` with semantic labels.
4. Directly inspect the annotated image.
5. If a box is off-target, too broad, too tight, or ambiguous, revise the coordinates and annotate again.
6. Record the final labels and coordinates.

Good labels name the visual role: `header`, `legend`, `left-card`, `button-shadow`, `chart-axis`, `logo-mark`, `error-highlight`, or `painted-figure`.

## Verifying Marks With Crops

Annotations show placement, but crops prove whether a region contains the intended content at useful precision.

After marking, use `crop_bounding_box` or `crop_multiple_bounding_boxes` with the same coordinates. Inspect each crop and confirm:

- the intended element is fully included;
- unrelated surrounding content is not meaningfully included;
- the crop is not empty or clamped in a way that changes the claim;
- the crop supports the visual conclusion being made.

## Comparing Images

For two or more images:

1. Choose corresponding regions in each image.
2. Use the same labels across images.
3. Annotate each image so the correspondence is visible.
4. Crop corresponding regions with `crop_multiple_bounding_boxes`.
5. Directly inspect the annotated images and crop outputs.
6. Use returned `resolvedPixelBox` metadata to quantify `width`, `height`, and `area` before making size claims.
7. Describe both absolute differences and relative differences against nearby regions.

Use numeric differences to choose where to inspect; use image evidence to explain what is happening.

## Aligning Images

Alignment requires explicit coordinate evidence.

Use shared frames of reference:

- image dimensions;
- viewport or canvas size;
- matching labels;
- corresponding boxes;
- center points;
- distances to nearby anchors;
- pixel coordinates and normalized thousandths.

When alignment matters, record both pixel coordinates and normalized `0-999` coordinates. Pixel coordinates preserve implementation precision. Normalized coordinates make cross-size comparison easier.

## Second-Order Quantities Must Be Computed

Distance, gap, size difference, alignment offset, and ratio are second-order quantities: they are derived from multiple coordinates, not read directly.

Procedure for any second-order quantity:

1. Estimate each endpoint or edge coordinate separately using direct perception.
2. Write the arithmetic explicitly, for example: `gap = card2.left - card1.right = 412 - 330 = 82px`.
3. Report the computed result, not the visual impression.

Alignment checks follow the same rule: record both edge coordinates, subtract to get the offset, and compare the computed offset against the task tolerance.

## Analyzing Images

Use the smallest useful region, then iterate.

1. Start from the visible appearance.
2. Write coordinates for the local geometry.
3. Generate an annotation or crop.
4. Inspect the artifact directly.
5. Refine the coordinates, labels, or interpretation.
6. Repeat until the evidence is specific enough to support the conclusion.

For point-centered defects such as overlaps, cursor targets, label anchors, tiny artifacts, or alignment points, use `crop_around_point` only with an explicit `radius` or `size` chosen for the inspection.

For color-sensitive questions, use `sample_colors` at explicit points or small local patches when CSS-level color precision matters. Avoid broad color names when a visual claim depends on hue, brightness, contrast, or gradient behavior.

## Evidence Notes

When writing conclusions, include:

- source image path;
- artifact paths for annotations and crops;
- labels and coordinates;
- coordinate space and origin;
- `resolvedPixelBox` width, height, and area when comparing sizes;
- `sample_colors` points and hex/RGB/OKLab results when color precision matters;
- direct visual observations from the artifacts;
- uncertainties or regions that need another crop.

## Common Mistakes

- Treating tool output metadata as more authoritative than direct viewing.
- Skipping annotation before relying on estimated boxes.
- Forgetting to crop after annotation when precision matters.
- Comparing images with mismatched labels or coordinate frames.
- Using `normalized-999` for screenshots when pixel coordinates are the natural frame.
- Reporting detailed visual claims before directly inspecting generated artifacts.
- Treating a broad box as precise because it contains the target.
- Claiming the tools automatically detect or identify image content.

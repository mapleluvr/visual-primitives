---
name: visual-primitives
description: Use for any task involving images, screenshots, UI visual effects, visual comparison, frontend visual reproduction, visual QA, visual-primitive coordinates, bounding boxes, or point/region references where the agent must draw conclusions from visual appearance using crops or annotations as evidence.
---

# Visual Primitives

## Overview

Use this package when a task involves an image, screenshot, rendered UI, reference design, diagram, or visual effect and you need to draw a conclusion from visual appearance. `pi-visual-primitives` helps you create visual evidence artifacts: crops, batch crops, annotations, and point-centered crops.

Coordinates are not the trigger. A need for visual evidence is the trigger. Crops and annotations are evidence artifacts produced during visual reasoning, not prerequisites for using this Skill.

The package does not generate bounding boxes, does not detect objects, does not OCR text, does not segment images, and does not automatically identify UI elements. It turns user-provided or agent-estimated regions into local crop or annotation artifacts that you can inspect or reuse.

## When to Use

Use this Skill for prompts involving:

- screenshots, images, diagrams, rendered UI, or reference designs
- frontend visual reproduction, screenshot-to-code, or matching a design reference
- visual comparison between a reference and current implementation
- UI visual QA for spacing, alignment, typography, color, shadows, borders, radius, hierarchy, or layout
- visual regression debugging from screenshots or rendered artifacts
- visual primitive coordinates from a paper, model, screenshot, diagram, or user
- bounding boxes, point references, normalized `0-999` coordinates, or explicit pixel boxes
- requests to crop, batch-crop, annotate, zoom into, inspect, or reuse visual regions

Do not use it for pure styling advice without an image or visual artifact. Do not use it to claim automatic object detection, OCR, segmentation, or guessing elements without verification.

## Workflow

1. **Identify the visual source.** Confirm the `imagePath`, screenshot, reference design, rendered UI artifact, or generated image. Ask for the image if no visual source is available.
2. **Identify the visual question.** State what conclusion needs visual evidence, even if it is coarse.
3. **For multi-image proofreading, align comparable regions.** When proofreading two or more images, choose corresponding regions across images before judging differences.
4. **Decide whether region evidence is useful.** Whole-image inspection can be enough for trivial conclusions. Use crops or annotations when they improve focus, evidence, or verification.
5. **Decompose complex visuals.** For screenshots or UI pages, estimate meaningful regions such as header, hero, card, sidebar, form, button, chart, modal, footer, or error area.
6. **Verify region assumptions.** Use `annotate_bounding_boxes` when you need to make estimated regions visible before relying on them. In multi-image proofreading, annotate corresponding regions in each image so placement and labels can be checked side by side.
7. **Choose the smallest suitable tool.**
   - Use `crop_bounding_box` for one visually relevant region.
   - Use `crop_multiple_bounding_boxes` for several regions from the same image when fail-fast behavior is acceptable.
   - Use `annotate_bounding_boxes` to verify coordinate interpretation, UI region assumptions, visual comparison plans, or frontend reproduction checkpoints.
   - Use `crop_around_point` for point-centered questions only when an explicit `radius` or `size` is provided or deliberately chosen for the inspection.
8. **Quantify region sizes for comparison.** For multi-image proofreading, use the returned `resolvedPixelBox` metadata from crop or annotation results to record each comparable region's `width`, `height`, and `area` (`width * height`) before making size-related claims.
9. **Choose coordinate space.** Use `pixel` for screenshots and rendered UI unless the source clearly uses visual-primitives normalized `0-999` coordinates. Use `normalized-999` for paper-style visual primitive references.
10. **Choose origin and order.** Default to `origin: "top-left"` and `boxOrder: "left-top-right-bottom"`. For plot/geometry coordinates where Y grows upward, use `origin: "bottom-left"` and usually `boxOrder: "left-bottom-right-top"`.
11. **Inspect the output.** Treat crop and annotation files as intermediate artifacts. Directly inspect the tool results before making detailed visual claims: open or read the annotated images and the crop outputs produced by `annotate_bounding_boxes`, `crop_bounding_box`, or `crop_multiple_bounding_boxes`.
12. **Iterate if needed.** If an annotation or crop is clamped, off-target, too tight, too broad, or empty, adjust the region, coordinate options, or padding.

## Quick Reference

| Situation | Tool options |
| --- | --- |
| Multi-image proofreading for two or more images | Use `annotate_bounding_boxes` to mark corresponding regions, then `crop_multiple_bounding_boxes` for focused crops; quantify region sizes from `resolvedPixelBox` `width`, `height`, and `area` |
| Screenshot or rendered UI region | Prefer `coordinateSpace: "pixel"`, `origin: "top-left"`, `boxOrder: "left-top-right-bottom"` |
| Frontend visual reproduction checkpoint | Annotate or crop reference/current regions, inspect outputs, then adjust implementation |
| Complex UI screenshot | Use `crop_multiple_bounding_boxes` with semantic labels such as `header`, `card`, `button`, or `sidebar` |
| Need to verify estimated region placement | Use `annotate_bounding_boxes` before relying on the region |
| Paper-style visual primitive box `[left, top, right, bottom]` | `coordinateSpace: "normalized-999"`, `origin: "top-left"`, `boxOrder: "left-top-right-bottom"` |
| Pixel box `[left, top, right, bottom]` | `coordinateSpace: "pixel"`, `origin: "top-left"`, `boxOrder: "left-top-right-bottom"` |
| Bottom-left plot box `[left, bottom, right, top]` | `coordinateSpace: "pixel"` or `"normalized-999"`, `origin: "bottom-left"`, `boxOrder: "left-bottom-right-top"` |
| Several boxes from the same image | Use `crop_multiple_bounding_boxes`; provide labels when useful; fail-fast on the first invalid box |
| Point with explicit radius or size | Use `crop_around_point`; do not invent a default size |
| Point needing intentionally chosen inspection area | Use `crop_around_point` only after choosing and stating an explicit radius or size |
| Box may be tight | Add `padding` |
| Out-of-bounds should fail | Set `clamp: false` |

## Examples

### Multi-image proofreading

User: `Compare these three screenshots and check whether the cards line up and have the same size.`

For two or more images, choose matching regions in each image, such as `card`, `title`, `button`, or `chart`. Use `annotate_bounding_boxes` on each image first so the corresponding boxes and labels are visible. Then use `crop_multiple_bounding_boxes` on each image to extract the same labeled regions. Directly inspect the tool results: view the annotated images, view the crop outputs, and use each crop's `resolvedPixelBox` metadata to quantify region sizes with `width`, `height`, and `area` before claiming that regions match or differ.

### Frontend visual reproduction

User: `Recreate this dashboard screenshot and match the spacing and shadows.`

First identify the screenshot and the visual questions. For a complex page, annotate estimated regions such as `sidebar`, `header`, `main-card`, and `primary-button`. Inspect the annotation before making detailed layout claims. Crop key regions for closer inspection, implement the UI, capture the current render, then compare equivalent reference/current crops.

### Screenshot region inspection

User: `Why does this card look off?`

Use a crop or annotation when the card's boundaries, spacing, shadow, border radius, or typography need focused inspection. Prefer `coordinateSpace: "pixel"` for screenshots.

### Provided visual-primitive box

User: `Crop the object in scene.png at box [120, 80, 420, 360], then inspect the result.`

Use the visual-primitives default because no pixel coordinates were specified:

```json
{
  "imagePath": "scene.png",
  "box": [120, 80, 420, 360],
  "coordinateSpace": "normalized-999",
  "origin": "top-left",
  "boxOrder": "left-top-right-bottom",
  "outputPath": "scene.visual-primitives-crop.png",
  "padding": 0,
  "clamp": true
}
```

After `crop_bounding_box` returns, inspect the output file and metadata. If the result is clamped or does not contain the target, retry with corrected coordinate options or padding.

## Auxiliary Tool Examples

Batch-crop multiple UI regions from one screenshot:

```json
{
  "imagePath": "dashboard-reference.png",
  "outputDir": "dashboard-reference-crops",
  "coordinateSpace": "pixel",
  "boxes": [
    { "label": "sidebar", "box": [0, 0, 260, 900] },
    { "label": "header", "box": [260, 0, 1440, 96] },
    { "label": "primary-card", "box": [300, 140, 760, 420] }
  ],
  "padding": 0,
  "clamp": true
}
```

Annotate boxes to verify coordinate interpretation or region assumptions:

```json
{
  "imagePath": "dashboard-reference.png",
  "outputPath": "dashboard-reference-annotated.png",
  "boxes": [
    { "label": "sidebar", "box": [0, 0, 260, 900] },
    { "label": "primary-card", "box": [300, 140, 760, 420] }
  ],
  "coordinateSpace": "pixel",
  "origin": "top-left",
  "boxOrder": "left-top-right-bottom"
}
```

Crop around a point only when an explicit size is available or intentionally chosen:

```json
{
  "imagePath": "chart.png",
  "point": [620, 340],
  "radius": 80,
  "coordinateSpace": "pixel"
}
```

## Common Mistakes

- Treating provided `[left, top, right, bottom]` as `[x, y, width, height]`.
- Assuming normalized `0-999` coordinates for screenshots when pixel coordinates are the natural frame.
- Forgetting bottom-left origins for plots and geometry-style coordinates.
- Reporting detailed visual conclusions before inspecting the generated crop or annotation.
- Treating estimated regions as facts without verifying them with annotation or crop outputs.
- Claiming this package can generate or detect bounding boxes. It cannot.

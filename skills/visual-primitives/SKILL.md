---
name: visual-primitives
description: Use when working with visual-primitive coordinates, image bounding boxes, normalized 0-999 boxes, pixel boxes, point or region references, or requests to crop, batch-crop, annotate, and inspect image regions using pi-visual-primitives tools.
---

# Visual Primitives

## Overview

Use this package when an image region is already identified by coordinates and the agent needs to crop, annotate, or inspect that region. `pi-visual-primitives` does not generate bounding boxes, detect objects, or infer coordinates; it turns existing visual-primitive coordinates into crop or annotation artifacts with `crop_bounding_box`, `crop_multiple_bounding_boxes`, `annotate_bounding_boxes`, and `crop_around_point`.

## When to Use

Use this Skill for prompts involving:

- visual primitive coordinates from a paper, model, screenshot, diagram, or user
- bounding boxes in an image
- normalized `0-999` coordinates
- explicit pixel boxes
- top-left or bottom-left coordinate systems
- requests to crop, batch-crop, annotate, zoom into, inspect, or reuse coordinate-defined image regions

Do not use it for object detection, OCR, segmentation, or guessing where an object is when no coordinates are provided.

## Workflow

1. **Identify the image.** Confirm `imagePath` or ask for it if missing.
2. **Identify coordinate meaning.** Confirm the input is a box, not `[x, y, width, height]` or an arbitrary point.
3. **Choose coordinate space.** Default to `normalized-999` unless the user explicitly says the values are pixel coordinates or another pixel-based source is clear. Use `pixel` for screen/image pixel boxes.
4. **Choose origin and order.** Default to `origin: "top-left"` and `boxOrder: "left-top-right-bottom"`. For plot/geometry coordinates where Y grows upward, use `origin: "bottom-left"` and usually `boxOrder: "left-bottom-right-top"`.
5. **Choose the smallest suitable tool.**
   - Use `crop_bounding_box` for one box.
   - Use `crop_multiple_bounding_boxes` for several boxes from the same image when fail-fast behavior is acceptable.
   - Use `annotate_bounding_boxes` when you need a same-size preview to verify coordinate interpretation.
   - Use `crop_around_point` only when the input is a point and the user provided an explicit `radius` or `size`.
6. **Crop or annotate.** Add small `padding` when the target may touch a box edge.
7. **Inspect the output.** Treat crop and annotation files as intermediate artifacts. Read or view them before making visual claims.
8. **Iterate if needed.** If the result is clamped, off-target, too tight, too broad, or empty, adjust options or ask for clarification.

## Quick Reference

| Situation | Tool options |
| --- | --- |
| Paper-style visual primitive box `[left, top, right, bottom]` | `coordinateSpace: "normalized-999"`, `origin: "top-left"`, `boxOrder: "left-top-right-bottom"` |
| Pixel box `[left, top, right, bottom]` | `coordinateSpace: "pixel"`, `origin: "top-left"`, `boxOrder: "left-top-right-bottom"` |
| Bottom-left plot box `[left, bottom, right, top]` | `coordinateSpace: "pixel"` or `"normalized-999"`, `origin: "bottom-left"`, `boxOrder: "left-bottom-right-top"` |
| Several boxes from the same image | Use `crop_multiple_bounding_boxes`; provide labels when useful; fail-fast on the first invalid box |
| Need to verify box placement visually | Use `annotate_bounding_boxes` before or after cropping |
| Point with explicit radius or size | Use `crop_around_point`; do not invent a default size |
| Box may be tight | Add `padding` |
| Out-of-bounds should fail | Set `clamp: false` |

## Example

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

After `crop_bounding_box` returns, inspect the output file and metadata. If the result was clamped or does not contain the target, retry with corrected coordinate options or padding.

## Auxiliary Tool Examples

Batch-crop multiple boxes from one source image:

```json
{
  "imagePath": "scene.png",
  "outputDir": "scene-crops",
  "coordinateSpace": "pixel",
  "boxes": [
    { "label": "title", "box": [10, 20, 180, 80] },
    { "label": "button", "box": [220, 300, 380, 360] }
  ],
  "padding": 0,
  "clamp": true
}
```

Annotate boxes to verify coordinate interpretation:

```json
{
  "imagePath": "scene.png",
  "outputPath": "scene-annotated.png",
  "boxes": [
    { "label": "target", "box": [120, 80, 420, 360] }
  ],
  "coordinateSpace": "normalized-999",
  "origin": "top-left",
  "boxOrder": "left-top-right-bottom"
}
```

Crop around a point only when an explicit size is provided:

```json
{
  "imagePath": "scene.png",
  "point": [500, 500],
  "radius": 80,
  "coordinateSpace": "normalized-999"
}
```

## Common Mistakes

- Treating `[left, top, right, bottom]` as `[x, y, width, height]`.
- Assuming pixel coordinates when visual-primitive coordinates usually mean normalized `0-999`.
- Forgetting bottom-left origins for plots and geometry-style coordinates.
- Reporting what is in the crop before inspecting the generated output.
- Claiming this package can generate or detect bounding boxes. It cannot.

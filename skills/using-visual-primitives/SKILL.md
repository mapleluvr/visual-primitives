---
name: using-visual-primitives
description: Use when marking, comparing, aligning, analyzing, cropping, annotating, or inspecting images, screenshots, UI renders, visual regions, bounding boxes, or point references with visual evidence tools.
---

# Using Visual Primitives

## Overview

Use `vp` when an image task needs inspectable visual evidence from agent- or user-provided boxes and points. The five commands annotate images, crop regions, crop several regions, crop around a point, and sample exact colors. They do not detect objects, read text, segment images, or infer UI elements.

Direct visual inspection remains the interpreter: inspect generated images before making detailed claims.

## Invocation

Agent execution must not assume that `vp` is on `PATH`. Resolve the package root from this Skill's installed location, then invoke the package-local launcher:

```bash
node <package-root>/skills/_shared/run-vp.mjs <command> [arguments]
```

A user who installed the npm binary globally may use `vp` in place of the launcher. Successful commands print JSON to stdout and write PNG artifacts to the reported paths.

## Command Selection

| Need | Command |
| --- | --- |
| Mark boxes and labels on the source image | `vp annotate` |
| Inspect one rectangular region | `vp crop` |
| Inspect several regions from one source | `vp crop-multi` |
| Inspect a local area centered on a point | `vp point` |
| Sample exact colors at explicit points | `vp colors` |

For screenshots, prefer `--space pixel --origin top-left --box-order left-top-right-bottom`. Use `--space normalized-999` when coordinates are normalized thousandths. Flag mode defaults to pixels; JSON compatibility mode preserves normalized-999 defaults.

## Common Invocations

Use the package-local launcher prefix shown above for agent execution. The shorter `vp` form below shows the command arguments:

```bash
vp annotate screenshot.png --space pixel --box "header:40,30,240,180" --out header-annotated.png
vp crop screenshot.png --space pixel --box "40,30,240,180" --out header-crop.png
vp crop-multi screenshot.png --space pixel --box "header:40,30,240,180" --box "button:280,220,420,280" --out-dir crops
vp point screenshot.png --space pixel --point "80,50" --radius 30 --out point-crop.png
vp colors screenshot.png --space pixel --point "header-bg:80,50" --patch 3
```

Run `node <package-root>/skills/_shared/run-vp.mjs <command> --help` for the complete flags and JSON input shape.

## Evidence Workflow

1. Identify the visual question and source image.
2. Estimate or use supplied coordinates.
3. Run `vp annotate` with semantic labels such as `header`, `legend`, or `button-shadow`.
4. Inspect the annotated PNG and revise off-target boxes.
5. Run `vp crop` or `vp crop-multi` with the confirmed coordinates.
6. Inspect each crop and verify that it contains the intended content without meaningful clamping.
7. Use `vp point` for a small point-centered area and `vp colors` when a color claim needs exact RGB, hex, OKLab, or patch means.
8. Record source paths, artifact paths, coordinates, coordinate conventions, and direct observations.

For two or more images, reuse labels and coordinate frames. Annotate each image, crop corresponding regions, then compare the artifacts directly.

## Second-Order Quantities

Distance, gap, size difference, alignment offset, and ratio must be computed from independently estimated coordinates. Write the arithmetic explicitly, for example:

```text
gap = card2.left - card1.right = 412 - 330 = 82px
```

Use returned `resolvedPixelBox` values to calculate width, height, area, and offsets before reporting them.

## Common Mistakes

- Treating result metadata as a substitute for viewing the generated image.
- Reporting a visual claim before inspecting the annotation or crop.
- Using mismatched labels, image dimensions, or coordinate frames across images.
- Omitting an explicit `--radius` or `--size` for `vp point`.
- Using broad color names when `vp colors` can provide exact local evidence.
- Claiming the commands automatically locate or identify image content.

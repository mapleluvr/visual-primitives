# Pi Visual Primitives

[中文](README.zh-CN.md)

Pi Visual Primitives is a Pi extension package that gives agents visual evidence workflow helper tools. Use it for tasks involving images, screenshots, rendered UI, reference designs, visual effects, frontend visual reproduction, visual comparison, or visual QA when the agent needs to draw conclusions from visual appearance.

Visual evidence needs trigger the package. Coordinates are selected, estimated, or provided during the evidence workflow, then turned into local crop, annotation, point-crop, and color-sampling artifacts that agents can inspect or reuse while reasoning about visuals.

The design is inspired by the "Thinking with Visual Primitives" paper overview: points and bounding boxes can act as concrete spatial references during visual reasoning. Detection, OCR, segmentation, automatic box generation, and automatic UI inference stay outside the tool contract. The package turns user-provided or agent-estimated regions into local evidence artifacts.

## Features

- Create visual evidence artifacts for screenshot analysis, frontend visual reproduction, visual comparison, and visual QA.
- Annotate or crop UI regions such as headers, cards, sidebars, forms, buttons, charts, and footers.
- Crop one bounding box from a local image.
- Batch-crop multiple boxes from the same image with deterministic output names.
- Create same-size annotated preview images with box outlines and optional labels.
- Crop around an explicit point using a required radius or width/height.
- Sample exact colors at provided points with `sample_colors` for CSS-level color precision.
- Supports paper-style normalized `0-999` coordinates.
- Supports direct pixel coordinates.
- Supports top-left and bottom-left coordinate origins.
- Supports `[left, top, right, bottom]` and `[left, bottom, right, top]` box orders.
- Optional pixel padding.
- Optional bounds clamping.
- Returns structured metadata including source dimensions and resolved pixel box.

## Installation

From this repository checkout, install dependencies:

```bash
cd pi-visual-primitives
npm install
```

Use temporarily in Pi:

```bash
pi -e ./pi-visual-primitives
```

Install as a Pi package so Pi loads both the extension tool and the Skill:

```bash
pi install ./pi-visual-primitives
```

Then run `/reload` in Pi.

## Skill Set

This package includes a Pi Skill Set under `skills/`:

- `skills/using-visual-primitives/SKILL.md` for general visual evidence work: marking, cropping, comparing, aligning, and analyzing images.
- `skills/frontend-replication/SKILL.md` as the gateway for oracle-image-driven frontend replication.
- `skills/inline-replication/SKILL.md` for parent-agent execution loops.
- `skills/subagent-driven-replication/SKILL.md` for orchestrated subagent replication loops. This route uses optional environment support from `pi-subagents`, `subagent-driven-development`, and superpowers workflows; use `inline-replication` when those are unavailable.
- `skills/refining-with-feedback/SKILL.md` for turning process verdicts into feedback drafts.
- `skills/finalizing-replication/SKILL.md` for final direct inspection and delivery review.

Use `using-visual-primitives` for standalone visual evidence tasks and `frontend-replication` for screenshot-oracle webpage reproduction.

## Visual Evidence Workflow Example

For a prompt like `Recreate this dashboard screenshot and match the spacing`, an agent should identify the screenshot, decide which visual conclusions need evidence, annotate major regions such as `sidebar`, `header`, `primary-card`, and `button`, crop important areas for focused inspection, implement the UI, then compare equivalent reference/current regions after rendering.

For screenshots and rendered UI, prefer `coordinateSpace: "pixel"` unless the source clearly uses normalized visual-primitive coordinates. For paper-style visual primitive coordinates, use the default `normalized-999` behavior.

## Worked Examples

Frontend is meant to be looked at, so these examples are shown, not scored. Both renders are a single pass by a mid-tier frontend model driven through `frontend-replication` -> `inline-replication`.

These results depend on the workflow actually being followed. The quality comes from running the replication loop, not from the model alone — skip the workflow and let the model free-run, and the output degrades noticeably. A short starting prompt that reliably drives the loop:

```text
Replicate the frontend screenshot at <path> (viewport <W>x<H>). Follow the
frontend-replication workflow strictly.

- Match the oracle's exact pixel dimensions in the rendered screenshot.
- Render every code-drawable region in code (CSS/SVG): text, song/artist names,
  table columns, icons, badges, status pills, progress bars, and brand colors.
- Approved exclusions may be represented by placeholders or delegated image assets: avatars, album / cover art, organic illustrations, and dense logo marks.
- Keep code-drawable content inside the scoring domain; use exclusions only for
  tightly bounded regions that cannot be described as boxes and paths.
```

The exclusion boundary is drawn by *what a text model can render*, not by *what is an image*. The code-drawable list keeps structured UI work inside the scoring domain instead of quietly widening exclusions to make the task easier.

### Simple task: fast and accurate

The oracle is an analytics dashboard mockup — a regular layout of a sidebar, a KPI row, two chart cards, and a transactions table.

![Dashboard mockup next to the single-pass render](docs/visual-primitives/examples/pulse-side-by-side.png)

*Left: the oracle mockup. Right: the single-pass render.*

On a clean, regular layout like this the workflow does not even need its feedback loop. The first render matches the oracle closely enough that the two are hard to tell apart at a glance — sidebar, stat cards, the revenue area chart, the traffic donut, and the transactions table with its colored status pills all land in place, with the semantic colors (green up-deltas, red down-deltas, amber pending) reproduced. Simple targets come out fast and accurate in one pass.

### Complex task: a dense real-world screenshot

The oracle is a real NetEase Cloud Music desktop screenshot (`1448x940`) — a much harder target: a three-region client with dozens of code-drawable icons, badge systems (`超清母带`, `VIP`), a brand-specific red, multi-size Chinese typography, right-aligned table columns, and a floating progress bar.

![NetEase screenshot next to the single-pass render](docs/visual-primitives/examples/netease-side-by-side.png)

*Left: the real screenshot used as the oracle. Right: the single-pass render. Full-resolution copies of every example are under [`docs/visual-primitives/examples/`](docs/visual-primitives/examples/).*

Six regions were **delegated out of the code-replication scope** as exclusions rather than reproduced by the text model — the playlist cover art, two avatars, two track thumbnails, and the rotating vinyl. The workflow delegates organic, imagination-driven imagery to image assets or placeholders, while keeping structured UI content in the code-scored domain.

Even at this density the single-pass render holds together — the layout skeleton, table alignment, badge system, brand red, and icon glyphs all reproduce closely enough that the remaining differences take focused inspection to find. What is visible on close viewing is small-area detail rather than layout failure:

- The **NetEase logo mark** is only approximated — the render draws a rough glyph inside the red circle instead of the precise headphone/note mark, and its size and weight are slightly off.
- The **progress-bar knob** sits a few pixels high of the red/gray boundary instead of centered on it.
- A handful of icons differ by a font-weight step.

The NetEase logo mark was left in the code-replication scope for this run, so its rough SVG approximation remains a visible limitation. In stricter production runs, dense brand marks can be declared as narrow exclusion candidates alongside avatars and cover art. The scoring domain is reserved for structured UI details a text model can describe and render accurately.

## Masked Oracle Diff CLI

`masked-oracle-diff` compares an oracle image and rendered image while excluding narrowly justified non-code-drawable regions. Everything outside the exclusion boxes is scored.

Run it with:

```bash
npm run oracle:diff -- --manifest docs/visual-primitives/runs/<run-id>/scripts/diff-manifest.json
```

The CLI writes `diff.gray.png`, masks, previews, a `25 x 25` matrix, components, stripes, `summary.json`, and `VERDICT.md` into the manifest `outputDir`.

## Tool: `crop_bounding_box`

Crops one provided bounding box from a source image.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `imagePath` | `string` | required | Source image path. Relative paths resolve against Pi's current working directory. A leading `@` is ignored. |
| `box` | `[number, number, number, number]` | required | Bounding box coordinates. |
| `coordinateSpace` | `"normalized-999" \| "pixel"` | `"normalized-999"` | Interpret coordinates as paper-style normalized values or direct pixels. |
| `origin` | `"top-left" \| "bottom-left"` | `"top-left"` | Coordinate origin. Bottom-left means y grows upward. |
| `boxOrder` | `"left-top-right-bottom" \| "left-bottom-right-top"` | `"left-top-right-bottom"` | Coordinate order of the input box. |
| `outputPath` | `string` | generated | Output PNG path. Relative paths resolve against Pi's current working directory. |
| `padding` | `number` | `0` | Pixel padding added around the resolved box. |
| `clamp` | `boolean` | `true` | Clip out-of-bounds boxes to image bounds. If false, out-of-bounds boxes fail. |

## Tool: `crop_multiple_bounding_boxes`

Crops several boxes from the same source image in one fail-fast call. It reuses the same coordinate options as `crop_bounding_box`.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `imagePath` | `string` | required | Source image path. |
| `boxes` | `Array<{ box, label?, outputPath? }>` | required | Boxes to crop. Each item may include a label and per-box output path. |
| `outputDir` | `string` | generated beside source | Directory for generated crop files when a box does not provide `outputPath`. |
| `coordinateSpace` | `"normalized-999" \| "pixel"` | `"normalized-999"` | Coordinate interpretation shared by all boxes. |
| `origin` | `"top-left" \| "bottom-left"` | `"top-left"` | Coordinate origin shared by all boxes. |
| `boxOrder` | `"left-top-right-bottom" \| "left-bottom-right-top"` | `"left-top-right-bottom"` | Coordinate order shared by all boxes. |
| `padding` | `number` | `0` | Pixel padding shared by all boxes. |
| `clamp` | `boolean` | `true` | Shared bounds-clamping behavior. |

Example:

```json
{
  "imagePath": "scene.png",
  "outputDir": "scene-crops",
  "coordinateSpace": "pixel",
  "boxes": [
    { "label": "title", "box": [10, 20, 180, 80] },
    { "label": "button", "box": [220, 300, 380, 360] }
  ]
}
```

The tool starts with fail-fast behavior: if one box is invalid, the call fails instead of returning partial results.

## Tool: `annotate_bounding_boxes`

Creates an annotated preview image with provided boxes drawn over the source image. The output image keeps the source dimensions and returns resolved box metadata.

Example:

```json
{
  "imagePath": "scene.png",
  "outputPath": "scene-annotated.png",
  "coordinateSpace": "pixel",
  "boxes": [
    { "label": "target", "box": [50, 40, 250, 180] }
  ]
}
```

Use this to verify coordinate-space, origin, or box-order assumptions before making visual claims.

## Tool: `sample_colors`

Samples exact pixel or patch colors at provided points in a source image. Use it when CSS-level color precision matters.

Example:

```json
{
  "imagePath": "scene.png",
  "coordinateSpace": "pixel",
  "patchSize": 3,
  "points": [
    { "label": "header-bg", "point": [130, 40] },
    { "label": "cta-button", "point": [620, 340] }
  ]
}
```

The tool returns resolved pixel points plus RGB, hex, OKLab, patch size, sampled pixel count, and patch mean hex values. Palette and dominant-color discovery stay outside the point-sampling contract.

## Tool: `crop_around_point`

Crops a region centered around a provided point. The call requires an explicit crop size through either `radius` or `size`.

Example with radius:

```json
{
  "imagePath": "scene.png",
  "point": [500, 500],
  "radius": 80,
  "outputPath": "scene-point.png"
}
```

Example with explicit size:

```json
{
  "imagePath": "scene.png",
  "point": [120, 90],
  "size": { "width": 60, "height": 40 },
  "coordinateSpace": "pixel"
}
```

The coordinate options match `crop_bounding_box`.

### Normalized visual-primitive box

```json
{
  "imagePath": "scene.png",
  "box": [120, 80, 420, 360]
}
```

This uses the default `coordinateSpace: "normalized-999"`, matching the visual-primitives paper convention.

### Pixel box

```json
{
  "imagePath": "scene.png",
  "box": [50, 40, 250, 180],
  "coordinateSpace": "pixel",
  "outputPath": "scene-object.png"
}
```

### Bottom-left coordinate system

```json
{
  "imagePath": "plot.png",
  "box": [10, 20, 60, 80],
  "coordinateSpace": "pixel",
  "origin": "bottom-left",
  "boxOrder": "left-bottom-right-top"
}
```

The tool converts this to the top-left pixel rectangle required by image processing libraries.

### Strict bounds checking

```json
{
  "imagePath": "scene.png",
  "box": [-10, 0, 100, 100],
  "coordinateSpace": "pixel",
  "clamp": false
}
```

This fails because the box exceeds image bounds.

## Returned Metadata

The tool returns text containing the output path and resolved crop rectangle. Structured details include:

- `imagePath`
- `outputPath`
- `source.width`
- `source.height`
- `source.format`
- `input.box`
- `input.coordinateSpace`
- `input.origin`
- `input.boxOrder`
- `input.padding`
- `input.clamp`
- `resolvedPixelBox`
- `unclampedPixelBox`
- `clamped`

## Development

Run tests:

```bash
npm test
```

Run syntax checks:

```bash
npm run check
```

The tests generate temporary PNG fixtures with `sharp.create()`, so the repository does not need binary fixture images.

## License

MIT

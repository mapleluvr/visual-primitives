# Pi Visual Primitives

Pi Visual Primitives is a Pi extension package that gives agents a `crop_bounding_box` tool. The tool crops an image region from an explicit bounding box, which is useful when a multimodal model or user provides visual-primitive coordinates.

The design is inspired by the "Thinking with Visual Primitives" paper overview: points and bounding boxes can act as concrete spatial references during visual reasoning. This package does not generate boxes. It turns an existing box into a local cropped image file that an agent can inspect or reuse.

## Features

- Crop one bounding box from a local image.
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

Install globally by copying or symlinking into Pi extensions:

```bash
mkdir -p ~/.pi/agent/extensions
cp -r pi-visual-primitives ~/.pi/agent/extensions/pi-visual-primitives
```

Then run `/reload` in Pi.

## Tool: `crop_bounding_box`

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

## Examples

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

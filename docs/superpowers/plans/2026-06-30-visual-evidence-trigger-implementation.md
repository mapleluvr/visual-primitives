# Visual Evidence Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition `pi-visual-primitives` so agents use its Skill and tools whenever visual evidence is needed for image, screenshot, UI, or frontend visual reproduction tasks.

**Architecture:** This is a metadata, documentation, and Skill guidance change. Runtime image-processing behavior stays unchanged; tests assert the new trigger language and prompt guidance so future edits do not narrow the Skill back to coordinate-only usage.

**Tech Stack:** Pi extension package, TypeScript ESM, Node test runner, `sharp`, Markdown Skill and README documentation.

## Global Constraints

- Coordinates are not the trigger; a need for visual evidence is the trigger.
- Crops and annotations are evidence artifacts produced during visual reasoning, not prerequisites for using the Skill.
- The package must not claim to perform object detection, OCR, segmentation, automatic UI element detection, or automatic coordinate generation.
- Runtime behavior for crop, batch crop, annotate, and point crop must remain compatible with existing tests.
- Use `coordinateSpace: "pixel"` for screenshots and rendered UI unless the source clearly uses normalized visual-primitive coordinates.
- Agents may estimate provisional regions from visible layout reasoning, but must verify with annotation or crop outputs before making detailed visual claims.

---

## File Structure

- Modify `skills/visual-primitives/SKILL.md`: broaden Skill trigger language and workflow from coordinate utility to visual-evidence workflow.
- Modify `src/extension.ts`: update tool descriptions, prompt snippets, and prompt guidelines for proactive visual inspection usage.
- Modify `README.md`: document the broader visual evidence use cases while preserving original coordinate utility examples.
- Modify `tests/package.test.ts`: assert the Skill and README include broad visual-evidence trigger terms and boundaries.
- Modify `tests/extension.test.ts`: assert the registered tool guidance includes screenshot/UI visual inspection language.
- No new runtime source files are needed.

---

### Task 1: Update Documentation Tests

**Files:**
- Modify: `pi-visual-primitives/tests/package.test.ts`

**Interfaces:**
- Consumes: Markdown content from `README.md` and `skills/visual-primitives/SKILL.md`.
- Produces: Documentation regression tests requiring visual-evidence trigger language.

- [ ] **Step 1: Add failing Skill trigger assertions**

In `tests/package.test.ts`, replace the body of `test("visual-primitives Skill documents crop_bounding_box workflow safeguards", ...)` with:

```ts
test("visual-primitives Skill documents visual evidence workflow safeguards", async () => {
  const skill = await readText(join("skills", "visual-primitives", "SKILL.md"));

  assert.match(skill, /visual evidence/i);
  assert.match(skill, /Coordinates are not the trigger/i);
  assert.match(skill, /frontend visual reproduction/i);
  assert.match(skill, /screenshot/i);
  assert.match(skill, /visual comparison/i);
  assert.match(skill, /UI visual QA/i);
  assert.match(skill, /estimated/i);
  assert.match(skill, /annotate_bounding_boxes/);
  assert.match(skill, /crop_multiple_bounding_boxes/);
  assert.match(skill, /crop_around_point/);
  assert.match(skill, /normalized-999/);
  assert.match(skill, /pixel/);
  assert.match(skill, /top-left/);
  assert.match(skill, /bottom-left/);
  assert.match(skill, /left-top-right-bottom/);
  assert.match(skill, /does not generate bounding boxes/i);
  assert.match(skill, /does not detect/i);
});
```

- [ ] **Step 2: Add failing README positioning assertions**

In `tests/package.test.ts`, replace the body of `test("README documents Phase 2 auxiliary tools", ...)` with:

```ts
test("README documents visual evidence workflows and Phase 2 auxiliary tools", async () => {
  const readme = await readText("README.md");

  assert.match(readme, /visual evidence workflow/i);
  assert.match(readme, /screenshots/i);
  assert.match(readme, /frontend visual reproduction/i);
  assert.match(readme, /visual QA/i);
  assert.match(readme, /Coordinates are not the trigger/i);
  assert.match(readme, /## Tool: `crop_multiple_bounding_boxes`/);
  assert.match(readme, /## Tool: `annotate_bounding_boxes`/);
  assert.match(readme, /## Tool: `crop_around_point`/);
  assert.match(readme, /fail-fast/i);
  assert.match(readme, /does not invent a default crop size/i);
});
```

- [ ] **Step 3: Run focused package tests and verify failure**

Run:

```bash
cd pi-visual-primitives
node --experimental-strip-types --test tests/package.test.ts
```

Expected: FAIL. The failure should mention missing visual evidence, frontend visual reproduction, screenshot, or related new wording.

---

### Task 2: Update Extension Metadata Tests

**Files:**
- Modify: `pi-visual-primitives/tests/extension.test.ts`

**Interfaces:**
- Consumes: registered tool metadata from `registerVisualPrimitives()`.
- Produces: Regression tests requiring tool guidance for screenshot/UI visual inspection workflows.

- [ ] **Step 1: Add failing tool guidance assertions**

In `tests/extension.test.ts`, add this test after `test("registerVisualPrimitives registers visual primitive helper tools", ...)`:

```ts
test("registered tools guide proactive visual evidence workflows", () => {
  const tools = registeredTools();
  const crop = tools.find((candidate) => candidate.name === "crop_bounding_box");
  const multi = tools.find((candidate) => candidate.name === "crop_multiple_bounding_boxes");
  const annotate = tools.find((candidate) => candidate.name === "annotate_bounding_boxes");
  const point = tools.find((candidate) => candidate.name === "crop_around_point");

  assert.ok(crop);
  assert.ok(multi);
  assert.ok(annotate);
  assert.ok(point);

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
});
```

- [ ] **Step 2: Run focused extension tests and verify failure**

Run:

```bash
cd pi-visual-primitives
node --experimental-strip-types --test tests/extension.test.ts
```

Expected: FAIL. The failure should mention missing screenshot/UI/region assumption guidance.

---

### Task 3: Rewrite Skill Guidance

**Files:**
- Modify: `pi-visual-primitives/skills/visual-primitives/SKILL.md`

**Interfaces:**
- Consumes: Design principles from `docs/superpowers/specs/2026-06-30-visual-evidence-trigger-design.md`.
- Produces: Broader Skill instructions that still guide use of existing tools.

- [ ] **Step 1: Replace Skill frontmatter description**

Use this frontmatter:

```md
---
name: visual-primitives
description: Use for any task involving images, screenshots, UI visual effects, visual comparison, frontend visual reproduction, visual QA, visual-primitive coordinates, bounding boxes, or point/region references where the agent must draw conclusions from visual appearance using crops or annotations as evidence.
---
```

- [ ] **Step 2: Replace the Skill body**

Use this body after the frontmatter:

```md
# Visual Primitives

## Overview

Use this package when a task involves an image, screenshot, rendered UI, reference design, diagram, or visual effect and you need to draw a conclusion from visual appearance. `pi-visual-primitives` helps you create visual evidence artifacts: crops, batch crops, annotations, and point-centered crops.

Coordinates are not the trigger. A need for visual evidence is the trigger. Crops and annotations are evidence artifacts produced during visual reasoning, not prerequisites for using this Skill.

The package does not generate bounding boxes, detect objects, OCR text, segment images, or automatically identify UI elements. It turns user-provided or agent-estimated regions into local crop or annotation artifacts that you can inspect or reuse.

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
3. **Decide whether region evidence is useful.** Whole-image inspection can be enough for trivial conclusions. Use crops or annotations when they improve focus, evidence, or verification.
4. **Decompose complex visuals.** For screenshots or UI pages, estimate meaningful regions such as header, hero, card, sidebar, form, button, chart, modal, footer, or error area.
5. **Verify region assumptions.** Use `annotate_bounding_boxes` when you need to make estimated regions visible before relying on them.
6. **Choose the smallest suitable tool.**
   - Use `crop_bounding_box` for one visually relevant region.
   - Use `crop_multiple_bounding_boxes` for several regions from the same image when fail-fast behavior is acceptable.
   - Use `annotate_bounding_boxes` to verify coordinate interpretation, UI region assumptions, visual comparison plans, or frontend reproduction checkpoints.
   - Use `crop_around_point` for point-centered questions only when an explicit `radius` or `size` is provided or deliberately chosen for the inspection.
7. **Choose coordinate space.** Use `pixel` for screenshots and rendered UI unless the source clearly uses visual-primitives normalized `0-999` coordinates. Use `normalized-999` for paper-style visual primitive references.
8. **Choose origin and order.** Default to `origin: "top-left"` and `boxOrder: "left-top-right-bottom"`. For plot/geometry coordinates where Y grows upward, use `origin: "bottom-left"` and usually `boxOrder: "left-bottom-right-top"`.
9. **Inspect the output.** Treat crop and annotation files as intermediate artifacts. Read or view them before making detailed visual claims.
10. **Iterate if needed.** If an annotation or crop is clamped, off-target, too tight, too broad, or empty, adjust the region, coordinate options, or padding.

## Quick Reference

| Situation | Tool options |
| --- | --- |
| Screenshot or rendered UI region | Prefer `coordinateSpace: "pixel"`, `origin: "top-left"`, `boxOrder: "left-top-right-bottom"` |
| Frontend visual reproduction checkpoint | Annotate or crop reference/current regions, inspect outputs, then adjust implementation |
| Complex UI screenshot | Use `crop_multiple_bounding_boxes` with semantic labels such as `header`, `card`, `button`, or `sidebar` |
| Need to verify estimated region placement | Use `annotate_bounding_boxes` before relying on the region |
| Paper-style visual primitive box `[left, top, right, bottom]` | `coordinateSpace: "normalized-999"`, `origin: "top-left"`, `boxOrder: "left-top-right-bottom"` |
| Pixel box `[left, top, right, bottom]` | `coordinateSpace: "pixel"`, `origin: "top-left"`, `boxOrder: "left-top-right-bottom"` |
| Bottom-left plot box `[left, bottom, right, top]` | `coordinateSpace: "pixel"` or `"normalized-999"`, `origin: "bottom-left"`, `boxOrder: "left-bottom-right-top"` |
| Several boxes from the same image | Use `crop_multiple_bounding_boxes`; provide labels when useful; fail-fast on the first invalid box |
| Point with explicit radius or size | Use `crop_around_point`; do not invent an arbitrary default size |
| Box may be tight | Add `padding` |
| Out-of-bounds should fail | Set `clamp: false` |

## Examples

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
```

- [ ] **Step 3: Run focused package tests**

Run:

```bash
cd pi-visual-primitives
node --experimental-strip-types --test tests/package.test.ts
```

Expected: tests should still fail until README updates are completed, but Skill-specific assertions should pass.

---

### Task 4: Update Extension Tool Guidance

**Files:**
- Modify: `pi-visual-primitives/src/extension.ts`

**Interfaces:**
- Consumes: Existing tool registration shape.
- Produces: Broader tool metadata used by Pi for tool selection and agent prompt guidance.

- [ ] **Step 1: Update `crop_bounding_box` metadata**

Replace its `description`, `promptSnippet`, and `promptGuidelines` values with:

```ts
description: "Crop one image or screenshot region for focused visual evidence. Supports visual-primitive normalized 0-999 and pixel coordinates, top-left and bottom-left origins, padding, and bounds clamping.",
promptSnippet: "Crop a visually relevant region from an image, screenshot, or UI render so the agent can inspect it before drawing conclusions.",
promptGuidelines: [
  "Use crop_bounding_box to isolate one visually relevant region when answering image, screenshot, UI reproduction, or visual QA questions.",
  "Coordinates may come from the user or from the agent's provisional region estimate; inspect the crop before making detailed claims.",
  "Prefer coordinateSpace: pixel for screenshots and rendered UI unless the source clearly uses normalized visual-primitive coordinates.",
  "For bottom-left coordinate systems, set origin to bottom-left and boxOrder to left-bottom-right-top.",
],
```

- [ ] **Step 2: Update `crop_multiple_bounding_boxes` metadata**

Replace its `description`, `promptSnippet`, and `promptGuidelines` values with:

```ts
description: "Crop multiple regions from the same image or screenshot in one fail-fast call for visual evidence and UI decomposition.",
promptSnippet: "Batch-crop several semantically labeled regions from one image, screenshot, or UI render for focused inspection.",
promptGuidelines: [
  "Use crop_multiple_bounding_boxes when a complex image, complex screenshot, or UI should be inspected as multiple regions.",
  "Label boxes with semantic region names such as header, card, sidebar, form, button, chart, or footer so artifacts remain useful during implementation and comparison.",
  "This tool fails fast on the first invalid box; use single crop calls when partial progress is required.",
],
```

- [ ] **Step 3: Update `annotate_bounding_boxes` metadata**

Replace its `description`, `promptSnippet`, and `promptGuidelines` values with:

```ts
description: "Create an annotated preview image by drawing provided or agent-estimated bounding boxes over the source image.",
promptSnippet: "Draw boxes over an image or screenshot to verify region assumptions before relying on them for visual conclusions.",
promptGuidelines: [
  "Use annotate_bounding_boxes to make region assumptions visible before relying on them for visual conclusions.",
  "Use it for UI screenshot decomposition, visual comparison planning, and frontend reproduction checkpoints.",
  "The output image keeps the source dimensions and overlays simple box outlines and optional labels.",
  "This tool does not detect elements; it only draws boxes selected or provided by the agent or user.",
],
```

- [ ] **Step 4: Update `crop_around_point` metadata**

Replace its `description`, `promptSnippet`, and `promptGuidelines` values with:

```ts
description: "Crop an image region centered on a point of interest using an explicit radius or size.",
promptSnippet: "Crop around a point-based visual primitive or UI point of interest when focused inspection needs an explicit radius or size.",
promptGuidelines: [
  "Use crop_around_point when the visual question centers on a point of interest such as an overlap, alignment issue, cursor target, label anchor, or small defect.",
  "Require an explicit radius or size based on the intended inspection area; do not invent arbitrary defaults without a reason.",
  "Coordinate space, origin, padding, and clamp behavior match crop_bounding_box.",
  "Inspect the crop before drawing detailed conclusions.",
],
```

- [ ] **Step 5: Run focused extension tests**

Run:

```bash
cd pi-visual-primitives
node --experimental-strip-types --test tests/extension.test.ts
```

Expected: PASS.

---

### Task 5: Update README Positioning

**Files:**
- Modify: `pi-visual-primitives/README.md`

**Interfaces:**
- Consumes: Existing README installation/tool sections.
- Produces: Public documentation matching the broader visual-evidence trigger model.

- [ ] **Step 1: Replace the opening description**

Replace the first two paragraphs under `# Pi Visual Primitives` with:

```md
Pi Visual Primitives is a Pi extension package that gives agents visual-evidence helper tools. Use it for tasks involving images, screenshots, rendered UI, reference designs, visual effects, frontend visual reproduction, visual comparison, or visual QA when the agent needs to draw conclusions from visual appearance.

Coordinates are not the trigger. A need for visual evidence is the trigger. The package creates local crop and annotation artifacts that agents can inspect or reuse while reasoning about visuals.

The design is inspired by the "Thinking with Visual Primitives" paper overview: points and bounding boxes can act as concrete spatial references during visual reasoning. This package does not generate boxes, detect objects, OCR text, segment images, or infer UI elements automatically. It turns user-provided or agent-estimated regions into local crop or annotation artifacts.
```

- [ ] **Step 2: Add visual evidence features**

In the `## Features` list, add these bullets before `Crop one bounding box from a local image.`:

```md
- Create visual evidence artifacts for screenshot analysis, frontend visual reproduction, visual comparison, and visual QA.
- Annotate or crop UI regions such as headers, cards, sidebars, forms, buttons, charts, and footers.
```

- [ ] **Step 3: Update Skill section positioning**

Replace the first paragraph under `## Skill: `visual-primitives`` with:

```md
This package also includes a real Pi Skill at `skills/visual-primitives/SKILL.md`. The Skill teaches agents to use visual evidence workflows for screenshots, UI visual effects, frontend visual reproduction, visual comparison, visual QA, and coordinate-defined region inspection.
```

Replace the `Use it when a prompt involves:` list with:

```md
- screenshots, images, diagrams, rendered UI, or reference designs
- frontend visual reproduction or screenshot-to-code tasks
- visual comparison between a reference and current implementation
- UI visual QA for spacing, alignment, typography, color, shadows, borders, radius, hierarchy, or layout
- visual-primitive bounding boxes, normalized `0-999` coordinates, explicit pixel boxes, or point references
- top-left or bottom-left coordinate systems
- cropping, annotating, zooming into, inspecting, or reusing visual regions
```

Replace the paragraph after the list with:

```md
The Skill intentionally reinforces that crops and annotations are evidence artifacts, not prerequisites. It also reinforces that this package does not generate bounding boxes or detect objects; it helps agents inspect user-provided or agent-estimated regions.
```

- [ ] **Step 4: Add a visual reproduction example**

Before `## Tool: `crop_bounding_box``, add:

```md
## Visual Evidence Workflow Example

For a prompt like `Recreate this dashboard screenshot and match the spacing`, an agent should identify the screenshot, decide which visual conclusions need evidence, annotate major regions such as `sidebar`, `header`, `primary-card`, and `button`, crop important areas for focused inspection, implement the UI, then compare equivalent reference/current regions after rendering.

For screenshots and rendered UI, prefer `coordinateSpace: "pixel"` unless the source clearly uses normalized visual-primitive coordinates. For paper-style visual primitive coordinates, use the default `normalized-999` behavior.
```

- [ ] **Step 5: Run focused package tests**

Run:

```bash
cd pi-visual-primitives
node --experimental-strip-types --test tests/package.test.ts
```

Expected: PASS.

---

### Task 6: Full Verification

**Files:**
- No source modifications expected.

**Interfaces:**
- Consumes: All previous tasks.
- Produces: Fresh verification evidence.

- [ ] **Step 1: Run syntax check**

Run:

```bash
cd pi-visual-primitives
npm run check
```

Expected: PASS with all listed TypeScript files checked successfully.

- [ ] **Step 2: Run full test suite**

Run:

```bash
cd pi-visual-primitives
npm test
```

Expected: PASS with all `tests/*.test.ts` passing.

- [ ] **Step 3: Inspect git status**

Run:

```bash
cd pi-visual-primitives
git status --short
```

Expected: modified files should be limited to `README.md`, `src/extension.ts`, `tests/extension.test.ts`, `tests/package.test.ts`, `skills/visual-primitives/SKILL.md`, and new docs under `docs/superpowers/`.

- [ ] **Step 4: Review diff for scope**

Run:

```bash
cd pi-visual-primitives
git diff -- README.md src/extension.ts tests/extension.test.ts tests/package.test.ts skills/visual-primitives/SKILL.md docs/superpowers/specs/2026-06-30-visual-evidence-trigger-design.md docs/superpowers/plans/2026-06-30-visual-evidence-trigger-implementation.md
```

Expected: diff should only broaden Skill/tool/documentation/test language. Runtime crop algorithms should be unchanged.

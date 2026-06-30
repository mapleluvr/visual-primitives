# Visual Evidence Trigger Design

## Summary

`pi-visual-primitives` should be repositioned from a narrow coordinate utility into a visual-evidence workflow for agents. The trigger should not be "the user provided coordinates." The trigger should be: a task involves images, screenshots, UI visuals, or visual effects, and the agent needs to draw any conclusion from visual appearance.

Coordinates, crops, and annotations are evidence artifacts produced during visual reasoning. They are not prerequisites that limit when the Skill applies.

## Current Problem

The current Skill and tool guidance emphasize explicit visual-primitive coordinates, bounding boxes, normalized `0-999` boxes, and user-provided regions. This makes agents treat the tools as useful only after coordinates already exist.

That positioning suppresses usage in high-value workflows where coordinates are not the user's starting point, such as:

- Reproducing a screenshot or UI component visually.
- Comparing a reference design with a current implementation.
- Inspecting spacing, alignment, typography, color, shadows, borders, radius, and layout hierarchy.
- Debugging visual regressions from screenshots.
- Breaking a large screenshot into smaller regions before drawing conclusions.

The observed desired behavior is broader: when an agent must make visual judgments, it should proactively create inspectable visual evidence with crops and annotations.

## Goals

- Increase Skill activation for image, screenshot, UI, frontend visual reproduction, visual comparison, and visual QA tasks.
- Teach agents that visual conclusions should be grounded in generated visual artifacts when useful.
- Encourage annotation and cropping as an intermediate reasoning step, not only as a user-requested final output.
- Keep the runtime tools focused: they still crop, batch-crop, annotate, and point-crop existing or estimated regions.
- Preserve honesty about limitations: the package does not perform object detection, OCR, segmentation, or automatic coordinate generation.

## Non-Goals

- Do not add computer-vision detection models.
- Do not claim that the tools automatically identify UI elements.
- Do not require the user to provide bounding boxes before the Skill applies.
- Do not turn the package into a full visual diff engine or screenshot testing framework.
- Do not require crops or annotations for every visual task when the conclusion is already trivial and locally inspectable.

## Trigger Model

The Skill should activate when both conditions are true:

1. The task involves visual effects, images, screenshots, rendered UI, design references, diagrams, or visual artifacts.
2. The agent needs to draw a conclusion about what is visible, even if the conclusion is coarse.

Examples that should trigger the Skill:

- "Recreate this screenshot in React."
- "Make this page match the reference image."
- "Compare this render with the design."
- "Why does this card look off?"
- "Inspect the button spacing in this screenshot."
- "Does the chart label overlap the axis?"
- "Crop the header and check alignment."
- "Mark the key regions in this image."

The Skill should still trigger for the original precise-coordinate workflows:

- "Crop box `[120, 80, 420, 360]` from `scene.png`."
- "Use normalized `0-999` coordinates."
- "Draw these boxes over the source image."

## Skill Repositioning

The `visual-primitives` Skill should describe itself as a visual-evidence workflow:

> Use this Skill for any task involving images, screenshots, UI visual effects, visual comparison, frontend visual reproduction, or visual QA where the agent must draw conclusions from visual appearance. Use crops and annotations as intermediate evidence artifacts. Coordinates may be provided by the user or estimated by the agent from visible regions, then verified with annotation or crop outputs.

The Skill should explicitly state:

> Coordinates are not the trigger. A need for visual evidence is the trigger. Crops and annotations are evidence artifacts produced during visual reasoning, not prerequisites for using this Skill.

## Revised Workflow

1. Identify the visual source: image, screenshot, reference design, rendered UI, or generated artifact.
2. Identify the visual question: what conclusion needs evidence?
3. Decide whether whole-image inspection is enough or whether region evidence is useful.
4. For large or complex visuals, divide the image into meaningful regions such as header, hero, card, sidebar, form, button, chart, modal, or footer.
5. Use `annotate_bounding_boxes` to make region assumptions visible when region placement matters.
6. Use `crop_bounding_box` or `crop_multiple_bounding_boxes` to extract key regions for focused inspection.
7. Use `crop_around_point` for point-centered visual questions only when an explicit radius or size is available or can be chosen deliberately for the inspection task.
8. Inspect the generated artifact before making detailed visual claims.
9. For frontend reproduction, iterate: inspect reference, implement, capture current render, compare regions, adjust, and repeat when necessary.

## Coordinate Policy

The package still consumes coordinates at runtime, but the agent may derive temporary coordinates from visible layout reasoning when the user has not supplied them.

Guidelines:

- Use user-provided coordinates when available.
- Use pixel coordinates for screenshots and rendered UI images when image dimensions or screen pixels are the natural frame.
- Use normalized `0-999` coordinates for paper-style visual primitive references or model outputs that use that convention.
- Use `annotate_bounding_boxes` to verify estimated region coordinates before relying on them.
- Treat estimated coordinates as provisional; adjust if annotation or crop output is off-target.
- Do not claim the tool detected an object. Say the agent selected or estimated a region, then verified it.

## Tool Guidance Updates

### `crop_bounding_box`

Add guidance that this tool is useful for focused visual inspection, not only explicit user crop requests. It should be used when a visual task needs a close look at one region, including UI reproduction and visual QA.

Suggested prompt guidance:

- Use `crop_bounding_box` to isolate one visually relevant region when answering image, screenshot, UI reproduction, or visual QA questions.
- Coordinates may come from the user or from the agent's provisional region estimate; inspect the crop before making detailed claims.
- Prefer `coordinateSpace: "pixel"` for screenshots and rendered UI unless the source clearly uses normalized visual-primitive coordinates.

### `crop_multiple_bounding_boxes`

Add guidance that this is the preferred tool for decomposing complex screenshots or reference designs into several inspectable regions.

Suggested prompt guidance:

- Use `crop_multiple_bounding_boxes` when a complex image or UI should be inspected as multiple regions, such as header, card, sidebar, form, button, chart, or footer.
- Label boxes with semantic region names so output artifacts remain useful during implementation and comparison.
- Use fail-fast behavior when all regions should be valid; use individual crop calls when partial progress is better.

### `annotate_bounding_boxes`

Make this the primary verification tool for estimated regions and visual reasoning boundaries.

Suggested prompt guidance:

- Use `annotate_bounding_boxes` to make region assumptions visible before relying on them for visual conclusions.
- Use it for UI screenshot decomposition, visual comparison planning, and frontend reproduction checkpoints.
- The tool does not detect elements; it draws boxes selected or provided by the agent/user so their placement can be inspected.

### `crop_around_point`

Position this as a focused inspection tool for point-centered visual questions.

Suggested prompt guidance:

- Use `crop_around_point` when the visual question centers on a point of interest, such as an overlap, alignment issue, cursor target, label anchor, or small defect.
- Provide an explicit radius or size based on the intended inspection area; do not invent arbitrary defaults without a reason.
- Inspect the crop before drawing detailed conclusions.

## Documentation Updates

Update `README.md` to introduce the broader use case near the top:

- The package supports visual evidence workflows for images, screenshots, UI visual reproduction, and visual QA.
- The original coordinate utilities remain the implementation mechanism.
- Crops and annotations are intermediate artifacts that help agents inspect and verify visual conclusions.

Update the Skill section to mention frontend visual reproduction and screenshot analysis as first-class use cases.

Add examples:

- Annotate major regions in a reference screenshot before implementing.
- Crop a card and button region to inspect spacing and shadow details.
- Batch-crop reference/current regions during visual comparison.

## Test Updates

Existing runtime behavior should remain unchanged. Tests should focus on changed registration metadata and documentation expectations.

Recommended test changes:

- Update `tests/package.test.ts` assertions so the Skill must mention visual evidence, screenshots, UI visual effects, frontend visual reproduction, and visual comparison.
- Update `tests/extension.test.ts` assertions so tool prompt guidelines mention screenshot/UI inspection where appropriate.
- Keep existing crop, coordinate, clamp, annotation, and point-crop behavior tests unchanged.

No new runtime image-processing behavior is required for this design.

## Risks and Mitigations

### Risk: Agents overuse tools for trivial visuals

Mitigation: the Skill should say crops and annotations are useful when they improve evidence, focus, or verification. They are not mandatory for every visual mention.

### Risk: Agents imply automatic detection

Mitigation: repeat the boundary clearly: the package draws/crops provided or agent-estimated regions; it does not detect, OCR, segment, or infer elements automatically.

### Risk: Estimated coordinates are wrong

Mitigation: prefer annotation previews for region verification, inspect outputs before making claims, and iterate when off-target.

### Risk: Skill becomes too broad

Mitigation: require both an image/visual source and a need to draw a visual conclusion. Pure styling advice without an image does not need this Skill.

## Acceptance Criteria

- The Skill description no longer makes provided coordinates feel like a prerequisite.
- The Skill explicitly says that visual evidence need is the trigger.
- The Skill includes frontend visual reproduction, screenshot analysis, visual comparison, and UI visual QA examples.
- Tool prompt guidelines encourage proactive crop/annotation use for visual inspection workflows.
- Documentation reflects the broader positioning while preserving the non-goals.
- Tests validate the updated Skill and tool guidance text.
- Runtime tool behavior remains compatible with existing tests.

## Recommended Implementation Order

1. Rewrite `skills/visual-primitives/SKILL.md` around visual-evidence triggering.
2. Update `src/extension.ts` prompt snippets and prompt guidelines for all four tools.
3. Update `README.md` with the broader positioning and examples.
4. Update metadata/documentation tests.
5. Run `npm test` and `npm run check` in `pi-visual-primitives`.

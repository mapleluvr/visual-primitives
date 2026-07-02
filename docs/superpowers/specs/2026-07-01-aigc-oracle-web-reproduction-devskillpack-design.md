# AIGC Oracle Web Reproduction Dev Skill Pack Design

## Summary

Add a development Skill Pack to `pi-visual-primitives` with two layers: a general-purpose visual primitives usage layer and a frontend web reproduction workflow layer guided by AIGC oracle images and text descriptions. The Skill Pack teaches agents to mark, compare, align, analyze, and inspect images with visual evidence tools, then composes those techniques into code execution, masked image diffing, and iterative verdict-driven drafts for high-precision frontend replication.

The first supporting script is `masked-oracle-diff`, a cross-platform Node.js image evidence generator. It accepts two same-viewport images and exclusion boxes for non-code-drawable regions. Everything outside the exclusions is scored. The script produces deterministic diff artifacts: masked grayscale diff, heatmap, overlay, exclusion/scoring masks, a 25 x 25 sparse scoring matrix, local component/stripe detections, and verdict evidence for the next draft loop.

## Goals

- Provide a dev-focused Skill Pack with a standalone `using-visual-primitives` base skill and a `frontend-replication` workflow skill family.
- Make `using-visual-primitives` useful outside frontend replication by teaching practical image marking, comparison, alignment, analysis, crop verification, region naming, size quantification, and direct inspection techniques.
- Model the oracle input as an ordered list of picture and description pairs:
  - `Array<{ oraclePicture: string, description: string }>`
- Treat the optimization objective as minimizing masked visual difference between oracle screenshots and rendered screenshots after excluding only justified non-code-drawable regions.
- Support two workflows:
  - Inline Execution, where the parent agent performs every draft, implementation, verification, and feedback step directly.
  - Subagent-Driven Development, where the parent orchestrates draft, implementation, verification, review, and fix passes with one writer at a time.
- Make draft history cumulative: every new draft uses all previous drafts as context and the latest verdict as the condition.
- Keep the diff script cross-platform and aligned with the existing package stack by using Node.js and `sharp`, not Python, OpenCV, shell-only scripts, or platform-specific binaries.
- Produce visual artifacts that agents must directly inspect before drawing detailed conclusions.

## Non-Goals

- The script does not generate oracle images.
- The script does not decide which regions are non-code-drawable. The Skill workflow and direct inspection make that judgment.
- The script does not accept a list of code-replicable regions. Mask outside the exclusions is always the scoring domain.
- The script does not replace final agent or user visual review.
- The first version does not use neural perceptual metrics such as LPIPS.
- The first version does not require browser automation. It consumes image files produced by the surrounding workflow.

## Key Terms

- Oracle picture: A target image, often AIGC, that inspires the webpage appearance.
- Description: Text paired with an oracle picture that explains intent, content, or style.
- Rendered picture: A screenshot of the agent-produced webpage at the target viewport.
- Exclusion box: A narrow region that is justified as impossible or unreasonable to reproduce precisely with code. It is masked out of scoring.
- Scoring domain: Every pixel outside exclusion boxes.
- Draft: A markdown design artifact that names elements, records positions, classifies code-drawable versus excluded regions, and proposes implementation actions.
- Initial Draft: The first draft, built from oracle pictures and descriptions.
- Feedback Draft: A later draft, built from all previous drafts plus the latest verdict.
- Verdict: Verification output that decides whether to deliver, inspect further, or create another feedback draft.

## Optimization Objective

The working objective is:

```text
minimize sum over oracle pairs of Diff(
  MaskOut(OraclePicture, ExclusionBoxes),
  MaskOut(RenderedPicture, ExclusionBoxes)
)
```

Subject to:

```text
Every exclusion box must be narrowly justified as not precisely code-drawable.
Everything outside exclusion boxes must be reproduced with code at high precision.
```

The diff score is not the only acceptance signal. It is one deterministic evidence source for the Verify step. Agents still inspect annotated images, crops, diff artifacts, and rendered output directly.

## Skill Pack Shape

The package should expose a small skill set instead of one monolithic skill:

```text
skills/using-visual-primitives/
  SKILL.md
  references/
    marking-images.md
    comparing-images.md
    aligning-images.md
    analyzing-images.md

skills/frontend-replication/
  SKILL.md
  references/
    oracle-inputs.md
    draft-contract.md
    verdict-contract.md
    masked-oracle-diff.md

skills/inline-replication/
  SKILL.md

skills/subagent-driven-replication/
  SKILL.md

skills/refining-with-feedback/
  SKILL.md

skills/finalizing-replication/
  SKILL.md
```

`using-visual-primitives` is the base skill. It should teach reusable techniques for the current tools even when no frontend replication task is involved:

- marking images with `annotate_bounding_boxes`;
- verifying marks by cropping the same coordinates with `crop_bounding_box` or `crop_multiple_bounding_boxes`;
- comparing multiple images by annotating corresponding regions and quantifying `resolvedPixelBox` width, height, and area;
- aligning images through shared coordinate frames, labels, and corresponding boxes;
- analyzing image regions through direct inspection, crop iteration, and point-focused crops;
- recording pixel coordinates, normalized thousandths, relative positions, and visual features.

`frontend-replication` is the orchestration entry point for AIGC oracle image plus description webpage reproduction. It should route agents to `inline-replication` or `subagent-driven-replication`, require `refining-with-feedback` when verdicts exist, and require `finalizing-replication` before user-facing delivery review.

The package should add the diff implementation and tests:

```text
scripts/masked-oracle-diff.ts
src/oracle-diff.ts
src/oracle-diff-schema.ts
tests/oracle-diff.test.ts
```

Each `SKILL.md` should be concise enough for discovery and should link to references for detailed contracts. Descriptions must describe triggering conditions only, not summarize the workflow. Example descriptions:

```yaml
---
name: using-visual-primitives
description: Use when marking, comparing, aligning, analyzing, cropping, annotating, or inspecting images, screenshots, UI renders, visual regions, bounding boxes, or point references with visual evidence tools.
---
```

```yaml
---
name: frontend-replication
description: Use when reproducing frontend webpages from AIGC oracle images, reference screenshots, and descriptions where visual evidence, masked diff evidence, drafts, verdicts, or iterative feedback are needed.
---
```

## Skill Responsibility Boundaries

`using-visual-primitives` should stand on its own. A user comparing product photos, checking chart alignment, proofreading screenshots, inspecting generated images, or analyzing visual artifacts should benefit from it without loading the frontend replication workflow. It should focus on tool technique: how to mark, crop, annotate, align, compare, quantify, inspect, and iterate on image evidence.

`using-visual-primitives` should state three basic principles:

1. User requirements take priority. If user instructions specify what to inspect, compare, ignore, crop, annotate, or conclude, the workflow follows those requirements before default heuristics.
2. Direct visual inspection takes priority over CV or script-derived conclusions. Computer-vision scripts and diff scripts produce useful evidence, but their outputs are not universally interpretable and can produce misleading inferences. Agents must inspect the actual images, annotations, crops, and overlays before making visual claims.
3. Think geometrics, write coordinates. Build understanding through repeated appearance -> coordinates -> appearance loops: observe the visual impression, express the relevant local geometry as concrete coordinates, inspect the resulting crop or annotation, then refine the coordinates and interpretation. The goal is deep understanding of specific local image content at specific positions, not generic image commentary.

`frontend-replication` should not duplicate all base tool guidance. It should depend on `using-visual-primitives` for image evidence mechanics and add the webpage-specific loop: oracle pairs, drafts, code execution, masked diffing, verdicts, feedback drafts, subagent orchestration, and final delivery review.

The child lifecycle skills should stay narrow:

- `inline-replication`: parent-agent execution of the full loop.
- `subagent-driven-replication`: parent-orchestrated multi-agent execution with one writer.
- `refining-with-feedback`: converting verdicts plus draft history into the next draft.
- `finalizing-replication`: direct inspection and handoff after diff evidence is clean.

## Inline Execution Workflow

### State Model

```text
Draft_0 = InitialDraft(OraclePairs)
Rendered_0 = CodeExecution(Draft_0)
Verdict_0 = Verify(DraftHistory=[Draft_0], Rendered_0, OraclePairs)

Draft_n = FeedbackDraft(
  DraftHistory=[Draft_0 ... Draft_{n-1}],
  LatestVerdict=Verdict_{n-1},
  OraclePairs
)
Rendered_n = CodeExecution(Draft_n)
Verdict_n = Verify(DraftHistory=[Draft_0 ... Draft_n], Rendered_n, OraclePairs)
```

The latest draft is always authored with all previous drafts as context and the latest verdict as the condition. A later draft must preserve earlier confirmed facts unless the latest verdict explicitly invalidates them.

### Initial Draft

The agent creates a markdown file for the initial draft. It must:

- Read each oracle picture and description.
- Use `annotate_bounding_boxes` to mark:
  - visual effects that can be drawn accurately with CSS, SVG, HTML, canvas, or other code;
  - illustration, painting, or texture elements that appear not precisely code-drawable.
- Read the annotated pictures directly before trusting the boxes.
- Use `crop_bounding_box` or `crop_multiple_bounding_boxes` with the same coordinates used for annotation.
- Directly inspect every crop and verify each box is precise:
  - the box is correctly positioned;
  - the box fully contains the intended element;
  - the box does not meaningfully exceed the visible element boundary.
- Name every relevant element with a stable identifier.
- Record absolute position in both pixel coordinates and normalized thousandths of the original picture.
- Record relative position against nearby elements.
- Record visual features, including font choice, font size, text shadow, shadow softness, border radius, alignment, baseline, tilt, stroke, gradient, opacity, texture, and other traits that affect appearance.
- For color-sensitive elements, record sampled color points rather than relying on broad verbal color names.
- Clearly separate code-drawable elements from exclusion candidates.

### Code Execution

The agent implements the page from the latest draft. Code execution should preserve the draft's element identifiers where practical, for example in component names, comments, test labels, or screenshot notes. The rendered picture must be captured at the same viewport and scale as the oracle picture before diffing.

### Verify

Verify has three layers.

#### Layer 1: Exclusion Classification Review

For every exclusion candidate, verify whether it truly cannot be precisely drawn with code. If the region is a normal web effect, CSS shape, text, border, gradient, simple texture, shadow, icon, or SVG-like geometry, it should not be excluded. It must be reproduced with code and scored.

#### Layer 2: Masked Diff Evidence

Run `masked-oracle-diff` with only:

- oracle image;
- rendered image;
- exclusion boxes.

The script scores every unmasked pixel. The agent directly inspects the diff artifacts:

- `diff.gray.png`
- `diff.heatmap.png`
- `diff.overlay.png`
- `matrix.json`
- `matrix.csv`
- `components.json`
- `stripes.json`
- generated `VERDICT.md`

If the grayscale diff contains bright local regions, or the 25 x 25 matrix contains non-zero stripe-like bands or high scoring regions, the workflow enters Feedback.

#### Layer 3: Direct Inspection

If the diff artifacts do not show abnormalities, the agent performs final direct inspection. Inline Execution uses the parent agent. Subagent-Driven Development may use one or more read-only inspectors. If inspection passes, the result is handed to the user for user-facing delivery review. If inspection fails, the agent writes a verdict and enters Feedback.

### Feedback

Feedback is the same loop shape as the initial workflow, but the draft is conditional on the latest verdict and grounded in the entire draft history.

A Feedback Draft must:

- reference every earlier draft it relies on;
- preserve confirmed coordinates, features, and classifications;
- identify which verdict findings it addresses;
- update only the elements or assumptions implicated by the verdict;
- rerun annotation or crop checks when any box, classification, or visual claim changes.

The loop stops when:

- masked diff artifacts show no meaningful bright local regions or stripe-like matrix abnormalities;
- direct inspection passes;
- no unresolved exclusion classification issues remain;
- the user-facing delivery review is ready.

The loop stops for escalation when:

- a region cannot be confidently classified as code-drawable or excluded;
- the oracle and rendered screenshots cannot be aligned to the same viewport;
- repeated feedback rounds disagree on the same visual cause;
- the requested reproduction appears to require a product or asset decision outside the approved scope.

## Subagent-Driven Development Workflow

The parent session remains the orchestrator. The workflow keeps one writer at a time and uses read-only subagents for draft review, verification, and direct inspection.

Recommended roles:

- Parent orchestrator: owns scope, verdict synthesis, approvals, and final response.
- Draft reviewer: reviews the draft for missing elements, weak classifications, imprecise coordinates, or insufficient color sampling.
- Worker: implements the approved draft and produces the rendered screenshot.
- Diff verifier: runs or inspects `masked-oracle-diff` artifacts and reports evidence-backed findings.
- Direct inspector: performs final visual inspection when diff evidence looks clean.
- Fix worker: applies accepted feedback from synthesized verdicts.

Subagent flow:

```text
Parent creates Initial Draft
-> optional read-only draft review
-> one worker implements and captures rendered picture
-> read-only verifier inspects masked diff artifacts
-> parent synthesizes Verdict
-> one fix worker applies accepted feedback if needed
-> focused verifier or inspector checks the updated result
```

Child subagents must receive concrete role-specific prompts. They should not launch their own subagent workflows. Review-only children must not edit project files.

## Draft Markdown Contract

Each draft markdown file should use this structure:

```markdown
# Draft N: <short name>

## Inputs
- Oracle pairs:
- Prior drafts used:
- Latest verdict used:

## Global Frame
- Oracle dimensions:
- Target viewport:
- Coordinate system:

## Element Registry

### <element-id>
- Classification: code-drawable | exclusion-candidate | excluded-non-code
- Absolute position px: [left, top, right, bottom]
- Absolute position normalized-999: [left, top, right, bottom]
- Relative position:
- Visual features:
- Color samples:
- Evidence files:
- Implementation notes:
- Verification notes:

## Exclusion Boxes
- <id>: [left, top, right, bottom], reason, evidence files

## Implementation Plan

## Verification Plan
```

Drafts must be append-friendly. Do not overwrite older drafts during a feedback loop. New drafts should reference previous draft paths and verdict paths.

## Verdict Contract

A verdict should separate code replication failures, mask/classification problems, ignored excluded differences, and direct inspection notes.

```markdown
# Verdict N

## Status
feedback-required | direct-inspection-required | delivery-review-ready | blocked

## Inputs
- Draft history:
- Oracle image:
- Rendered image:
- Diff run directory:

## Code Replication Failures
- Finding with element id, location, evidence path, and suggested next check.

## Mask Or Classification Problems
- Exclusion boxes that are too broad, too narrow, or not justified.

## Ignored Non-Code Differences
- Differences inside approved excluded regions.

## Direct Inspection Notes

## Next Draft Conditions
- Concrete conditions Draft N+1 must satisfy.
```

## `masked-oracle-diff` Script Contract

### CLI

The script should be runnable through Node on every supported Pi platform:

```bash
node --experimental-strip-types scripts/masked-oracle-diff.ts --manifest path/to/manifest.json
```

The package may also add an npm script:

```json
{
  "scripts": {
    "oracle:diff": "node --experimental-strip-types scripts/masked-oracle-diff.ts"
  }
}
```

### Manifest

The manifest intentionally does not accept code-replicable regions. The scoring domain is the whole image minus exclusions.

```json
{
  "oracleImage": "oracle.png",
  "renderedImage": "rendered.png",
  "outputDir": ".visual-oracle-diff/run-001",
  "coordinateSpace": "pixel",
  "exclusionBoxes": [
    {
      "id": "painted-character-01",
      "box": [120, 80, 420, 360],
      "reason": "complex hand-painted figure, not precisely code-drawable"
    }
  ],
  "options": {
    "gridSize": 25,
    "localWindow": 11,
    "maskPadding": 0,
    "diffColorSpace": "oklab",
    "blurSigma": 0.6,
    "highlightThreshold": 0.18,
    "stripeThreshold": 0.10,
    "minCellCoverage": 0.2
  }
}
```

### Coordinate Rules

- First version requires oracle and rendered images to have identical dimensions.
- Exclusion boxes are in the shared image coordinate system and mask the same location in both images.
- `coordinateSpace: "pixel"` is the default and recommended mode for screenshots.
- `coordinateSpace: "normalized-999"` may be supported to align with existing visual primitive conventions, but the script should normalize to pixel boxes before scoring.
- Boxes use `[left, top, right, bottom]` with top-left origin.
- Out-of-bounds boxes fail by default rather than silently resizing the scoring domain.

### Output Directory

```text
.visual-oracle-diff/run-001/
  manifest.normalized.json
  summary.json
  VERDICT.md
  exclusion-mask.png
  scoring-domain-mask.png
  masked-oracle-preview.png
  masked-rendered-preview.png
  diff.gray.png
  diff.heatmap.png
  diff.overlay.png
  matrix.json
  matrix.csv
  components.json
  stripes.json
```

### Mask Rendering Rules

`diff.gray.png` is the primary deterministic evidence image.

- Alpha is always 255.
- Mask outside exclusions maps diff score to grayscale:
  - score 0.0 -> black `#000000`
  - score 1.0 -> white `#ffffff`
- Mask inside exclusions is fixed neutral dark gray:
  - `#303030`
  - RGBA `[48, 48, 48, 255]`
- Transparency is never used to express mask or diff in `diff.gray.png`.

Separate mask images make exclusion state explicit:

- `exclusion-mask.png`: white means excluded, black means scored.
- `scoring-domain-mask.png`: white means scored, black means excluded.

`diff.overlay.png` may use transparency because it is only an auxiliary human inspection artifact, not the primary scoring image.

### Diff Algorithm

1. Load both images with `sharp`.
2. Validate dimensions, color channels, and manifest schema.
3. Resolve exclusion boxes into pixel rectangles.
4. Build a boolean scoring mask where every pixel outside exclusions is scored.
5. Optionally apply light blur to both images before comparison to reduce antialiasing noise.
6. Convert RGB pixels to the selected diff space. First version should support:
   - `rgb` as a simple fallback;
   - `oklab` as the preferred perceptual mode.
7. Compute per-pixel scalar diff in `[0, 1]` for scored pixels.
8. Write mask pixels as `#303030` in `diff.gray.png` and exclude them from all numeric summaries.
9. Create `diff.heatmap.png` and `diff.overlay.png` from scored pixel diffs.
10. Generate matrix, component, stripe, and summary outputs.

### 25 x 25 Sparse Scoring Matrix

The matrix covers the full image. Each cell reports only unmasked pixels.

For each cell:

```json
{
  "row": 8,
  "col": 12,
  "bounds": [691, 307, 749, 345],
  "coverage": 0.94,
  "mean": 0.07,
  "p90": 0.16,
  "score": 0.10
}
```

Recommended first-version score:

```text
score = 0.65 * meanDiff + 0.35 * p90Diff
```

Sparse matrix output rules:

- If `coverage < minCellCoverage`, the cell is unscored and appears as `null` in the compact matrix.
- If `score < stripeThreshold`, the compact matrix value is `0`.
- Otherwise the compact matrix value is the rounded score.

### Local Highlight Detection

The script thresholds the scored diff image at `highlightThreshold`, then finds connected components outside the mask. Each component reports:

- id;
- bbox;
- center;
- area in pixels;
- mean diff;
- max diff;
- matrix rows and columns touched.

Bright local components become verdict evidence because they often indicate missed shadows, border radius errors, misaligned text, incorrect icons, or local layout mismatches.

### Stripe Detection

The script scans the compact matrix for stripe-like non-zero patterns. It should detect:

- horizontal runs;
- vertical runs;
- diagonal runs;
- elongated connected matrix components.

Stripe-like patterns become verdict evidence because they often indicate baseline mismatch, consistent offset, border/stroke mismatch, shadow edge mismatch, or a global layout shift.

### Summary JSON

`summary.json` should include:

```json
{
  "status": "feedback-required",
  "dimensions": { "width": 1440, "height": 900 },
  "scoredPixels": 1024000,
  "excludedPixels": 96000,
  "global": {
    "mean": 0.032,
    "p90": 0.084,
    "p95": 0.126,
    "max": 0.72
  },
  "components": { "count": 4, "maxArea": 3800, "maxDiff": 0.72 },
  "stripes": { "count": 1, "maxMeanScore": 0.31 },
  "artifacts": {
    "gray": "diff.gray.png",
    "heatmap": "diff.heatmap.png",
    "overlay": "diff.overlay.png",
    "matrix": "matrix.json"
  }
}
```

The default status should be:

- `feedback-required` when bright local components or stripe-like matrix abnormalities are present;
- `direct-inspection-required` when numeric artifacts are below thresholds;
- `blocked` when inputs are invalid.

The script should not output `delivery-review-ready`; only agent direct inspection and user-facing review can reach that state.

## Color Sampling Requirement

The Skill Pack should require point sampling for color-sensitive claims. This can be satisfied in the first implementation by adding color sample fields to drafts and using image-reading utilities or a small Node helper. It should not be folded into `masked-oracle-diff` unless the script is explicitly asked to sample named points. The diff script may report high-diff cell coordinates that help the agent choose color sample points.

## Testing Strategy

### Unit Tests

- Manifest schema accepts only valid required fields.
- Same-size images pass; mismatched dimensions fail.
- Pixel exclusion boxes resolve correctly.
- Mask pixels in `diff.gray.png` are exactly `[48, 48, 48, 255]`.
- Unmasked zero-difference pixels are black.
- Unmasked high-difference pixels are bright/white.
- Masked pixels do not contribute to global scores.
- Matrix cells with low coverage become `null`.
- Matrix cells below threshold become `0`.
- Local components are detected outside the mask.
- Differences inside the mask do not produce components.
- Stripe-like matrix patterns are detected.

### Integration Tests

- Generate two small synthetic images with one masked area and one unmasked mismatch.
- Run the CLI with a manifest.
- Assert all output artifacts exist.
- Assert `summary.json` reports `feedback-required`.
- Assert `VERDICT.md` references the unmasked mismatch and does not blame the masked mismatch.

### Skill Tests

The skill should be tested as process documentation:

- Baseline agents should be observed skipping at least one required step without the skill, such as diffing the whole image without masking, treating exclusions as code regions, or stopping before direct inspection.
- With the skill, agents should preserve draft history, use latest verdict conditions, exclude only justified non-code regions, inspect diff artifacts, and avoid treating script success as final delivery.

## Acceptance Criteria

The spec is implemented when:

- A discoverable dev skill is added for AIGC oracle web reproduction.
- The skill documents both Inline Execution and Subagent-Driven Development workflows.
- Draft and verdict markdown contracts are documented.
- The `masked-oracle-diff` CLI runs cross-platform with Node.js and `sharp`.
- The CLI accepts only the two image paths plus exclusion boxes as scoring inputs.
- The CLI scores every unmasked pixel.
- `diff.gray.png` uses opaque grayscale, with mask pixels fixed to `#303030`.
- The CLI outputs a 25 x 25 sparse matrix, components, stripes, summary JSON, and verdict markdown.
- Tests cover mask behavior, matrix behavior, component/stripe detection, and CLI artifact generation.
- Documentation makes clear that the script is feedback evidence, not the final success judge.

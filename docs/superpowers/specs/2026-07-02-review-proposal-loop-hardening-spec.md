# Review Proposal Loop Hardening Spec

## Context

`docs/review-proposal.md` and `docs/skill-set-loop-review.md` reviewed the new `pi-visual-primitives` Skill Set and the frontend replication loop. Some review points are already resolved in the current working tree:

- `scripts/masked-oracle-diff.ts` exists and is exposed through `npm run oracle:diff`.
- The legacy `skills/visual-primitives/SKILL.md` entry has been retired.
- README and the active roadmap now describe the Skill Set.

This spec covers the remaining approved work needed to connect the loop to the new diff script, harden shared contracts, and add the only approved new visual tool from the proposal: `sample_colors`.

## Goals

1. Add second-order geometric reasoning rules to `using-visual-primitives`.
2. Add a `sample_colors` tool for exact color sampling at agent/user-provided points.
3. Connect `inline-replication` and `subagent-driven-replication` Verify stages to `npm run oracle:diff` with manifest guidance.
4. Add loaded `references/` contracts for draft, verdict, oracle manifest, masked diff, and screenshot capture.
5. Define a stable `oracle-manifest.json` schema/template for the run workspace.
6. Add loop budget and escalation guidance to prevent infinite refinement.
7. Declare subagent route dependencies and graceful fallback behavior.
8. Record the tool boundary decisions in roadmap/docs: no `overlay_grid`, no `measure_distance`; use skills for second-order quantities and tools only for coordinate-to-artifact or coordinate-to-number operations.

## Non-Goals

- No automatic UI element detection.
- No OCR.
- No edge/contour detection.
- No segmentation.
- No automatic bounding box generation.
- No `overlay_grid` tool.
- No `measure_distance` tool.
- No browser screenshot automation helper in this pass. This pass adds a screenshot capture contract only.
- No package dependency on `pi-subagents` or superpowers packages. The SDR path declares optional environment dependencies and fallback behavior.

## Design Principles

### Tool Boundary

Tools do two things:

1. Turn coordinates into visual artifacts: crop, batch crop, annotation, point crop.
2. Turn coordinates into numeric evidence: exact color sampling.

Coordinates are produced by the agent or user. Tools never infer coordinates from the image.

### Second-Order Quantities

Distance, gap, offset, alignment, size difference, area ratio, and proportional comparison are derived quantities. Agents must estimate each coordinate independently and compute the derived value explicitly.

Example:

```text
gap = card2.left - card1.right = 412 - 330 = 82px
```

The final report should use the computed value, not an eyeballed difference.

### Direct Inspection Priority

`masked-oracle-diff`, matrix scores, components, stripe reports, and color samples are evidence generators. Direct inspection of the source image, annotations, crops, masked diff artifacts, and sampled points remains the interpreter.

## `sample_colors` Tool

### Purpose

`sample_colors` fills the VLM structural weakness for exact CSS color values. It reads pixels at user/agent-provided points and returns RGB, hex, OKLab, and optional patch mean colors.

### Input

```json
{
  "imagePath": "oracle.png",
  "points": [
    { "label": "header-bg", "point": [130, 40] },
    { "label": "cta-button", "point": [620, 340] }
  ],
  "coordinateSpace": "pixel",
  "origin": "top-left",
  "patchSize": 3
}
```

Fields:

- `imagePath`: source image path, with the same path handling as existing tools.
- `points`: non-empty array of labeled or unlabeled points.
- `coordinateSpace`: `pixel` or `normalized-999`, default `normalized-999`.
- `origin`: `top-left` or `bottom-left`, default `top-left`.
- `patchSize`: positive odd integer, default `1`. A patch is clipped to image bounds.

### Output

Each sample returns:

```json
{
  "index": 0,
  "label": "header-bg",
  "resolvedPixelPoint": { "x": 130, "y": 40 },
  "patch": {
    "size": 3,
    "sampledPixels": 9,
    "meanRgb": { "r": 24, "g": 32, "b": 48 },
    "meanHex": "#182030"
  },
  "rgb": { "r": 24, "g": 32, "b": 48 },
  "alpha": 255,
  "hex": "#182030",
  "oklab": { "l": 0.2381, "a": -0.0032, "b": -0.0259 }
}
```

The tool samples only provided points. It does not find colors automatically.

## References Contracts

Create `skills/frontend-replication/references/` with these files:

- `oracle-manifest.md`: schema and example for `oracles/oracle-manifest.json`.
- `draft-contract.md`: required Initial Draft and Feedback Draft sections.
- `verdict-contract.md`: required verdict categories and evidence path format.
- `masked-oracle-diff.md`: CLI command, manifest example, output interpretation.
- `screenshot-capture.md`: viewport and same-size rendered screenshot contract.

These references are loaded by skills through explicit relative links. Runtime-critical contracts should live here, not only in design specs.

## Skill Updates

### `using-visual-primitives`

Add a section named `Second-Order Quantities Must Be Computed` with the coordinate -> arithmetic -> result procedure.

Add `sample_colors` to tool selection and color analysis guidance. Color claims that require CSS-level precision should use `sample_colors` at explicit points.

### `frontend-replication`

Reference the new contracts during Oracle Intake and route selection:

- `references/oracle-manifest.md`
- `references/draft-contract.md`
- `references/screenshot-capture.md`

The gateway should create or update `oracles/oracle-manifest.json` using the reference schema.

### `inline-replication`

In Verify, require a `scripts/diff-manifest.json` and run:

```bash
npm run oracle:diff -- --manifest docs/visual-primitives/runs/<run-id>/scripts/diff-manifest.json
```

The skill must route output into `diffs/` and cite `VERDICT.md`, `summary.json`, matrix, components, and stripes in process verdicts.

### `subagent-driven-replication`

In Verify, the orchestrator prepares or approves the diff manifest and may assign a worker/reviewer to run `npm run oracle:diff`. Reviewer presets inspect the diff artifacts and work completion. The orchestrator synthesizes the final process verdict.

Declare that `pi-subagents`, `subagent-driven-development`, and superpowers workflows are environment-supported optional dependencies. If unavailable, the orchestrator should use `inline-replication` or direct parent-agent execution.

### `refining-with-feedback`

Add loop budget and escalation:

- Default max feedback rounds: 3.
- If the same finding recurs after two feedback drafts, escalate to the user or switch strategy.
- If viewport/screenshot size cannot be made identical, stop and produce a blocked verdict.
- If accepted exclusions keep expanding into code-drawable content, escalate instead of masking more.

### `finalizing-replication`

Require final inspection to cite the diff outputs and direct visual evidence. A clean diff opens final inspection; it does not complete it.

## Roadmap / README Updates

- Record the approved tool boundary.
- Record `overlay_grid` as rejected.
- Record `measure_distance` as rejected in favor of the second-order skill procedure.
- Record `sample_colors` as the approved color sampling tool.
- Mention `sample_colors` in README features and tool list.
- Mention SDR optional dependencies and fallback.

## Validation Requirements

Tests must cover:

1. `sample_colors` schema validation for points and patch size.
2. `sample_colors` runtime sampling for pixel coordinates.
3. `sample_colors` normalized coordinate conversion.
4. `sample_colors` extension registration and prompt guidance.
5. README/package tests for second-order rules, references, CLI wiring, sample colors, optional SDR dependency declaration, and roadmap decisions.
6. Existing crop/annotate/diff tests remain green.

Verification commands:

```bash
node --experimental-strip-types --test tests/schema.test.ts tests/phase2.test.ts tests/extension.test.ts tests/package.test.ts
node --experimental-strip-types --test tests/masked-oracle-diff.test.ts
npm test
npm run check
git diff --check
```

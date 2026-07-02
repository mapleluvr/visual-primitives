---
name: inline-replication
description: Use when one parent agent is executing frontend webpage replication from oracle images, rendered screenshots, visual drafts, masked diff evidence, or feedback verdicts.
---

# Inline Replication

## Overview

`inline-replication` runs the frontend replication loop inside the parent agent. Use it after `frontend-replication` has selected a run workspace, registered oracle inputs, and chosen inline execution.

Required background:

- **REQUIRED SUB-SKILL:** `using-visual-primitives` for image marking, cropping, alignment, comparison, color sampling, and direct visual inspection.
- Use `frontend-replication/references/draft-contract.md` for draft shape.
- Use `frontend-replication/references/masked-oracle-diff.md` for Verify diff manifests and interpretation.
- Use `frontend-replication/references/screenshot-capture.md` before capturing rendered images.
- Use `refining-with-feedback` when a verdict requires another loop.
- Use `finalizing-replication` when verification evidence is clean enough for final direct inspection.

## Workspace Contract

Work inside the selected run workspace:

```text
docs/visual-primitives/runs/<run-id>/
```

Use the gateway workspace directory meanings:

```text
oracles/ annots/ cropped/ rendered/ diffs/ drafts/ verdict/ scripts/ final/
```

Read `oracles/oracle-manifest.json` when it exists. If it is only planned, create the missing manifest from the registered oracle inputs before drafting.

## Loop

```text
Initial Draft
-> Code Execution
-> Verify
-> Verdict
-> Feedback Draft if needed
-> repeat or finalizing-replication
```

The parent agent owns the whole loop and keeps the working context together.

## Initial Draft

Write the first draft under `drafts/initial-draft.md` or a numbered equivalent.

The draft should record:

- oracle image paths and descriptions;
- annotated and cropped evidence paths;
- named visual elements;
- absolute coordinates in pixels and normalized thousandths when useful;
- relative positions against nearby anchors;
- visual features such as typography, shadow, radius, blur, alignment, spacing, color samples, gradients, and layering;
- code-drawable regions;
- exclusion candidates that may be impossible to reproduce precisely with code.

Use annotations before trusting broad region assumptions. Use crops with the same coordinates to confirm that important boxes are precise enough for implementation.

## Code Execution

Implement from the current draft. Keep user requirements and the draft evidence visible while coding.

Capture the rendered result into `rendered/` using the same viewport and pixel dimensions recorded in `oracles/oracle-manifest.json`. Record screenshot commands or one-off run notes under `scripts/` when they matter for reproducibility.

## Verify

Use direct visual inspection first. Use masked diff evidence as supporting evidence; direct inspection remains the interpreter.

Verification should check:

- code-drawable elements are reproduced with high precision;
- exclusion candidates are narrow and justified;
- rendered screenshots match the same viewport or canvas contract as the oracle;
- annotations, crops, and diff artifacts point to concrete locations;
- mask-out regions preserve all code-drawable content in the scoring domain;
- visible differences are either accepted limitations or feedback items.

Before masked diff, write a run-local manifest such as:

```text
scripts/diff-manifest.json
```

Run:

```bash
npm run oracle:diff -- --manifest docs/visual-primitives/runs/<run-id>/scripts/diff-manifest.json
```

Store diff outputs under `diffs/`. Cite `VERDICT.md`, `summary.json`, `matrix.json`, `components.json`, and `stripes.json` in process findings under `verdict/`.

When `components.json` reports local highlights, inspect each important component center with `crop_around_point` before explaining the difference. Use second-order coordinate calculations for offsets, gaps, sizes, and alignment, and use `sample_colors` when the component suggests a color, contrast, gradient, or shadow mismatch.

## Verdict And Feedback

Write a process verdict under `verdict/`, such as `verdict/inline-verdict-001.md`.

A useful verdict separates:

- blockers;
- fixes worth doing now;
- optional or deferred improvements;
- accepted exclusions;
- evidence paths;
- the next route.

When fixes are needed, invoke `refining-with-feedback`. The next draft is conditioned on **all previous drafts** plus the **latest verdict**; preserve confirmed facts and revise only what the evidence challenges.

When no feedback loop is needed, invoke `finalizing-replication` for final direct inspection and user-facing delivery review.

## Common Mistakes

- Writing page code before an evidence-backed Initial Draft exists.
- Treating a clean diff as completion before direct inspection.
- Use `verdict/` for process feedback and `final/` for delivery handoff.
- Dropping earlier draft facts when writing a feedback draft.
- Expanding exclusion boxes until real code-drawable differences disappear.

---
name: frontend-replication
description: Use when reproducing frontend webpages from AIGC oracle images, reference screenshots, rendered UI, and descriptions where visual evidence, masked diff evidence, drafts, verdicts, or iterative feedback are needed.
---

# Frontend Replication

## Overview

`frontend-replication` is a gateway skill for oracle-image-driven frontend reproduction. It selects the local run workspace, prepares oracle inputs, and routes the task to the correct replication workflow.

## Required Sub-Skills

- **REQUIRED SUB-SKILL:** `using-visual-primitives` for marking, cropping, comparing, aligning, and analyzing visual evidence.
- Use `inline-replication` for parent-agent execution.
- Use `subagent-driven-replication` for parent-orchestrated multi-agent execution.
- Use `refining-with-feedback` when a prior verdict or failed inspection should condition the next draft.
- Use `finalizing-replication` when diff evidence is clean and the work needs final direct inspection before user-facing delivery review.

## References

Use these runtime contracts when preparing or routing a run:

- `references/oracle-manifest.md`
- `references/draft-contract.md`
- `references/verdict-contract.md`
- `references/masked-oracle-diff.md`
- `references/screenshot-capture.md`

## Inputs

Expected input shape:

```text
OraclePairs = Array<{ oraclePicture, description }>
```

Screenshots or reference images are sufficient to start Oracle Intake.

Optional constraints:

```text
viewport, target app, stack, allowed assets, allowed libraries, implementation scope
```

## Run Workspace

Use one run-local workspace per replication task:

```text
docs/visual-primitives/runs/<run-id>/
```

Use a stable, descriptive `<run-id>`, such as `2026-07-01-dashboard-oracle`.

Required directories:

```text
docs/visual-primitives/runs/<run-id>/
  oracles/
  annots/
  cropped/
  rendered/
  diffs/
  drafts/
  verdict/
  scripts/
  final/
```

Directory behavior:

- `oracles/`: oracle pictures, source reference images, user descriptions, derived descriptions, and `oracle-manifest.json`.
- `annots/`: outputs from `vp annotate`.
- `cropped/`: outputs from `vp crop` and `vp crop-multi`.
- `rendered/`: rendered webpage screenshots.
- `diffs/`: masked diff artifacts and summaries.
- `drafts/`: initial and feedback drafts. Drafts accumulate as new files.
- `verdict/`: process verdicts from inline or subagent verification. A verdict is feedback evidence and may become stale.
- `scripts/`: run-local manifests, screenshot commands, and one-off task scripts. The packaged `masked-oracle-diff` implementation remains under this Skill's `scripts/` resources.
- `final/`: final direct-inspection notes and user-facing delivery review artifacts.

## Oracle Intake

If the user provides screenshots or reference images without sufficient text, derive a working oracle description.

Use `using-visual-primitives` to:

1. register oracle images under `oracles/`;
2. annotate major regions with `vp annotate`;
3. directly inspect annotated outputs;
4. crop important regions with the same coordinates;
5. directly inspect crop outputs;
6. write an evidence-backed oracle description;
7. write or update `oracles/oracle-manifest.json` using `references/oracle-manifest.md`.

The derived oracle description should record layout, visual hierarchy, region labels, important coordinates, relative positions, colors or `vp colors` evidence, code-drawable areas, exclusion candidates, and evidence artifact paths. Use `references/draft-contract.md` for draft shape and `references/screenshot-capture.md` before Verify needs rendered images.

If the user already provided a description, keep it as authoritative intent. The derived description supplements it with visual evidence; it does not replace user intent.

## Route Selection

| Situation | Use |
| --- | --- |
| Small page or one agent can manage the loop | `inline-replication` |
| Complex page, high precision, many regions, or multiple review angles | `subagent-driven-replication` |
| Existing verdict, failed inspection, or previous draft history | `refining-with-feedback` |
| Diff evidence is clean and delivery needs final direct inspection | `finalizing-replication` |

## Artifact Rules

- Keep all replication artifacts inside the selected run workspace.
- Use `verdict/` only for process feedback.
- Put final inspection and delivery review material under `final/`; use `final/` for delivery review.
- Prefer references to artifact paths over restating long visual observations.
- Preserve user-provided oracle descriptions and images.

## Exit

This skill exits after:

- the run workspace is selected or created;
- oracle images are registered;
- missing oracle descriptions are derived when needed;
- `oracle-manifest.json` exists or is planned with concrete inputs;
- the replication route is selected;
- the next required sub-skill is named.

The selected child workflow owns drafting, implementation, verification, feedback, and final inspection details.

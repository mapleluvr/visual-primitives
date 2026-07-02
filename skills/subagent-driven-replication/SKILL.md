---
name: subagent-driven-replication
description: Use when orchestrating subagents for frontend webpage replication from oracle images, visual drafts, rendered screenshots, masked diff evidence, or verification feedback.
---

# Subagent-Driven Replication

## Overview

`subagent-driven-replication` is an Orchestrator-led frontend replication workflow. Use it after `frontend-replication` has selected a run workspace, registered oracle inputs, and chosen subagent execution.

Required background:

- **REQUIRED SUB-SKILL:** `using-visual-primitives` for visual evidence work.
- **OPTIONAL ENVIRONMENT SUPPORT:** `pi-subagents`, `subagent-driven-development`, and superpowers workflows improve orchestration when available.
- If `pi-subagents` or superpowers orchestration is unavailable, fall back to `inline-replication` or direct parent-agent execution.
- Use `frontend-replication/references/masked-oracle-diff.md` for Verify diff manifests and interpretation.
- Use `frontend-replication/references/screenshot-capture.md` before captured renders enter diff.
- Use `refining-with-feedback` after the Orchestrator has synthesized a verdict that requires another loop.
- Use `finalizing-replication` when verification evidence is clean enough for final direct inspection.

## Orchestrator Contract

The parent Orchestrator owns scope, routing, worker prompts, review synthesis, verdict handling, and loop decisions. Child subagents receive role-specific tasks; orchestration stays in the parent session.

Default subagent posture:

- prefer `async: true` for long visual or implementation tasks;
- avoid `timeoutMs` and `maxRuntimeMs` because visual annotation, rendering, and verification can run longer than expected;
- use status/control checks for long-running children;
- keep every artifact inside the selected run workspace.

## Worker Concurrency Rule

At the same time only one worker should be active. The Orchestrator may sequentially dispatch multiple workers across the process to split work by phase or scope.

Examples:

- one visual annotation worker for Initial Draft evidence;
- later one code worker for page implementation;
- later one fix worker for accepted feedback.

This preserves a clear write path while still allowing the work to be decomposed over time.

## Phase 1: Initial Draft With A Visual Annotation Worker

Initial Draft may use a read-write subagent. This worker is closer to a visual annotation worker than a reviewer.

Give the visual annotation worker permission to use:

```text
annotate_bounding_boxes
crop_bounding_box
crop_multiple_bounding_boxes
write/edit draft markdown
```

The worker should write only run-workspace artifacts such as annotated images, crops, and drafts. Page implementation starts in Code Execution.

Expected output:

```text
annots/...
cropped/...
drafts/initial-draft.md
```

The draft should name visual elements, record coordinates, describe relative positions and visual features, identify code-drawable areas, and propose narrowly justified exclusion candidates. It must directly inspect annotation and crop outputs before claiming a region is understood.

## Phase 2: Code Execution

The Orchestrator may use `subagent-driven-development` or other superpowers workflows to plan and execute the page implementation.

Keep the worker concurrency rule: at the same time only one worker is active. Sequentially dispatch multiple workers when it helps split implementation into clear phases, but finish or stop one worker before starting the next worker.

Code Execution should produce:

```text
rendered/...
scripts/...
```

The implementation worker should receive the current draft, oracle manifest, relevant evidence paths, user constraints, expected viewport, screenshot capture contract, and validation expectations.

## Phase 3: Verify With Reviewers

Verify is primarily work-reasonableness and completion approval. Use the reviewer preset when available.

Reviewer tasks should inspect the actual artifacts:

- oracle manifest and user descriptions;
- drafts;
- annotated images and crops;
- rendered screenshots;
- masked diff outputs;
- code diff or implementation files when relevant.

The Orchestrator prepares or approves `scripts/diff-manifest.json`, then runs or assigns exactly one worker/reviewer step to run:

```bash
npm run oracle:diff -- --manifest docs/visual-primitives/runs/<run-id>/scripts/diff-manifest.json
```

Diff evidence should include `VERDICT.md`, `summary.json`, `matrix.json`, `components.json`, and `stripes.json` from `diffs/`.

When `components.json` reports local highlights, assign exactly one current worker or reviewer step to inspect important component centers with `crop_around_point`. Ask for second-order coordinate calculations for offsets, gaps, sizes, and alignment, and use `sample_colors` when the component suggests a color, contrast, gradient, or shadow mismatch.

Ask reviewers for approval findings scoped to draft reasonableness, completion, and evidence quality. Useful angles include:

- draft and exclusion reasonableness;
- completion against code-drawable visual requirements;
- evidence quality and missing artifacts;
- rendered-vs-oracle differences that require feedback.

Reviewers normally stay read-only for project/source files. Returning findings through their configured output artifact is allowed.

## Phase 4: Orchestrator Verdict

When reviewer findings, diff evidence, or direct inspection indicate a VERDICT exists, the Orchestrator must synthesize it directly.

Write or update a verdict.md under `verdict/`, such as:

```text
verdict/orchestrator-verdict-001.md
```

Synthesize child outputs into the verdict:

- blockers;
- fixes worth doing now;
- optional or deferred notes;
- accepted exclusions;
- rejected exclusions or mask problems;
- evidence paths;
- whether the loop continues or moves to finalizing.

The verdict is process feedback; final direct inspection happens through `finalizing-replication`.

## Phase 5: Continue Or Finalize

If the verdict requires more work, invoke `refining-with-feedback`. The next loop starts from all previous drafts plus the latest Orchestrator verdict.

If verification is clean, invoke `finalizing-replication` for final direct inspection and user-facing delivery review.

## Common Mistakes

- Treating Initial Draft workers as read-only reviewers when they need read-write visual annotation capability.
- Letting multiple workers write at the same time.
- Setting `timeoutMs` or `maxRuntimeMs` on subagent launches and accidentally terminating visual work.
- Synthesize reviewer output before writing verdict.md.
- Continuing into another implementation loop before `refining-with-feedback` has shaped the next draft.

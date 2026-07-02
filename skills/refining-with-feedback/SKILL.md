---
name: refining-with-feedback
description: Use when a frontend replication loop has a process verdict, failed inspection, masked diff evidence, or previous draft history that must shape the next draft.
---

# Refining With Feedback

## Overview

`refining-with-feedback` turns the latest process verdict plus DraftHistory into the next feedback draft. Its job is to preserve confirmed visual facts while targeting evidence-backed fixes.

Use it after `inline-replication` or `subagent-driven-replication` has written a process verdict that requires another loop.

## Inputs

Read from the selected run workspace:

```text
oracles/oracle-manifest.json
drafts/
verdict/
annots/
cropped/
rendered/
diffs/
```

Required inputs:

- **DraftHistory:** all previous drafts, including the Initial Draft and every feedback draft.
- **Latest verdict:** the newest inline or Orchestrator process verdict under `verdict/`.
- **Evidence paths:** annotations, crops, rendered screenshots, masked diff artifacts, and direct-inspection notes referenced by the verdict.

## Core Contract

```text
FeedbackDraft_n = f(DraftHistory, latest verdict, oracle manifest, evidence paths)
```

The feedback draft must preserve confirmed facts from all previous drafts and apply the latest verdict as the current condition.

Confirmed facts include:

- stable element names and labels;
- accepted coordinates and relative positions;
- verified typography, spacing, color, shadow, border, radius, layering, and alignment observations;
- accepted exclusions;
- user-provided requirements and oracle descriptions;
- limitations already accepted by the user or process verdict.

Update a confirmed fact only when the latest verdict or cited evidence paths challenge it directly.

## Verdict Parsing

Parse the latest verdict into these groups:

- blockers;
- fixes worth doing now;
- optional/deferred notes;
- accepted exclusions;
- rejected exclusions;
- mask problems;
- evidence paths;
- route recommendation.

Only blockers, fixes worth doing now, rejected exclusions, and mask problems should drive the next required work. Optional/deferred notes stay visible; a user request can promote them into the next loop scope.

## Write The Feedback Draft

Write a new file under `drafts/`, such as:

```text
drafts/feedback-draft-001.md
```

Use a new numbered file. Keep earlier drafts intact.

The draft should contain:

1. **Source Context**: oracle manifest, all previous drafts, latest verdict, and key evidence paths.
2. **Preserved Facts**: confirmed visual facts that remain binding for the next loop.
3. **Verdict Targets**: each blocker or fix-now item, with the affected element, coordinates or region, cited evidence paths, and desired visual outcome.
4. **Exclusion Updates**: accepted exclusions, rejected exclusions, and mask problems that change the scoring domain.
5. **Next Execution Brief**: concrete instructions for the next code execution step.
6. **Validation Focus**: what the next Verify phase should inspect first.
7. **Route**: return to `inline-replication` or `subagent-driven-replication` according to the active workflow.

## Loop Budget And Escalation

Default max feedback rounds: 3.

Escalate or ask the user before continuing when:

- the same finding recurs after two feedback drafts;
- viewport or screenshot size cannot be made identical for masked diff;
- accepted exclusions keep expanding into code-drawable content;
- a fix requires a product, architecture, or asset decision outside the approved scope.

When blocked by screenshot dimensions, write a blocked verdict with both image sizes and the capture command before returning to the user.

## Route Back To The Loop

After writing the feedback draft:

- return to `inline-replication` when the active loop is parent-agent inline execution;
- return to `subagent-driven-replication` when the active loop is Orchestrator-led subagent execution;
- make the next code execution step consume the new feedback draft plus the preserved DraftHistory.

This Skill prepares the next draft and route; code execution and worker dispatch stay with inline-replication or subagent-driven-replication.

## Quality Checks

Before handing off, confirm:

- every fix-now target maps to evidence paths;
- every coordinate-changing instruction cites the draft or verdict source;
- stable element names are preserved;
- accepted exclusions remain narrow;
- rejected exclusions and mask problems are explicit;
- required work contains blockers, fix-now targets, rejected exclusions, and mask problems;
- the next route is named.

## Common Mistakes

- Preserve DraftHistory when writing each feedback draft.
- Fixing only the newest visible issue while dropping confirmed facts.
- Treating optional/deferred notes as required work.
- Keep stable element names unless verdict evidence requires a rename.
- Create a concrete feedback draft before returning to the execution loop.

# Verdict Contract

Verdicts are process feedback under `verdict/`. They are inputs to `refining-with-feedback`, not final delivery artifacts.

## Path Examples

```text
verdict/inline-verdict-001.md
verdict/orchestrator-verdict-001.md
verdict/finalizing-verdict-001.md
```

## Required Sections

```markdown
# Process Verdict

## Status
feedback-required | ready-for-finalizing | blocked

## Blockers
- Finding with exact evidence path and location.

## Fixes Worth Doing Now
- Finding with exact evidence path and location.

## Optional / Deferred
- Non-blocking notes.

## Accepted Exclusions
- Region ID, box, and reason.

## Rejected Exclusions / Mask Problems
- Region ID, box, reason, and required correction.

## Evidence Paths
- `diffs/run-001/summary.json`
- `diffs/run-001/VERDICT.md`
- `cropped/...`
- `annots/...`

## Route
refining-with-feedback | finalizing-replication | ask-user
```

## Rules

- Use `blockers` and `fixes worth doing now` for the next required loop.
- Keep optional/deferred notes visible without expanding scope by default.
- Cite concrete evidence paths and local coordinates for each required finding.

---
name: finalizing-replication
description: Use when frontend replication verification is clean enough for final direct inspection, delivery review, or final failure routing.
---

# Finalizing Replication

## Overview

`finalizing-replication` turns clean verification evidence into final direct inspection and user-facing delivery review artifacts. It is the last gate before handing the replication to the user for review.

Use it after `inline-replication` or `subagent-driven-replication` reports that verify evidence is clean enough to leave the feedback loop.

## Inputs

Read from the selected run workspace:

```text
oracles/oracle-manifest.json
drafts/
annots/
cropped/
rendered/
diffs/
verdict/
final/
```

Use the latest relevant artifacts:

- user requirements and oracle descriptions;
- DraftHistory or the latest draft summary;
- final rendered screenshot under `rendered/`;
- final annotations and crops;
- final masked diff artifacts under `diffs/`;
- accepted exclusions and remaining limitations;
- latest process verdict when it explains why the loop is ready for final inspection.

## Final Direct Inspection

Diff clean opens final inspection; final direct inspection decides the handoff. Direct visual inspection remains the interpreter.

Inspect:

- the oracle image and derived oracle description;
- the final rendered screenshot at the intended viewport;
- key annotated regions and crops;
- masked diff gray/heatmap/matrix evidence;
- `summary.json`, `components.json`, and `stripes.json` from the final diff run;
- accepted exclusions and their boundaries;
- user requirements and any stated constraints.

A final inspection should answer:

- Are user requirements covered?
- Are code-drawable regions visually reproduced at the expected precision?
- Are accepted exclusions narrow and still justified?
- Are mask-out areas limited to non-code-precise regions?
- Are any remaining differences visible enough to mention to the user?
- Are the final artifacts sufficient for user-facing delivery review?

## Success Artifacts

When final direct inspection passes, write final handoff artifacts under `final/`:

```text
final/final-inspection.md
final/delivery-review.md
final/accepted-render.png
final/remaining-limitations.md
```

`final/final-inspection.md` should record the final evidence reviewed, the accepted exclusions, and the inspection result.

`final/delivery-review.md` should be user-facing. Include:

- implementation scope;
- final rendered artifact path;
- key oracle and evidence paths;
- direct-inspection summary;
- accepted limitations;
- recommended user review focus.

`final/accepted-render.png` should point to or copy the rendered screenshot accepted for review.

`final/remaining-limitations.md` should record accepted limitations or state that no user-visible limitations were identified.

## Failure Artifacts

When final direct inspection finds a required fix, write:

```text
final/final-inspection-failed.md
verdict/finalizing-verdict-001.md
```

The failed inspection should cite exact evidence paths and concrete visual locations. The finalizing verdict should be process feedback that can enter `refining-with-feedback`.

After writing failure artifacts, route to `refining-with-feedback` so the next feedback draft can restart the loop from DraftHistory plus the latest finalizing verdict.

## Quality Checks

Before success handoff, confirm:

- final direct inspection reviewed actual image artifacts;
- viewport and screenshot source are recorded;
- accepted exclusions are listed;
- final diff artifacts are cited;
- `final/final-inspection.md` exists;
- `final/delivery-review.md` exists;
- remaining limitations are explicit;
- the handoff is ready for user-facing delivery review.

Before failure handoff, confirm:

- `final/final-inspection-failed.md` identifies the failed visual claim;
- `verdict/finalizing-verdict-001.md` contains blockers or fixes worth doing now;
- the next route is `refining-with-feedback`.

## Common Mistakes

- Treating diff cleanliness as the final handoff.
- Placing final delivery material in `verdict/`.
- Sending the user a summary without final image evidence.
- Losing accepted exclusions when writing the delivery review.
- Continuing implementation inside this Skill rather than routing failures back through feedback.

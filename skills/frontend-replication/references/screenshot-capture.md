# Screenshot Capture Contract

Masked diff requires oracle and rendered images from the same viewport and with the same pixel dimensions.

## Required Record

Record screenshot capture details under `scripts/` or in the relevant draft/verdict:

```text
viewport.width = 1440
viewport.height = 900
deviceScaleFactor = 1
browser = project default
route = /
rendered output = rendered/render-001.png
```

## Rules

- Use the same viewport for oracle analysis and rendered capture.
- Confirm the rendered screenshot has the same pixel dimensions as the oracle before running `masked-oracle-diff`.
- If dimensions differ, stop Verify and produce a blocked verdict with both dimensions and the capture command.
- Do not resize rendered images to force a pass; resampling changes the evidence.
- Store rendered screenshots under `rendered/`.

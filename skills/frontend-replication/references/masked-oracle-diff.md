# Masked Oracle Diff Contract

Use `masked-oracle-diff` during Verify after a rendered screenshot exists at the same viewport and pixel dimensions as the oracle image.

## Command

```bash
npm run oracle:diff -- --manifest docs/visual-primitives/runs/<run-id>/scripts/diff-manifest.json
```

## Manifest Path

```text
docs/visual-primitives/runs/<run-id>/scripts/diff-manifest.json
```

## Manifest Example

```json
{
  "oracleImage": "../oracles/oracle-001.png",
  "renderedImage": "../rendered/render-001.png",
  "outputDir": "../diffs/run-001",
  "exclusionBoxes": [
    {
      "id": "painted-character",
      "box": [120, 80, 420, 360],
      "reason": "complex painted figure, not precisely code-drawable"
    }
  ],
  "options": {
    "gridSize": 25,
    "localWindow": 11,
    "highlightThreshold": 0.18,
    "stripeThreshold": 0.1,
    "minCellCoverage": 0.2,
    "minComponentArea": 4
  }
}
```

## Outputs

The CLI writes `diff.gray.png`, `diff.heatmap.png`, `diff.overlay.png`, `exclusion-mask.png`, `scoring-domain-mask.png`, masked previews, `matrix.json`, `matrix.csv`, `components.json`, `stripes.json`, `summary.json`, and `VERDICT.md` into `outputDir`.

If input validation blocks scoring, such as mismatched oracle/rendered dimensions, the CLI writes `summary.json` with `status: "blocked"`, writes a blocked `VERDICT.md`, and exits with a non-zero status.

## Interpretation

- Masked pixels are opaque neutral dark gray `#303030` and excluded from scoring.
- Every unmasked pixel is part of the scoring domain.
- High local brightness in `diff.gray.png` and high matrix cells are inspection targets.
- `minComponentArea` filters tiny isolated highlight components while preserving larger local differences for inspection.
- `status: "feedback-required"` means diff evidence found components or stripe-like patterns that should enter process feedback.
- `status: "direct-inspection-required"` means no script-detected component or stripe blocks final inspection.
- `status: "blocked"` means inputs must be fixed before scoring can continue.
- The script produces evidence; direct visual inspection remains the interpreter.

# Oracle Manifest Contract

Use this contract for `oracles/oracle-manifest.json` inside each run workspace.

## Path

```text
docs/visual-primitives/runs/<run-id>/oracles/oracle-manifest.json
```

## Required Shape

```json
{
  "runId": "2026-07-02-dashboard-oracle",
  "viewport": { "width": 1440, "height": 900, "deviceScaleFactor": 1 },
  "oraclePairs": [
    {
      "id": "oracle-001",
      "oraclePicture": "oracles/oracle-001.png",
      "description": "oracles/oracle-001.md",
      "descriptionSource": "user-provided-and-derived",
      "evidence": [
        "annots/oracle-001-layout.png",
        "cropped/oracle-001/hero.png"
      ]
    }
  ],
  "constraints": {
    "stack": "project default",
    "allowedAssets": [],
    "allowedLibraries": [],
    "implementationScope": "current user request"
  }
}
```

## Rules

- `viewport` is required before masked diff verification.
- `oraclePairs` is the source of truth for oracle images and descriptions.
- Evidence paths are relative to the run workspace.
- Derived descriptions supplement user intent; they do not replace user-provided requirements.

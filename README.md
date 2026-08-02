# Visual Primitives

[中文](README.zh-CN.md)

`@mapleluvr/visual-primitives` ships one versioned package containing:

- the workflow-agnostic `vp` CLI for turning explicit boxes and points into inspectable image evidence; and
- six Agent Skills for generic visual evidence and frontend replication workflows.

Node.js 22.18 or newer is required. The package does not perform object detection, OCR, segmentation, automatic box generation, or UI inference. Users or agents provide the coordinates, and direct visual inspection remains the interpreter of generated artifacts.

## Install The CLI

Install both binary aliases globally from npm:

```bash
npm install -g @mapleluvr/visual-primitives
vp --help
visual-primitives --version
```

The two aliases are equivalent. The public command surface contains exactly five commands:

| Command | Purpose |
| --- | --- |
| `vp crop` | Crop one rectangular region. |
| `vp crop-multi` | Crop several regions from one source image. |
| `vp annotate` | Draw labeled boxes on a same-size preview. |
| `vp point` | Crop around an explicit point and radius or size. |
| `vp colors` | Sample exact colors at explicit points. |

Run `vp <command> --help` for complete flag and JSON input documentation.

## CLI Examples

Flag mode defaults to pixel coordinates:

```bash
vp annotate screenshot.png --box "header:40,30,240,180" --out annotated.png
vp crop screenshot.png --box "40,30,240,180" --out header.png
vp crop-multi screenshot.png \
  --box "header:40,30,240,180" \
  --box "button:280,220,420,280" \
  --out-dir crops
vp point screenshot.png --point "80,50" --radius 30 --out detail.png
vp colors screenshot.png --point "header-bg:80,50" --patch 3
```

Use `--space normalized-999` for normalized thousandths, `--origin bottom-left` when y grows upward, and `--box-order left-bottom-right-top` for bottom-left box tuples.

Every successful command writes one JSON value to stdout. Summaries and warnings go to stderr and can be suppressed with `--quiet`. Usage failures exit `2`; image and filesystem failures exit `1`.

### JSON Compatibility

`--json <file|->` accepts the original five Pi tool payload shapes. JSON mode preserves their `normalized-999` default and rejects unknown properties, wrong types, non-finite values, invalid enums, mutually exclusive fields, and command-inapplicable fields.

```bash
vp crop --json crop.json
```

```json
{
  "imagePath": "screenshot.png",
  "box": [40, 30, 240, 180],
  "coordinateSpace": "pixel",
  "outputPath": "header.png"
}
```

## Install The Skill Set In Pi

Install a pinned npm version:

```bash
pi install npm:@mapleluvr/visual-primitives@0.2.0
```

Or install a pinned Git tag:

```bash
pi install git:github.com/mapleluvr/visual-primitives@v0.2.0
```

The Pi package manifest loads Skills only. It does not register a visual-primitives extension.

Pi package installation does not guarantee that npm binaries are placed on the system `PATH`. Agent guidance therefore invokes the packaged CLI through `skills/_shared/run-vp.mjs`. Humans may still use a globally installed `vp` binary.

## Skill Set

The package includes six discoverable Skills:

- `using-visual-primitives`: generic guidance for selecting and using the five `vp` commands, coordinate conventions, direct inspection, and second-order measurements.
- `frontend-replication`: gateway for oracle-driven frontend reproduction.
- `inline-replication`: parent-agent replication loop.
- `subagent-driven-replication`: orchestrated worker and reviewer loop.
- `refining-with-feedback`: draft-history and verdict synthesis.
- `finalizing-replication`: final direct inspection and delivery routing.

Use `using-visual-primitives` for standalone image and screenshot evidence. Use `frontend-replication` when the task includes oracle intake, implementation rounds, masked scoring, verdicts, or delivery review. Specialized Skills reference the generic command and coordinate guidance instead of duplicating it.

## Frontend Replication Examples

These examples show the `frontend-replication` -> `inline-replication` workflow in a single-pass render. They demonstrate the replication Skills, not automatic output from the `vp` CLI: the CLI supplies inspectable image evidence, while the Skills own implementation and feedback.

### Simple task: analytics dashboard

The oracle is a regular dashboard layout with a sidebar, KPI row, chart cards, and a transactions table.

![Analytics dashboard oracle next to the single-pass render](docs/visual-primitives/examples/pulse-side-by-side.png)

*Left: oracle mockup. Right: single-pass render.*

### Complex task: dense desktop UI

The oracle is a real NetEase Cloud Music desktop screenshot (`1448x940`) with three major regions, dense Chinese typography, icons, badges, aligned table columns, and a floating progress bar.

![NetEase Cloud Music oracle next to the single-pass render](docs/visual-primitives/examples/netease-side-by-side.png)

*Left: oracle screenshot. Right: single-pass render. Full-resolution oracle, render, and side-by-side files are available under [`docs/visual-primitives/examples/`](docs/visual-primitives/examples/).*

## Frontend Workflow Helper

`masked-oracle-diff` remains owned by the frontend replication workflow. It is not a `vp` command, npm binary, generic core export, or responsibility of `using-visual-primitives`.

When a replication Skill is loaded, resolve `scripts/run-masked-oracle-diff.mjs` relative to the loaded `frontend-replication` Skill directory and invoke that package-local runner from the consumer project:

```bash
node <frontend-replication-skill-dir>/scripts/run-masked-oracle-diff.mjs --manifest docs/visual-primitives/runs/<run-id>/scripts/diff-manifest.json
```

A repository maintainer working in this package checkout may instead use `npm run oracle:diff -- --manifest <path>`. Consumer projects do not need that npm script. The runner, source, and built runtime live under `skills/frontend-replication/scripts/`. The helper writes masks, previews, diff images, matrix data, components, stripes, `summary.json`, and `VERDICT.md`. A clean diff opens final direct inspection; it does not declare delivery success by itself.

## Versioning

The CLI and Skill Set use one package version and one Git tag. Package version `X.Y.Z` corresponds to tag `vX.Y.Z`. Command names, JSON input semantics, exit codes, documented Skill resources, and helper ownership are protected compatibility contracts.

## Migration from `pi-visual-primitives`

The legacy package registered TypeScript Pi extension tools such as `crop_bounding_box` and `sample_colors`. Version `0.2.0` replaces that runtime surface with the standalone five-command CLI and a skills-only Pi package.

1. Remove the legacy package from Pi settings or uninstall it with the source identity previously used.
2. Install `npm:@mapleluvr/visual-primitives@0.2.0` or the pinned Git tag shown above.
3. Replace old extension tool calls with `vp crop`, `vp crop-multi`, `vp annotate`, `vp point`, and `vp colors`.
4. For agent execution, use the package-local launcher described by `using-visual-primitives`; do not assume `vp` is on `PATH`.
5. Keep masked oracle diff work inside the frontend replication Skill family.

## Development

```bash
npm ci --ignore-scripts
npm run check
npm test
npm run package:smoke
npm audit --audit-level=high
```

`npm run package:smoke` creates and installs a temporary tarball, invokes both aliases and all five commands on a generated PNG, validates all six Skills, runs the package-local launcher with package bins removed from `PATH`, and verifies frontend helper ownership.

CI runs on Ubuntu, Windows, and macOS with Node 22.18.0 and Node 24.x. Publishing is tag-gated and uses npm Trusted Publishing with provenance. First-publication prerequisites, restart behavior, and the separately authorized live steps are documented in [RELEASE.md](RELEASE.md). Creating or pushing a release tag is a separate authorized release action; ordinary commits do not publish the package.

## License

[MIT](LICENSE)

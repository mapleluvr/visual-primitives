# Contract: Package, CLI, and Skill Boundaries

## Package Identity

The publishable package identity is `@mapleluvr/visual-primitives`. One package version covers the CLI, generic skill, frontend replication skill family, and workflow-owned helper scripts.

The package exposes two equivalent binaries:

- `vp`
- `visual-primitives`

The Pi manifest exposes skills only. It does not expose an extension.

## VP Command Surface

The stable command names are:

- `crop`
- `crop-multi`
- `annotate`
- `point`
- `colors`

`masked-oracle-diff`, oracle management, screenshot capture, draft creation, verdict creation, refinement, and finalization are not `vp` commands.

### Input Modes

Human-oriented flags default to pixel coordinates. The command help must disclose that default.

JSON input is a compatibility mode for the former Pi tool payloads. It preserves the original payload field names and `normalized-999` default. JSON validation must reject:

- unknown properties;
- invalid optional-property types;
- non-finite numbers;
- invalid enum values;
- invalid mutually exclusive fields;
- command-inapplicable properties.

Validation failures are usage errors and use exit code 2. Runtime image or filesystem failures use exit code 1. Successful commands use exit code 0.

### Output

Successful commands write one JSON value to stdout. Optional human summaries and warnings go to stderr and can be suppressed. Generated image artifacts are PNG files. The result identifies resolved paths, source dimensions, resolved pixel coordinates, and clamping where applicable.

The CLI must never report an invalid typed value as if it were a valid resolved option.

## Skill Invocation

A skill installation must not depend on a globally installed `vp` executable. The package provides a package-local, cross-platform launcher that resolves and invokes the packaged CLI. Skill documentation may prefer a global `vp` for humans but must use or fall back to the package-local launcher for agent execution.

## Skill Ownership

### `using-visual-primitives`

Owns generic agent guidance for:

- when visual evidence is needed;
- selecting among the five `vp` commands;
- choosing pixel or normalized coordinates, origin, and box order;
- annotating assumptions before relying on them;
- inspecting generated crops and annotations;
- sampling explicit color points;
- computing second-order quantities from independently estimated coordinates.

It does not own oracle manifests, exclusion policy, masked scoring, drafts, verdicts, replication rounds, or delivery routing.

### Frontend replication family

Owns oracle intake, screenshot alignment, draft history, code execution loops, masked scoring, verdicts, feedback, subagent orchestration, and final direct inspection. It references the generic visual primitive guidance instead of redefining it.

### `masked-oracle-diff`

This helper is shipped inside the frontend replication skill resources. It may have a repository-development npm script for tests or maintainers, but it is not an npm bin, a `vp` subcommand, a generic package export, or part of the generic skill.

## Package Artifact

The npm artifact includes only declared runtime and documentation files. Development plans, workspaces, tests, fixtures used only by tests, and repository-local run evidence are excluded.

A release candidate is valid only if a tarball-install smoke test proves:

- both binary aliases execute;
- all five commands are discoverable;
- all six skills are included and valid;
- Pi package metadata points only at skills;
- the frontend workflow helper exists at its documented package-relative location;
- no extension entrypoint or Pi runtime peer dependency is required.

## Compatibility and Invalidation

Removing or renaming a command, changing JSON field semantics, changing exit codes, moving a documented skill resource, or moving `masked-oracle-diff` into the generic CLI is a protected-contract change.

Internal module paths and implementation details are not stable APIs unless separately documented later.

# Intent: Publish Visual Primitives as VP CLI + Skill Set

## User-Observable Outcome

Users can install one versioned package from npm or GitHub and receive both:

1. a standalone `vp` command for framework-independent visual evidence primitives; and
2. a discoverable Agent Skill Set whose generic and frontend-replication responsibilities are clearly separated.

Pi is one supported consumer of the Skill Set, but the visual primitive execution surface no longer depends on the Pi extension API.

## Acceptance

- **VPREL-001 Unified package:** One repository root is one publishable npm package with one version covering the CLI and all packaged skills.
- **VPREL-002 Public commands:** The package exposes `vp` and `visual-primitives` binaries with the five commands `crop`, `crop-multi`, `annotate`, `point`, and `colors`.
- **VPREL-003 CLI evidence:** Each command supports non-interactive structured JSON output, documented exit semantics, deterministic artifact generation, and focused runtime verification on real or generated PNG inputs.
- **VPREL-004 JSON compatibility:** JSON input accepts the original five Pi tool payload shapes and defaults, rejects schema-invalid fields and types as usage errors, and does not silently reinterpret invalid values.
- **VPREL-005 Skill package:** Pi package discovery loads all six skills from the package and loads no visual-primitives extension.
- **VPREL-006 Generic skill boundary:** `using-visual-primitives` remains useful independently of frontend replication and owns generic guidance for selecting and using `vp`, coordinate conventions, visual evidence, direct inspection, and second-order measurements.
- **VPREL-007 Workflow boundary:** `frontend-replication`, `inline-replication`, `subagent-driven-replication`, `refining-with-feedback`, and `finalizing-replication` own the oracle-driven reproduction workflow without duplicating the generic `vp` guidance.
- **VPREL-008 Diff ownership:** `masked-oracle-diff` ships with and remains owned by the frontend replication workflow. It is not a `vp` command, npm binary, generic core export, or generic-skill responsibility.
- **VPREL-009 Package-local execution:** Packaged skills can invoke the packaged CLI without assuming that `pi install` or another skill installer places npm binaries on the system `PATH`.
- **VPREL-010 Publishable artifact:** A packed tarball contains only the intended runtime, skills, workflow helper, documentation, and license files; installing that tarball proves both binary aliases and Pi skill discovery.
- **VPREL-011 Release automation:** GitHub CI verifies supported operating systems and Node versions, while release automation verifies the tag/package version and uses npm trusted publishing with provenance. Merely merging code does not publish or rename anything.
- **VPREL-012 Migration documentation:** English and Chinese documentation distinguish shell installation, Pi installation, the generic skill, the frontend workflow, legacy extension behavior, and the live release steps that still require authorization.

## Hard Constraints

- The public npm package name is `@mapleluvr/visual-primitives`; `vp` remains a binary name rather than an unscoped npm package name.
- CLI and Skill Set releases use one SemVer version and one Git tag.
- The package must not depend at runtime on `@earendil-works/pi-coding-agent` after extension retirement.
- Coordinate selection remains user- or agent-provided. Detection, OCR, segmentation, automatic box generation, and automatic UI inference remain outside the primitive contract.
- Direct visual inspection remains the interpreter of generated evidence.
- Existing frontend replication draft, verdict, exclusion, scoring, and final-inspection semantics must remain intact.
- `masked-oracle-diff` must not migrate into `vp`.
- The repository must remain installable from both npm and a pinned GitHub tag.

## Non-Goals

- Publishing a standalone native executable or bundling platform-specific `sharp` binaries as GitHub release assets.
- Splitting the CLI and Skills into separate repositories or independently versioned npm packages.
- Establishing a stable JavaScript library API for internal image-processing modules.
- Adding new visual inference, browser automation, OCR, CV, or screenshot-capture capabilities.
- Redesigning the frontend replication workflow or its visual quality thresholds.
- Performing a live GitHub repository rename, push, npm publish, npm ownership change, or GitHub Release creation during local implementation.

## Protected Invariants

- `vp` stays workflow-agnostic.
- `using-visual-primitives` stays frontend-workflow-agnostic.
- `masked-oracle-diff` stays frontend-workflow-specific.
- Skill guidance and CLI behavior share one tested command/input/output contract.
- Invalid user input fails clearly rather than succeeding with altered semantics.
- A clean diff remains evidence that opens direct inspection; it never declares delivery success by itself.

## Effect Authorization

Authorized now:

- local file changes in the isolated feature worktree;
- local dependency installation without lifecycle scripts where needed;
- local tests, builds, package creation, and temporary installation smoke tests;
- local commits on the feature branch.

Not authorized without a later explicit user instruction:

- `git push`;
- renaming or creating a GitHub repository;
- publishing or deprecating an npm package;
- creating tags or GitHub Releases on the remote;
- changing npm or GitHub ownership, secrets, environments, or trusted-publisher settings.

# Decision 0001: Single Repository and Single Versioned Package

Status: Approved

## Decision

Publish the standalone CLI and all six skills from one GitHub repository and one scoped npm package, `@mapleluvr/visual-primitives`. Use one SemVer version and one Git tag for the entire artifact.

Keep three responsibility layers inside that package:

1. `vp` as the workflow-independent execution engine;
2. `using-visual-primitives` as generic agent guidance for using `vp`;
3. the frontend replication skill family as the specialized workflow layer, including its workflow-owned `masked-oracle-diff` helper.

## Reasons

- Skill instructions and CLI flags, JSON fields, result shapes, and exit semantics form one compatibility unit.
- Atomic releases prevent a Skill version from describing a CLI version that is not installed.
- One issue tracker and changelog preserve the reason for cross-layer changes.
- Pi can install skills from the same npm or Git package that contains their runtime helper.
- The scoped npm name avoids collision with the already occupied unscoped `vp` package while retaining the short `vp` binary.

## Rejected Alternatives

### Separate CLI and Skill npm packages

Rejected for the initial public contract because it introduces dependency/version coordination without an independent release cadence that justifies it.

### Separate GitHub repositories

Rejected because CLI and Skill changes commonly co-change and require integrated package smoke tests.

### GitHub-only distribution

Rejected as the primary stable channel because npm provides platform-aware dependency installation, immutable version resolution, and a natural binary installation path. Pinned GitHub tags remain a supported secondary channel.

### Put `masked-oracle-diff` in `vp`

Rejected because its oracle, exclusion, scoring, draft, and verdict semantics belong to frontend replication rather than general visual evidence primitives.

## Consequences

- Any CLI/Skill contract change increments the one package version.
- Package tests must validate the integrated artifact rather than only source directories.
- Skills need a package-local launcher because Pi package installation does not promise system `PATH` exposure for npm bins.
- Release automation and documentation must distinguish GitHub source releases, npm shell installation, and Pi skill installation.

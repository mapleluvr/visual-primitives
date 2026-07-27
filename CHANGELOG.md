# Changelog

All notable changes to this package are documented here.

## [0.2.0] - 2026-07-27

### Added

- Standalone vp CLI through the `vp` and `visual-primitives` binaries, with `crop`, `crop-multi`, `annotate`, `point`, and `colors` commands.
- Strict JSON compatibility mode for the five former visual primitive tool payloads.
- Package-local Skill launcher at `skills/_shared/run-vp.mjs`.
- Frontend-owned package-local masked-diff runner that works from consumer project directories.
- Six-Skill package containing generic visual evidence guidance and the frontend replication workflow family.
- Cross-platform CI, packed-install smoke coverage, restartable GitHub Release assets, and tag-gated npm Trusted Publishing configuration.

### Changed

- Renamed the npm package from the legacy Pi extension identity to `@mapleluvr/visual-primitives`.
- Moved `masked-oracle-diff` under frontend-replication-owned Skill resources.
- Unified the CLI and Skill Set under one package version and Git tag.

### Removed

- Pi extension registration and the runtime peer dependency on `@earendil-works/pi-coding-agent`.
- `masked-oracle-diff` from the generic visual primitive execution surface.

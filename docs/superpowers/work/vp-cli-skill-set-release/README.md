# VP CLI + Skill Set Release Authority

Status: Approved

Approval source: user approval in the project session on 2026-07-27, including the subsequent ownership clarifications for `using-visual-primitives` and `masked-oracle-diff`.

## Authority

- [Intent](intent.md)
- [Package and CLI contract](contracts/package-and-cli-contract.md)
- [Single-package architecture decision](decisions/0001-single-package-architecture.md)

## Relationship to Existing Authority

This authority changes the package and execution surface from a Pi extension to a standalone `vp` CLI plus a packaged Skill Set. It supersedes extension-registration and release-organization assumptions in older design documents.

The established frontend replication workflow semantics, oracle inputs, draft history, masked scoring, verdicts, refinement limits, direct inspection requirements, and visual-evidence principles remain authoritative unless this authority explicitly changes their ownership or invocation boundary.

In particular:

- `using-visual-primitives` remains the general-purpose skill for deciding when and how to use visual primitives.
- `frontend-replication` and its lifecycle skills remain the specialized workflow layer.
- `masked-oracle-diff` remains owned by the frontend replication workflow and is not part of the `vp` command surface.

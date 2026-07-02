# Masked Oracle Diff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the cross-platform `masked-oracle-diff` Node.js script and retire the legacy `visual-primitives` Skill entry.

**Architecture:** Add a focused CLI script under `scripts/masked-oracle-diff.ts` using `sharp` for image IO and deterministic TypeScript helpers for masking, RGB/OKLab diff, matrix scoring, component detection, stripe detection, and report writing. Add tests that generate synthetic PNGs and verify artifacts, then update package metadata/docs/tests to route users to the new skill set and remove `skills/visual-primitives/SKILL.md`.

**Tech Stack:** Node.js ESM, TypeScript via `node --experimental-strip-types`, `sharp`, `node:test`, `node:assert/strict`.

## Global Constraints

- Follow TDD: write each test first, run it, confirm it fails for the expected reason, then implement.
- Use `scripts/masked-oracle-diff.ts` as the first implementation path from the spec.
- The CLI accepts a manifest with `oracleImage`, `renderedImage`, `outputDir`, optional `coordinateSpace`, `exclusionBoxes`, and `options`.
- The first implementation requires identical oracle/rendered image dimensions.
- Exclusion boxes use a shared coordinate system and mask the same location in both images.
- `diff.gray.png` must use opaque grayscale: mask pixels are exactly `[48, 48, 48, 255]` (`#303030`), alpha 255.
- Masked pixels are excluded from all numeric summaries, components, and stripes.
- The matrix is full-image `gridSize x gridSize`, default 25, with low-coverage cells represented as `null` in the compact matrix.
- The package remains cross-platform and uses Node.js ecosystem dependencies only.
- After the script is implemented and verified, delete the legacy `skills/visual-primitives/SKILL.md` and update tests/README references to the new skill set.

---

## File Structure

- Create `scripts/masked-oracle-diff.ts`: CLI entry and implementation helpers. Keeps the first version self-contained because no runtime extension imports it yet.
- Create `tests/masked-oracle-diff.test.ts`: synthetic-image integration and behavior tests for manifest parsing, mask semantics, matrix, components, stripes, and CLI outputs.
- Modify `package.json`: add `oracle:diff` script and include the new script in `npm run check`.
- Modify `tests/package.test.ts`: add package metadata checks for `oracle:diff`, remove legacy `visual-primitives` Skill expectations, and assert new skill set entries remain discoverable.
- Modify `README.md`: replace old single Skill section with skill set wording and document `oracle:diff` briefly.
- Delete `skills/visual-primitives/SKILL.md`: retire old skill after script completion.

---

### Task 1: Core CLI Behavior And Artifacts

**Files:**
- Create: `tests/masked-oracle-diff.test.ts`
- Create: `scripts/masked-oracle-diff.ts`
- Modify: `package.json`

**Interfaces:**
- Produces CLI: `node --experimental-strip-types scripts/masked-oracle-diff.ts --manifest <path>`
- Produces npm script: `npm run oracle:diff -- --manifest <path>`
- Produces artifacts: `manifest.normalized.json`, `summary.json`, `VERDICT.md`, masks, previews, diff images, matrix, components, stripes.

- [ ] **Step 1: Write failing integration test**

Create synthetic same-size oracle/rendered PNGs. Put a red mismatch outside the exclusion and a blue mismatch inside the exclusion. Run `main(["--manifest", manifestPath])`. Assert artifacts exist, summary counts scored/excluded pixels, `diff.gray.png` has `#303030` in the excluded area, and the unmasked mismatch produces non-zero summary/component evidence.

- [ ] **Step 2: Run test to verify RED**

Run: `node --experimental-strip-types --test tests/masked-oracle-diff.test.ts`
Expected: fail with missing `scripts/masked-oracle-diff.ts` or missing exports.

- [ ] **Step 3: Implement minimal CLI**

Implement manifest loading, path resolution relative to manifest directory, identical dimension validation, exclusion mask, RGB diff, core artifact writing, summary, and exported `runMaskedOracleDiff` / `main`.

- [ ] **Step 4: Verify GREEN**

Run: `node --experimental-strip-types --test tests/masked-oracle-diff.test.ts`
Expected: pass.

---

### Task 2: Matrix, Components, Stripes, And Report Details

**Files:**
- Modify: `tests/masked-oracle-diff.test.ts`
- Modify: `scripts/masked-oracle-diff.ts`

**Interfaces:**
- Produces `matrix.json`, `matrix.csv`, `components.json`, `stripes.json`.
- Summary status is `feedback-required` when components or stripes exist, otherwise `direct-inspection-required`.

- [ ] **Step 1: Write failing behavior tests**

Add tests for low-coverage matrix cells becoming `null`, masked differences producing no component, unmasked local differences producing components, and stripe-like bands producing stripes.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `node --experimental-strip-types --test tests/masked-oracle-diff.test.ts`
Expected: fail on missing matrix/component/stripe behavior.

- [ ] **Step 3: Implement scoring details**

Implement `gridSize`, `localWindow` placeholder-compatible cell aggregation, `mean`, `p90`, `score = 0.65 * mean + 0.35 * p90`, compact matrix, connected components over thresholded diff pixels, horizontal/vertical/diagonal stripe scans over compact matrix, JSON/CSV writing, and markdown verdict evidence.

- [ ] **Step 4: Verify GREEN**

Run: `node --experimental-strip-types --test tests/masked-oracle-diff.test.ts`
Expected: pass.

---

### Task 3: Package Integration And Legacy Skill Removal

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `tests/package.test.ts`
- Delete: `skills/visual-primitives/SKILL.md`

**Interfaces:**
- `npm run check` includes `scripts/masked-oracle-diff.ts`.
- `npm run oracle:diff -- --manifest <path>` runs the CLI.
- `package.test.ts` no longer expects the old `visual-primitives` Skill.

- [ ] **Step 1: Write failing package tests**

Update tests to expect `oracle:diff`, README script docs, and absence/removal of old `skills/visual-primitives/SKILL.md` expectations.

- [ ] **Step 2: Run package tests to verify RED**

Run: `node --experimental-strip-types --test tests/package.test.ts`
Expected: fail until metadata/docs/old skill removal are complete.

- [ ] **Step 3: Update metadata/docs and delete old skill**

Add scripts, update README, and remove `skills/visual-primitives/SKILL.md`.

- [ ] **Step 4: Verify GREEN**

Run: `node --experimental-strip-types --test tests/package.test.ts`
Expected: pass.

---

### Task 4: Full Verification

**Files:**
- All touched files.

- [ ] **Step 1: Run syntax check**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 3: Run whitespace check**

Run: `git diff --check`
Expected: no whitespace errors; LF/CRLF warnings may appear.

- [ ] **Step 4: Review diff**

Run: `git status --short` and inspect changed files for unexpected scope.
Expected: script, tests, package metadata, README, docs/plan, and old skill deletion only.

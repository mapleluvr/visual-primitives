# Review Proposal Loop Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not create a git commit unless the user explicitly asks.

**Goal:** Land the approved review/proposal hardening work: second-order geometry guidance, `sample_colors`, frontend replication references/contracts, masked diff wiring, screenshot contract, loop escalation, and roadmap/README decisions.

**Architecture:** Keep runtime image tools small and deterministic. Add `sample_colors` beside existing phase-2 helpers, reuse coordinate schema conventions, and keep frontend replication workflow contracts in skill `references/` files loaded by the Skill Set. Wire existing `masked-oracle-diff` CLI into Verify guidance without adding browser automation.

**Tech Stack:** TypeScript executed with Node `--experimental-strip-types`; `sharp` for image IO; Node test runner; Pi extension tool registration.

## Global Constraints

- Use TDD: write or update tests before implementation and verify RED before GREEN.
- Tools only consume user/agent-provided coordinates; they never infer coordinates from images.
- `sample_colors` samples exact provided points; it does not detect palette or dominant colors.
- No `overlay_grid` tool.
- No `measure_distance` tool.
- No screenshot automation helper in this pass; write screenshot capture contract only.
- No package dependency on `pi-subagents`; document optional SDR route dependency and fallback.
- Do not commit unless explicitly requested.

---

## File Structure

- Modify `src/schema.ts`: add `sampleColorsSchema`, `SampleColorsInput`-compatible point schema reuse, and exported point/coordinate helper types as needed.
- Modify `src/phase2.ts`: add `sampleColors(input, options)` with path normalization, point resolution, patch sampling, RGB/hex/OKLab output.
- Modify `src/extension.ts`: register `sample_colors` tool and include it in the tool input union.
- Modify `tests/schema.test.ts`: RED/GREEN tests for schema shape and patch size documentation.
- Modify `tests/phase2.test.ts`: RED/GREEN tests for runtime pixel and normalized sampling.
- Modify `tests/extension.test.ts`: RED/GREEN tests for registration and execution text.
- Modify `tests/package.test.ts`: RED/GREEN tests for skill/reference/README/roadmap contracts.
- Create `skills/frontend-replication/references/*.md`: manifest, draft, verdict, masked diff, screenshot capture contracts.
- Modify skill files under `skills/*/SKILL.md`: add reference links, diff CLI wiring, second-order rules, loop budget, SDR dependency/fallback.
- Modify `README.md`: add `sample_colors`, Skill Set references, SDR optional dependencies, and masked diff reference guidance.
- Modify `docs/assistant-capabilities-roadmap.md`: record approved tool boundary, rejected grid/distance tools, and approved `sample_colors`.

---

### Task 1: Package/Skill Contract RED Tests

**Files:**
- Modify: `tests/package.test.ts`

**Interfaces:**
- Consumes: current Skill Set markdown.
- Produces: tests that fail until references and skill wiring are implemented.

- [ ] **Step 1: Write failing tests**

Add tests requiring:

```typescript
assert.match(using, /Second-Order Quantities Must Be Computed/i);
assert.match(using, /gap = card2\.left - card1\.right = 412 - 330 = 82px/i);
assert.match(using, /sample_colors/);
assert.match(inline, /npm run oracle:diff -- --manifest/);
assert.match(sdr, /npm run oracle:diff -- --manifest/);
assert.match(frontend, /references\/oracle-manifest\.md/);
assert.match(frontend, /references\/screenshot-capture\.md/);
assert.match(refining, /Default max feedback rounds: 3/i);
assert.match(readme, /sample_colors/);
assert.match(roadmap, /overlay_grid.*rejected/is);
```

- [ ] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test tests/package.test.ts`

Expected: FAIL because references and new guidance do not exist yet.

---

### Task 2: Skill References and Workflow Wiring

**Files:**
- Create: `skills/frontend-replication/references/oracle-manifest.md`
- Create: `skills/frontend-replication/references/draft-contract.md`
- Create: `skills/frontend-replication/references/verdict-contract.md`
- Create: `skills/frontend-replication/references/masked-oracle-diff.md`
- Create: `skills/frontend-replication/references/screenshot-capture.md`
- Modify: `skills/using-visual-primitives/SKILL.md`
- Modify: `skills/frontend-replication/SKILL.md`
- Modify: `skills/inline-replication/SKILL.md`
- Modify: `skills/subagent-driven-replication/SKILL.md`
- Modify: `skills/refining-with-feedback/SKILL.md`
- Modify: `skills/finalizing-replication/SKILL.md`
- Modify: `README.md`
- Modify: `docs/assistant-capabilities-roadmap.md`

**Interfaces:**
- Produces loaded markdown contracts for future agents.
- Produces skill guidance that references `npm run oracle:diff -- --manifest docs/visual-primitives/runs/<run-id>/scripts/diff-manifest.json`.

- [ ] **Step 1: Add references**

Create focused reference files with concrete examples:

```text
oracles/oracle-manifest.json
scripts/diff-manifest.json
drafts/initial-draft-001.md
verdict/verify-001.md
```

- [ ] **Step 2: Update skills**

Add:

```text
Second-Order Quantities Must Be Computed
sample_colors
references/oracle-manifest.md
references/draft-contract.md
references/screenshot-capture.md
npm run oracle:diff -- --manifest docs/visual-primitives/runs/<run-id>/scripts/diff-manifest.json
Default max feedback rounds: 3
```

- [ ] **Step 3: Update docs**

Add README/roadmap entries for:

```text
sample_colors
overlay_grid rejected
measure_distance rejected
optional pi-subagents / superpowers dependency for SDR
```

- [ ] **Step 4: Verify GREEN**

Run: `node --experimental-strip-types --test tests/package.test.ts`

Expected: PASS.

---

### Task 3: `sample_colors` Schema RED Tests

**Files:**
- Modify: `tests/schema.test.ts`

**Interfaces:**
- Consumes: `sampleColorsSchema` from `src/schema.ts`.
- Produces: schema shape contract for extension registration and docs.

- [ ] **Step 1: Write failing tests**

Add assertions:

```typescript
import { sampleColorsSchema } from "../src/schema.ts";

assert.deepEqual(sampleColorsSchema.required, ["imagePath", "points"]);
assert.equal(sampleColorsSchema.properties.points.minItems, 1);
assert.equal(sampleColorsSchema.properties.patchSize.default, 1);
assert.equal(sampleColorsSchema.properties.patchSize.description.includes("odd"), true);
```

- [ ] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test tests/schema.test.ts`

Expected: FAIL because `sampleColorsSchema` is not exported.

---

### Task 4: Implement `sample_colors` Schema

**Files:**
- Modify: `src/schema.ts`

**Interfaces:**
- Produces: `sampleColorsSchema`.
- Produces input shape consumed by `phase2.sampleColors` and `extension.ts`.

- [ ] **Step 1: Add schema**

Add:

```typescript
const labeledPointSchema = {
  type: "object",
  additionalProperties: false,
  required: ["point"],
  properties: {
    point: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: { type: "number" },
      description: "Point coordinates to sample.",
    },
    label: {
      type: "string",
      description: "Optional label returned with the sampled color.",
    },
  },
} as const;

export const sampleColorsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["imagePath", "points"],
  properties: {
    imagePath: cropBoundingBoxSchema.properties.imagePath,
    points: {
      type: "array",
      minItems: 1,
      items: labeledPointSchema,
      description: "Points to sample from the source image.",
    },
    coordinateSpace: cropBoundingBoxSchema.properties.coordinateSpace,
    origin: cropBoundingBoxSchema.properties.origin,
    patchSize: {
      type: "integer",
      minimum: 1,
      default: 1,
      description: "Odd NxN pixel patch size to average around each resolved point. Defaults to 1.",
    },
  },
} as const;
```

- [ ] **Step 2: Verify GREEN**

Run: `node --experimental-strip-types --test tests/schema.test.ts`

Expected: PASS.

---

### Task 5: `sample_colors` Runtime RED Tests

**Files:**
- Modify: `tests/phase2.test.ts`

**Interfaces:**
- Consumes: `sampleColors(input, { cwd })` from `src/phase2.ts`.
- Produces runtime contract for pixel and normalized point sampling.

- [ ] **Step 1: Write failing tests**

Create a synthetic image with known colored pixels. Assert:

```typescript
const { sampleColors } = phase2Module as any;
const details = await sampleColors({ imagePath: "source.png", points: [{ label: "red", point: [2, 3] }], coordinateSpace: "pixel" }, { cwd: dir });
assert.equal(details.samples[0].hex, "#ff0000");
assert.deepEqual(details.samples[0].resolvedPixelPoint, { x: 2, y: 3 });
```

Add normalized test for a 100x100 image:

```typescript
point: [999, 999] -> { x: 99, y: 99 }
```

- [ ] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test tests/phase2.test.ts`

Expected: FAIL because `sampleColors` is missing.

---

### Task 6: Implement `sample_colors` Runtime

**Files:**
- Modify: `src/phase2.ts`

**Interfaces:**
- Produces: `sampleColors(input: SampleColorsInput, options: ToolOptions): Promise<SampleColorsDetails>`.
- Returns `imagePath`, `source`, `input`, `samples[]`.

- [ ] **Step 1: Add implementation**

Implement:

```typescript
export interface SampleColorsInput {
  imagePath: string;
  points: Array<{ point: [number, number]; label?: string }>;
  coordinateSpace?: CoordinateSpace;
  origin?: CoordinateOrigin;
  patchSize?: number;
}
```

Resolve points:

```typescript
x = coordinateSpace === "normalized-999" ? Math.round((point[0] / 999) * (width - 1)) : Math.round(point[0])
yRaw = coordinateSpace === "normalized-999" ? Math.round((point[1] / 999) * (height - 1)) : Math.round(point[1])
y = origin === "bottom-left" ? height - 1 - yRaw : yRaw
```

Validate bounds and patch size as a positive odd integer.

Read raw RGBA with `sharp(imagePath).ensureAlpha().raw().toBuffer()` and average patch pixels.

Return RGB, hex, OKLab, `patchMeanHex`, and `sampledPixels`.

- [ ] **Step 2: Verify GREEN**

Run: `node --experimental-strip-types --test tests/phase2.test.ts`

Expected: PASS.

---

### Task 7: Extension Registration RED/GREEN

**Files:**
- Modify: `tests/extension.test.ts`
- Modify: `src/extension.ts`

**Interfaces:**
- Consumes: `sampleColorsSchema` and `sampleColors`.
- Produces: Pi tool named `sample_colors`.

- [ ] **Step 1: Write failing extension tests**

Assert registered tool names include `sample_colors`, prompt mentions exact color sampling and provided points, and execution returns sampled hex text.

- [ ] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test tests/extension.test.ts`

Expected: FAIL because tool is not registered.

- [ ] **Step 3: Register tool**

Add import and registration:

```typescript
name: "sample_colors",
label: "Sample Colors",
description: "Sample exact pixel or patch colors at provided points in an image or screenshot.",
promptSnippet: "Sample colors at user- or agent-selected points when CSS-level color precision is required.",
```

- [ ] **Step 4: Verify GREEN**

Run: `node --experimental-strip-types --test tests/extension.test.ts`

Expected: PASS.

---

### Task 8: Full Verification and Review

**Files:**
- All touched files.

**Interfaces:**
- Produces verified working tree state.

- [ ] **Step 1: Run focused tests**

```bash
node --experimental-strip-types --test tests/schema.test.ts tests/phase2.test.ts tests/extension.test.ts tests/package.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run diff script tests**

```bash
node --experimental-strip-types --test tests/masked-oracle-diff.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Run syntax check**

```bash
npm run check
```

Expected: exit 0.

- [ ] **Step 5: Run whitespace check**

```bash
git diff --check
```

Expected: no whitespace errors; LF/CRLF warnings may appear.

- [ ] **Step 6: Review status**

```bash
git status --short
git diff --stat
```

Expected: only planned files changed. `docs/skill-set-loop-review.md` and `docs/review-proposal.md` may remain untracked user/review documents and should not be deleted.

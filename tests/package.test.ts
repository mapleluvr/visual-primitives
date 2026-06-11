import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const packageRoot = new URL("..", import.meta.url);

async function readText(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, packageRoot), "utf8");
}

test("package exposes the visual-primitives Skill", async () => {
  const packageJson = JSON.parse(await readText("package.json"));

  assert.deepEqual(packageJson.pi?.skills, ["./skills"]);
});

test("README documents the packaged visual-primitives Skill", async () => {
  const readme = await readText("README.md");

  assert.match(readme, /## Skill: `visual-primitives`/);
  assert.match(readme, /skills\/visual-primitives\/SKILL\.md/);
  assert.match(readme, /crop_bounding_box/);
});

test("README documents package installation so the Skill is loaded", async () => {
  const readme = await readText("README.md");

  assert.match(readme, /pi install \.\/pi-visual-primitives/);
  assert.match(readme, /loads both the extension tool and the Skill/);
});

test("visual-primitives Skill has valid discoverable frontmatter", async () => {
  const skill = await readText(join("skills", "visual-primitives", "SKILL.md"));

  assert.match(skill, /^---\n/);
  assert.match(skill, /\nname: visual-primitives\n/);
  assert.match(skill, /\ndescription: Use when .*visual-primitive.*bounding box/ms);
  assert.match(skill, /\n---\n/);
});

test("visual-primitives Skill documents crop_bounding_box workflow safeguards", async () => {
  const skill = await readText(join("skills", "visual-primitives", "SKILL.md"));

  assert.match(skill, /normalized-999/);
  assert.match(skill, /pixel/);
  assert.match(skill, /top-left/);
  assert.match(skill, /bottom-left/);
  assert.match(skill, /left-top-right-bottom/);
  assert.match(skill, /outputPath/);
  assert.match(skill, /padding/);
  assert.match(skill, /clamp/);
  assert.match(skill, /default to `normalized-999` unless/i);
  assert.match(skill, /crop_bounding_box/);
  assert.match(skill, /does not generate bounding boxes/i);
});

test("README documents Phase 2 auxiliary tools", async () => {
  const readme = await readText("README.md");

  assert.match(readme, /## Tool: `crop_multiple_bounding_boxes`/);
  assert.match(readme, /## Tool: `annotate_bounding_boxes`/);
  assert.match(readme, /## Tool: `crop_around_point`/);
  assert.match(readme, /fail-fast/i);
  assert.match(readme, /does not invent a default crop size/i);
});

test("visual-primitives Skill routes Phase 2 workflows to helper tools", async () => {
  const skill = await readText(join("skills", "visual-primitives", "SKILL.md"));

  assert.match(skill, /crop_multiple_bounding_boxes/);
  assert.match(skill, /annotate_bounding_boxes/);
  assert.match(skill, /crop_around_point/);
  assert.match(skill, /smallest suitable tool/i);
  assert.match(skill, /do not invent a default size/i);
});

test("roadmap records Phase 2 as implemented while keeping UI deferred", async () => {
  const roadmap = await readText(join("docs", "assistant-capabilities-roadmap.md"));

  assert.match(roadmap, /## Phase 2: Auxiliary Tools/);
  assert.match(roadmap, /Implemented in this package as runtime tools/);
  assert.match(roadmap, /crop_multiple_bounding_boxes/);
  assert.match(roadmap, /annotate_bounding_boxes/);
  assert.match(roadmap, /crop_around_point/);
  assert.match(roadmap, /## Phase 3: UI Interaction/);
  assert.match(roadmap, /UI interaction should be deferred/i);
});

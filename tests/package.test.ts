import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const packageRoot = new URL("..", import.meta.url);

async function readText(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, packageRoot), "utf8");
}

test("package exposes the visual-primitives Skill directory", async () => {
  const packageJson = JSON.parse(await readText("package.json"));

  assert.deepEqual(packageJson.pi?.skills, ["./skills"]);
});

test("package exposes masked-oracle-diff CLI scripts", async () => {
  const packageJson = JSON.parse(await readText("package.json"));

  assert.match(packageJson.scripts?.["oracle:diff"], /scripts\/masked-oracle-diff\.ts/);
  assert.match(packageJson.scripts?.check, /scripts\/masked-oracle-diff\.ts/);
});

test("README documents the packaged visual-primitives Skill Set", async () => {
  const readme = await readText("README.md");

  assert.match(readme, /## Skill Set/);
  assert.match(readme, /skills\/using-visual-primitives\/SKILL\.md/);
  assert.match(readme, /skills\/frontend-replication\/SKILL\.md/);
  assert.match(readme, /masked-oracle-diff/);
  assert.match(readme, /npm run oracle:diff/);
});

test("README documents package installation so the Skill is loaded", async () => {
  const readme = await readText("README.md");

  assert.match(readme, /pi install \.\/pi-visual-primitives/);
  assert.match(readme, /loads both the extension tool and the Skill/);
});

test("README links to a Chinese translation with matching core guidance", async () => {
  const readme = await readText("README.md");
  const zhReadme = await readText("README.zh-CN.md");

  assert.match(readme, /\[中文\]\(README\.zh-CN\.md\)/);
  assert.match(zhReadme, /\[English\]\(README\.md\)/);
  assert.match(zhReadme, /视觉证据/);
  assert.match(zhReadme, /技能集/);
  assert.match(zhReadme, /Worked Examples|完整示例|示例/);
  assert.match(zhReadme, /docs\/visual-primitives\/examples\/pulse-side-by-side\.png/);
  assert.match(zhReadme, /docs\/visual-primitives\/examples\/netease-side-by-side\.png/);
  assert.match(zhReadme, /masked-oracle-diff/);
  assert.match(zhReadme, /npm run oracle:diff/);
  assert.match(zhReadme, /crop_bounding_box/);
  assert.match(zhReadme, /sample_colors/);
  assert.match(zhReadme, /用代码渲染所有可代码绘制区域/);
  assert.match(zhReadme, /批准的排除区域可以用占位图或委托图像资产表示/);
  assert.match(zhReadme, /让可代码绘制内容留在评分域/);
  assert.doesNotMatch(zhReadme, /不要使用图像资产/);
  assert.doesNotMatch(zhReadme, /永远不要排除/);
});

test("legacy visual-primitives Skill entry is retired", async () => {
  await assert.rejects(
    () => readText(join("skills", "visual-primitives", "SKILL.md")),
    /ENOENT/,
  );
});

test("using-visual-primitives Skill has valid discoverable frontmatter", async () => {
  const skill = await readText(join("skills", "using-visual-primitives", "SKILL.md"));

  assert.match(skill, /^---\n/);
  assert.match(skill, /\nname: using-visual-primitives\n/);
  assert.match(skill, /\ndescription: Use when marking, comparing, aligning, analyzing, cropping, annotating, or inspecting images/ms);
  assert.match(skill, /\n---\n/);
});

test("frontend-replication Skill has valid discoverable frontmatter", async () => {
  const skill = await readText(join("skills", "frontend-replication", "SKILL.md"));

  assert.match(skill, /^---\n/);
  assert.match(skill, /\nname: frontend-replication\n/);
  assert.match(skill, /\ndescription: Use when reproducing frontend webpages from AIGC oracle images, reference screenshots, rendered UI, and descriptions/ms);
  assert.match(skill, /\n---\n/);
});

test("inline-replication Skill has valid discoverable frontmatter", async () => {
  const skill = await readText(join("skills", "inline-replication", "SKILL.md"));

  assert.match(skill, /^---\n/);
  assert.match(skill, /\nname: inline-replication\n/);
  assert.match(skill, /\ndescription: Use when one parent agent is executing frontend webpage replication from oracle images/ms);
  assert.match(skill, /\n---\n/);
});

test("subagent-driven-replication Skill has valid discoverable frontmatter", async () => {
  const skill = await readText(join("skills", "subagent-driven-replication", "SKILL.md"));

  assert.match(skill, /^---\n/);
  assert.match(skill, /\nname: subagent-driven-replication\n/);
  assert.match(skill, /\ndescription: Use when orchestrating subagents for frontend webpage replication from oracle images/ms);
  assert.match(skill, /\n---\n/);
});

test("refining-with-feedback Skill has valid discoverable frontmatter", async () => {
  const skill = await readText(join("skills", "refining-with-feedback", "SKILL.md"));

  assert.match(skill, /^---\n/);
  assert.match(skill, /\nname: refining-with-feedback\n/);
  assert.match(skill, /\ndescription: Use when a frontend replication loop has a process verdict, failed inspection, masked diff evidence, or previous draft history/ms);
  assert.match(skill, /\n---\n/);
});

test("finalizing-replication Skill has valid discoverable frontmatter", async () => {
  const skill = await readText(join("skills", "finalizing-replication", "SKILL.md"));

  assert.match(skill, /^---\n/);
  assert.match(skill, /\nname: finalizing-replication\n/);
  assert.match(skill, /\ndescription: Use when frontend replication verification is clean enough for final direct inspection, delivery review, or final failure routing/ms);
  assert.match(skill, /\n---\n/);
});

test("using-visual-primitives Skill owns visual evidence workflow safeguards", async () => {
  const skill = await readText(join("skills", "using-visual-primitives", "SKILL.md"));

  assert.match(skill, /visual evidence/i);
  assert.match(skill, /User requirements take priority/i);
  assert.match(skill, /Direct visual inspection takes priority/i);
  assert.match(skill, /Think geometrics, write coordinates/i);
  assert.match(skill, /annotate_bounding_boxes/);
  assert.match(skill, /crop_multiple_bounding_boxes/);
  assert.match(skill, /crop_around_point/);
  assert.match(skill, /normalized-999/);
  assert.match(skill, /pixel/);
  assert.match(skill, /top-left/);
  assert.match(skill, /left-top-right-bottom/);
  assert.match(skill, /tools detect objects, OCR text, segment images, or infer UI elements automatically/i);
});

test("using-visual-primitives Skill documents core principles and general techniques", async () => {
  const skill = await readText(join("skills", "using-visual-primitives", "SKILL.md"));

  assert.match(skill, /User requirements take priority/i);
  assert.match(skill, /Direct visual inspection takes priority/i);
  assert.match(skill, /Think geometrics, write coordinates/i);
  assert.match(skill, /appearance -> coordinates -> appearance/i);
  assert.match(skill, /specific local image content at specific positions/i);
  assert.match(skill, /annotate_bounding_boxes/);
  assert.match(skill, /crop_bounding_box/);
  assert.match(skill, /crop_multiple_bounding_boxes/);
  assert.match(skill, /crop_around_point/);
  assert.match(skill, /marking images/i);
  assert.match(skill, /comparing images/i);
  assert.match(skill, /aligning images/i);
  assert.match(skill, /analyzing images/i);
  assert.match(skill, /resolvedPixelBox/i);
  assert.match(skill, /width.*height.*area/is);
  assert.match(skill, /normalized-999/);
  assert.match(skill, /pixel/);
  assert.match(skill, /directly inspect/i);
});

test("frontend-replication Skill documents oracle intake, workspace, and route selection", async () => {
  const skill = await readText(join("skills", "frontend-replication", "SKILL.md"));

  assert.match(skill, /gateway skill/i);
  assert.match(skill, /Oracle Intake/i);
  assert.match(skill, /derive a working oracle description/i);
  assert.match(skill, /Screenshots or reference images are sufficient to start Oracle Intake/i);
  assert.match(skill, /using-visual-primitives/);
  assert.match(skill, /oracle-manifest\.json/);
  assert.match(skill, /docs\/visual-primitives\/runs\/<run-id>/);
  assert.match(skill, /oracles\//);
  assert.match(skill, /annots\//);
  assert.match(skill, /cropped\//);
  assert.match(skill, /rendered\//);
  assert.match(skill, /diffs\//);
  assert.match(skill, /drafts\//);
  assert.match(skill, /verdict\//);
  assert.match(skill, /scripts\//);
  assert.match(skill, /final\//);
  assert.match(skill, /inline-replication/);
  assert.match(skill, /subagent-driven-replication/);
  assert.match(skill, /refining-with-feedback/);
  assert.match(skill, /finalizing-replication/);
  assert.match(skill, /Drafts accumulate as new files/i);
  assert.match(skill, /Use `verdict\/` only for process feedback/i);
  assert.match(skill, /use `final\/` for delivery review/i);
  assert.doesNotMatch(skill, /does not block the workflow/i);
  assert.doesNotMatch(skill, /should not overwrite earlier drafts/i);
  assert.doesNotMatch(skill, /Do not treat `verdict\/` as final delivery/i);
});

test("using-visual-primitives Skill avoids redundant negative definitions", async () => {
  const skill = await readText(join("skills", "using-visual-primitives", "SKILL.md"));

  assert.match(skill, /standalone image proofreading/i);
  assert.match(skill, /Use numeric differences to choose where to inspect/i);
  assert.match(skill, /Alignment requires explicit coordinate evidence/i);
  assert.doesNotMatch(skill, /even when no frontend replication workflow is involved/i);
  assert.doesNotMatch(skill, /Do not let a script or metric overrule direct visual inspection/i);
  assert.doesNotMatch(skill, /not just a visual guess/i);
});

test("inline-replication Skill documents the parent-agent replication loop", async () => {
  const skill = await readText(join("skills", "inline-replication", "SKILL.md"));

  assert.match(skill, /frontend-replication/);
  assert.match(skill, /using-visual-primitives/);
  assert.match(skill, /Initial Draft/i);
  assert.match(skill, /Code Execution/i);
  assert.match(skill, /Verify/i);
  assert.match(skill, /Feedback/i);
  assert.match(skill, /finalizing-replication/);
  assert.match(skill, /drafts\/initial-draft/i);
  assert.match(skill, /rendered\//);
  assert.match(skill, /diffs\//);
  assert.match(skill, /verdict\//);
  assert.match(skill, /refining-with-feedback/);
  assert.match(skill, /all previous drafts/i);
  assert.match(skill, /latest verdict/i);
});

test("subagent-driven-replication Skill documents orchestrator-led worker and reviewer flow", async () => {
  const skill = await readText(join("skills", "subagent-driven-replication", "SKILL.md"));

  assert.match(skill, /Orchestrator/i);
  assert.match(skill, /Initial Draft/i);
  assert.match(skill, /visual annotation worker/i);
  assert.match(skill, /read-write/i);
  assert.match(skill, /annotate_bounding_boxes/);
  assert.match(skill, /crop_multiple_bounding_boxes/);
  assert.match(skill, /write.*draft/is);
  assert.match(skill, /Code Execution/i);
  assert.match(skill, /subagent-driven-development/i);
  assert.match(skill, /superpowers/i);
  assert.match(skill, /same time only one worker/i);
  assert.match(skill, /sequentially dispatch multiple workers/i);
  assert.match(skill, /Verify/i);
  assert.match(skill, /reviewer preset/i);
  assert.match(skill, /completion approval/i);
  assert.match(skill, /avoid.*timeoutMs/is);
  assert.match(skill, /avoid.*maxRuntimeMs/is);
  assert.match(skill, /async: true/);
  assert.match(skill, /synthesize.*verdict/is);
  assert.match(skill, /verdict\.md/i);
  assert.match(skill, /refining-with-feedback/);
});

test("inline and subagent replication Skills avoid redundant negative definitions", async () => {
  const inline = await readText(join("skills", "inline-replication", "SKILL.md"));
  const sdr = await readText(join("skills", "subagent-driven-replication", "SKILL.md"));

  assert.match(inline, /Use the gateway workspace directory meanings/i);
  assert.match(inline, /masked diff evidence as supporting evidence/i);
  assert.match(inline, /direct inspection remains the interpreter/i);
  assert.match(inline, /mask-out regions preserve all code-drawable content/i);
  assert.match(inline, /Use `verdict\/` for process feedback and `final\/` for delivery handoff/i);
  assert.doesNotMatch(inline, /without redefining their meaning/i);
  assert.doesNotMatch(inline, /not as the final interpreter/i);
  assert.doesNotMatch(inline, /do not hide code-drawable content/i);
  assert.doesNotMatch(inline, /Letting `verdict\/` become the final handoff instead of process feedback/i);

  assert.match(sdr, /orchestration stays in the parent session/i);
  assert.match(sdr, /Page implementation starts in Code Execution/i);
  assert.match(sdr, /approval findings scoped to draft reasonableness, completion, and evidence quality/i);
  assert.match(sdr, /Synthesize child outputs into the verdict/i);
  assert.match(sdr, /final direct inspection happens through `finalizing-replication`/i);
  assert.match(sdr, /Synthesize reviewer output before writing verdict\.md/i);
  assert.doesNotMatch(sdr, /should not run their own orchestration loops/i);
  assert.doesNotMatch(sdr, /should not implement page code during this phase/i);
  assert.doesNotMatch(sdr, /not open-ended redesign/i);
  assert.doesNotMatch(sdr, /Do not paste child outputs as the verdict/i);
  assert.doesNotMatch(sdr, /does not replace final direct inspection/i);
  assert.doesNotMatch(sdr, /Accepting reviewer output as verdict\.md without Orchestrator synthesis/i);
});

test("refining-with-feedback Skill documents draft-history synthesis", async () => {
  const skill = await readText(join("skills", "refining-with-feedback", "SKILL.md"));

  assert.match(skill, /DraftHistory/i);
  assert.match(skill, /all previous drafts/i);
  assert.match(skill, /latest verdict/i);
  assert.match(skill, /oracles\/oracle-manifest\.json/);
  assert.match(skill, /drafts\//);
  assert.match(skill, /verdict\//);
  assert.match(skill, /preserve confirmed facts/i);
  assert.match(skill, /stable element names/i);
  assert.match(skill, /blockers/i);
  assert.match(skill, /fixes worth doing now/i);
  assert.match(skill, /optional.*deferred/is);
  assert.match(skill, /accepted exclusions/i);
  assert.match(skill, /rejected exclusions/i);
  assert.match(skill, /mask problems/i);
  assert.match(skill, /drafts\/feedback-draft/i);
  assert.match(skill, /inline-replication/);
  assert.match(skill, /subagent-driven-replication/);
  assert.match(skill, /code execution/i);
  assert.match(skill, /evidence paths/i);
  assert.match(skill, /code execution and worker dispatch stay with inline-replication or subagent-driven-replication/i);
});

test("refining-with-feedback Skill avoids redundant negative definitions", async () => {
  const skill = await readText(join("skills", "refining-with-feedback", "SKILL.md"));

  assert.match(skill, /a user request can promote them into the next loop scope/i);
  assert.match(skill, /code execution and worker dispatch stay with inline-replication or subagent-driven-replication/i);
  assert.match(skill, /required work contains blockers, fix-now targets, rejected exclusions, and mask problems/i);
  assert.match(skill, /Preserve DraftHistory when writing each feedback draft/i);
  assert.match(skill, /Keep stable element names unless verdict evidence requires a rename/i);
  assert.match(skill, /Create a concrete feedback draft before returning to the execution loop/i);
  assert.doesNotMatch(skill, /should not expand the next loop unless the user asks for them/i);
  assert.doesNotMatch(skill, /does not implement code/i);
  assert.doesNotMatch(skill, /does not dispatch workers/i);
  assert.doesNotMatch(skill, /optional\/deferred notes are not mixed into required work/i);
  assert.doesNotMatch(skill, /Rewriting the Initial Draft from scratch instead of preserving DraftHistory/i);
  assert.doesNotMatch(skill, /Changing element names without evidence/i);
  assert.doesNotMatch(skill, /Sending the next loop forward without a concrete feedback draft/i);
});

test("finalizing-replication Skill documents final inspection and delivery routing", async () => {
  const skill = await readText(join("skills", "finalizing-replication", "SKILL.md"));

  assert.match(skill, /final direct inspection/i);
  assert.match(skill, /direct visual inspection remains the interpreter/i);
  assert.match(skill, /oracles\/oracle-manifest\.json/);
  assert.match(skill, /DraftHistory/i);
  assert.match(skill, /rendered\//);
  assert.match(skill, /diffs\//);
  assert.match(skill, /accepted exclusions/i);
  assert.match(skill, /user requirements/i);
  assert.match(skill, /final\/final-inspection\.md/);
  assert.match(skill, /final\/delivery-review\.md/);
  assert.match(skill, /final\/accepted-render\.png/);
  assert.match(skill, /final\/remaining-limitations\.md/);
  assert.match(skill, /final\/final-inspection-failed\.md/);
  assert.match(skill, /verdict\/finalizing-verdict/i);
  assert.match(skill, /refining-with-feedback/);
  assert.match(skill, /user-facing delivery review/i);
  assert.match(skill, /diff clean opens final inspection/i);
});

test("README documents visual evidence workflows and Phase 2 auxiliary tools", async () => {
  const readme = await readText("README.md");

  assert.match(readme, /visual evidence workflow/i);
  assert.match(readme, /screenshots/i);
  assert.match(readme, /frontend visual reproduction/i);
  assert.match(readme, /visual QA/i);
  assert.match(readme, /Visual evidence needs trigger the package/i);
  assert.match(readme, /## Tool: `crop_multiple_bounding_boxes`/);
  assert.match(readme, /## Tool: `annotate_bounding_boxes`/);
  assert.match(readme, /## Tool: `crop_around_point`/);
  assert.match(readme, /fail-fast/i);
  assert.match(readme, /requires an explicit crop size/i);
});

test("using-visual-primitives Skill routes helper tool workflows", async () => {
  const skill = await readText(join("skills", "using-visual-primitives", "SKILL.md"));

  assert.match(skill, /crop_multiple_bounding_boxes/);
  assert.match(skill, /annotate_bounding_boxes/);
  assert.match(skill, /crop_around_point/);
  assert.match(skill, /Tool Selection/i);
  assert.match(skill, /explicit `radius` or `size`/i);
});

test("using-visual-primitives Skill describes broad tool usage scenarios", async () => {
  const skill = await readText(join("skills", "using-visual-primitives", "SKILL.md"));

  assert.match(skill, /region hypothesis/i);
  assert.match(skill, /layout comparison/i);
  assert.match(skill, /spacing/i);
  assert.match(skill, /visual QA/i);
  assert.match(skill, /masked diff component/i);
  assert.match(skill, /edge alignment/i);
  assert.match(skill, /text baseline/i);
  assert.match(skill, /shadow mismatch/i);
  assert.match(skill, /gradient/i);
  assert.match(skill, /palette/i);
});

test("using-visual-primitives Skill documents multi-image proofreading workflow", async () => {
  const skill = await readText(join("skills", "using-visual-primitives", "SKILL.md"));

  assert.match(skill, /For two or more images/i);
  assert.match(skill, /annotate_bounding_boxes[\s\S]*crop_multiple_bounding_boxes/);
  assert.match(skill, /resolvedPixelBox/i);
  assert.match(skill, /width.*height.*area/i);
  assert.match(skill, /Directly inspect the annotated images and crop outputs/i);
});

test("using-visual-primitives Skill documents second-order quantities and color sampling", async () => {
  const skill = await readText(join("skills", "using-visual-primitives", "SKILL.md"));

  assert.match(skill, /Second-Order Quantities Must Be Computed/i);
  assert.match(skill, /Distance, gap, size difference, alignment offset, and ratio/i);
  assert.match(skill, /gap = card2\.left - card1\.right = 412 - 330 = 82px/i);
  assert.match(skill, /sample_colors/);
  assert.match(skill, /CSS-level color precision/i);
});

test("frontend replication references publish stable loop contracts", async () => {
  const oracleManifest = await readText(join("skills", "frontend-replication", "references", "oracle-manifest.md"));
  const draftContract = await readText(join("skills", "frontend-replication", "references", "draft-contract.md"));
  const verdictContract = await readText(join("skills", "frontend-replication", "references", "verdict-contract.md"));
  const maskedDiff = await readText(join("skills", "frontend-replication", "references", "masked-oracle-diff.md"));
  const screenshotCapture = await readText(join("skills", "frontend-replication", "references", "screenshot-capture.md"));

  assert.match(oracleManifest, /oracles\/oracle-manifest\.json/);
  assert.match(oracleManifest, /viewport/);
  assert.match(oracleManifest, /oraclePairs/);
  assert.match(draftContract, /Initial Draft/);
  assert.match(draftContract, /Feedback Draft/);
  assert.match(verdictContract, /blockers/i);
  assert.match(verdictContract, /fixes worth doing now/i);
  assert.match(maskedDiff, /npm run oracle:diff -- --manifest/);
  assert.match(maskedDiff, /scripts\/diff-manifest\.json/);
  assert.match(maskedDiff, /minComponentArea/);
  assert.match(screenshotCapture, /same viewport/i);
  assert.match(screenshotCapture, /same pixel dimensions/i);
});

test("replication Skills wire Verify to masked-oracle-diff and reference contracts", async () => {
  const frontend = await readText(join("skills", "frontend-replication", "SKILL.md"));
  const inline = await readText(join("skills", "inline-replication", "SKILL.md"));
  const sdr = await readText(join("skills", "subagent-driven-replication", "SKILL.md"));
  const refining = await readText(join("skills", "refining-with-feedback", "SKILL.md"));
  const finalizing = await readText(join("skills", "finalizing-replication", "SKILL.md"));

  assert.match(frontend, /references\/oracle-manifest\.md/);
  assert.match(frontend, /references\/draft-contract\.md/);
  assert.match(frontend, /references\/screenshot-capture\.md/);
  assert.match(inline, /npm run oracle:diff -- --manifest/);
  assert.match(inline, /scripts\/diff-manifest\.json/);
  assert.match(inline, /VERDICT\.md/);
  assert.match(inline, /components\.json[\s\S]*center[\s\S]*crop_around_point/i);
  assert.match(inline, /second-order[\s\S]*sample_colors/i);
  assert.match(sdr, /npm run oracle:diff -- --manifest/);
  assert.match(sdr, /pi-subagents/);
  assert.match(sdr, /fall back to `inline-replication`/i);
  assert.match(sdr, /components\.json[\s\S]*center[\s\S]*crop_around_point/i);
  assert.match(sdr, /second-order[\s\S]*sample_colors/i);
  assert.match(refining, /Default max feedback rounds: 3/i);
  assert.match(refining, /same finding recurs after two feedback drafts/i);
  assert.match(finalizing, /summary\.json/);
  assert.match(finalizing, /components\.json/);
  assert.match(finalizing, /stripes\.json/);
});

test("loop hardening spec matches sample_colors output shape", async () => {
  const spec = await readText(join("docs", "superpowers", "specs", "2026-07-02-review-proposal-loop-hardening-spec.md"));

  assert.match(spec, /"patch"[\s\S]*"meanHex"/);
  assert.doesNotMatch(spec, /"patchMeanHex"/);
});

test("README and roadmap record approved tool boundary decisions", async () => {
  const readme = await readText("README.md");
  const roadmap = await readText(join("docs", "assistant-capabilities-roadmap.md"));

  assert.match(readme, /sample_colors/);
  assert.match(readme, /pi-subagents/);
  assert.match(readme, /subagent-driven-replication/);
  assert.match(roadmap, /overlay_grid.*rejected/is);
  assert.match(roadmap, /measure_distance.*rejected/is);
  assert.match(roadmap, /sample_colors.*approved/is);
  assert.match(roadmap, /coordinates into visual artifacts/i);
  assert.match(roadmap, /coordinates into numeric evidence/i);
});

test("README uses positive capability boundaries", async () => {
  const readme = await readText("README.md");

  assert.match(readme, /Visual evidence needs trigger the package/i);
  assert.match(readme, /Detection, OCR, segmentation, automatic box generation, and automatic UI inference stay outside the tool contract/i);
  assert.match(readme, /requires an explicit crop size/i);
  assert.match(readme, /Palette and dominant-color discovery stay outside the point-sampling contract/i);
  assert.match(readme, /Use `using-visual-primitives` for standalone visual evidence tasks/i);
  assert.doesNotMatch(readme, /Coordinates are not the trigger/i);
  assert.doesNotMatch(readme, /does not generate boxes, detect objects, OCR text, segment images, or infer UI elements automatically/i);
  assert.doesNotMatch(readme, /The legacy single `visual-primitives` Skill entry has been retired/i);
  assert.doesNotMatch(readme, /it does not detect palettes or dominant colors/i);
  assert.doesNotMatch(readme, /does not invent a default crop size/i);
});

test("README worked examples keep exclusion guidance positive and internally consistent", async () => {
  const readme = await readText("README.md");

  assert.match(readme, /Render every code-drawable region in code/i);
  assert.match(readme, /Approved exclusions may be represented by placeholders or delegated image assets/i);
  assert.match(readme, /Keep code-drawable content inside the scoring domain/i);
  assert.match(readme, /The NetEase logo mark was left in the code-replication scope/i);
  assert.match(readme, /dense brand marks can be declared as narrow exclusion candidates/i);
  assert.doesNotMatch(readme, /Do not use image assets/i);
  assert.doesNotMatch(readme, /Never exclude code-drawable content/i);
  assert.doesNotMatch(readme, /should not be asked to paint/i);
  assert.doesNotMatch(readme, /That is exactly why the workflow treats logos, avatars, and cover art as delegation-and-exclusion candidates/i);
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

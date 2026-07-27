import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const packageRoot = new URL("..", import.meta.url);
const packageRootPath = decodeURIComponent(packageRoot.pathname).replace(/^\/(?:([A-Za-z]:))/, "$1");
const expectedSkills = [
  "finalizing-replication",
  "frontend-replication",
  "inline-replication",
  "refining-with-feedback",
  "subagent-driven-replication",
  "using-visual-primitives",
];
const legacyToolNames = [
  "annotate_bounding_boxes",
  "crop_around_point",
  "crop_bounding_box",
  "crop_multiple_bounding_boxes",
  "sample_colors",
];

async function readText(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, packageRoot), "utf8");
}

function normalizeLines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

async function pathExists(relativePath: string): Promise<boolean> {
  try {
    await access(new URL(relativePath, packageRoot));
    return true;
  } catch {
    return false;
  }
}

test("Pi metadata exposes exactly the Skill Set and no extension", async () => {
  const packageJson = JSON.parse(await readText("package.json"));

  assert.deepEqual(packageJson.pi, { skills: ["./skills"] });
  assert.equal(packageJson.peerDependencies?.["@earendil-works/pi-coding-agent"], undefined);
});

test("all six Skills have portable discoverable frontmatter", async () => {
  const skillRoot = new URL("skills/", packageRoot);
  const entries = await readdir(skillRoot, { withFileTypes: true });
  const discovered: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "_shared") continue;
    const skillPath = `skills/${entry.name}/SKILL.md`;
    if (!(await pathExists(skillPath))) continue;
    const skill = normalizeLines(await readText(skillPath));
    assert.match(skill, /^---\n/);
    assert.match(skill, new RegExp(`\\nname: ${entry.name}\\n`));
    assert.match(skill, /\ndescription: Use when .+\n/);
    assert.match(skill, /\n---\n/);
    discovered.push(entry.name);
  }

  assert.deepEqual(discovered.sort(), expectedSkills);
});

test("package-local launcher executes the packaged CLI without PATH lookup", async () => {
  const launcher = join(packageRootPath, "skills", "_shared", "run-vp.mjs");
  const { stdout, stderr } = await execFileAsync(process.execPath, [launcher, "--help"], {
    cwd: packageRootPath,
    env: { ...process.env, PATH: "" },
  });

  assert.equal(stderr, "");
  for (const command of ["crop", "crop-multi", "annotate", "point", "colors"]) {
    assert.match(stdout, new RegExp(`\\b${command.replace("-", "\\-")}\\b`));
  }
});

test("using-visual-primitives teaches the five vp commands and package-local fallback", async () => {
  const skill = normalizeLines(await readText("skills/using-visual-primitives/SKILL.md"));

  assert.match(skill, /visual evidence/i);
  assert.match(skill, /direct visual inspection/i);
  assert.match(skill, /skills\/_shared\/run-vp\.mjs/);
  assert.match(skill, /package-local/i);
  assert.match(skill, /second-order/i);
  assert.match(skill, /resolvedPixelBox/);
  for (const command of ["vp crop", "vp crop-multi", "vp annotate", "vp point", "vp colors"]) {
    assert.match(skill, new RegExp(command.replace("-", "\\-")));
  }
  for (const legacyName of legacyToolNames) {
    assert.doesNotMatch(skill, new RegExp(legacyName));
  }
  assert.doesNotMatch(skill, /pi-visual-primitives/i);
  assert.doesNotMatch(skill, /masked[- ]diff|oracle|draft|verdict|replication|finaliz/i);
});

test("replication Skills reference generic guidance without old extension tool calls", async () => {
  const family = await Promise.all(expectedSkills
    .filter((name) => name !== "using-visual-primitives")
    .map(async (name) => [name, normalizeLines(await readText(`skills/${name}/SKILL.md`))] as const));
  const combined = family.map(([, skill]) => skill).join("\n");

  assert.match(combined, /using-visual-primitives/);
  assert.match(combined, /oracle/i);
  assert.match(combined, /masked diff/i);
  assert.match(combined, /draft/i);
  assert.match(combined, /verdict/i);
  assert.match(combined, /final direct inspection/i);
  assert.match(combined, /vp annotate/);
  assert.match(combined, /vp point/);
  assert.match(combined, /vp colors/);
  for (const legacyName of legacyToolNames) {
    assert.doesNotMatch(combined, new RegExp(legacyName));
  }
});

test("masked-oracle-diff remains frontend-replication-owned", async () => {
  const packageJson = JSON.parse(await readText("package.json"));
  const cliHelp = (await execFileAsync(process.execPath, [join(packageRootPath, "dist", "cli.js"), "--help"], {
    cwd: packageRootPath,
  })).stdout;

  assert.equal(await pathExists("scripts/masked-oracle-diff.ts"), false);
  assert.equal(await pathExists("skills/frontend-replication/scripts/masked-oracle-diff.ts"), true);
  assert.equal(await pathExists("skills/frontend-replication/scripts/masked-oracle-diff.js"), true);
  assert.equal(await pathExists("skills/frontend-replication/scripts/run-masked-oracle-diff.mjs"), true);
  assert.match(packageJson.scripts?.check, /skills\/frontend-replication\/scripts\/run-masked-oracle-diff\.mjs/);
  assert.match(packageJson.scripts?.check, /skills\/frontend-replication\/scripts\/masked-oracle-diff\.(?:ts|js)/);
  assert.match(packageJson.scripts?.["oracle:diff"], /skills\/frontend-replication\/scripts\/masked-oracle-diff\.js/);
  assert.doesNotMatch(JSON.stringify(packageJson.bin), /masked-oracle-diff/);
  assert.doesNotMatch(cliHelp, /masked-oracle-diff/);
});

test("frontend replication references retain workflow contracts", async () => {
  const references = await Promise.all([
    "oracle-manifest.md",
    "draft-contract.md",
    "verdict-contract.md",
    "masked-oracle-diff.md",
    "screenshot-capture.md",
  ].map((name) => readText(`skills/frontend-replication/references/${name}`)));
  const combined = normalizeLines(references.join("\n"));

  assert.match(combined, /oracle-manifest\.json/);
  assert.match(combined, /Initial Draft/);
  assert.match(combined, /Feedback Draft/);
  assert.match(combined, /blockers/i);
  assert.match(combined, /fixes worth doing now/i);
  assert.match(combined, /run-masked-oracle-diff\.mjs --manifest/);
  assert.doesNotMatch(combined, /npm run oracle:diff/);
  assert.match(combined, /same pixel dimensions/i);
});
